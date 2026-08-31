import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { AdtRegistry } from '../lib/registry.js';
import { LockLedger } from '../lib/locks.js';
import { builtinDefaults, workspaceConfigCandidates, workspaceConfigPath } from '../lib/config.js';
import {
  WorkspaceConfigStore,
  destinationNameFromLabel,
  upsertDestination,
} from '../lib/workspace.js';
import { destinationTools } from '../lib/tools/destinations.js';

const dest = (name: string, overrides: Record<string, unknown> = {}) =>
  ({ name, url: `https://${name}.example.com`, strictSSL: true, timeoutMs: 60_000, ...overrides }) as never;

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

test('workspaceConfigCandidates/Path: <cwd>/.dsh-abap-adt/destinations.yaml then .yml', () => {
  const cwd = join(tmpdir(), 'ws');
  assert.deepEqual(workspaceConfigCandidates(cwd), [
    join(cwd, '.dsh-abap-adt', 'destinations.yaml'),
    join(cwd, '.dsh-abap-adt', 'destinations.yml'),
  ]);
  assert.equal(workspaceConfigPath(cwd), join(cwd, '.dsh-abap-adt', 'destinations.yaml'));
});

// ---------------------------------------------------------------------------
// WorkspaceConfigStore
// ---------------------------------------------------------------------------

test('WorkspaceConfigStore.load: absent file -> undefined; valid file -> layer', () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-ws-'));
  try {
    const store = new WorkspaceConfigStore();
    assert.equal(store.load(dir), undefined);
    const file = join(dir, '.dsh-abap-adt', 'destinations.yaml');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, 'defaultDestination: dev\ndestinations:\n  - name: dev\n    url: https://sap.example.com\n', 'utf8');
    const loaded = store.load(dir);
    assert.equal(loaded?.path, file);
    assert.equal(loaded?.layer.defaultDestination, 'dev');
    assert.equal(loaded?.layer.destinations?.[0]?.name, 'dev');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WorkspaceConfigStore.load: invalid file fails loudly with the path and key', () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-ws-'));
  try {
    const file = join(dir, '.dsh-abap-adt', 'destinations.yaml');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, 'destinations:\n  - name: dev\n    url: https://x\n    usrname: bob\n', 'utf8');
    const store = new WorkspaceConfigStore();
    assert.throws(() => store.load(dir), /unknown destination keys .*usrname/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WorkspaceConfigStore: content changes hot-reload through the stat cache', () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-ws-'));
  try {
    const file = join(dir, '.dsh-abap-adt', 'destinations.yaml');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, 'destinations: []\n', 'utf8');
    const store = new WorkspaceConfigStore();
    assert.deepEqual(store.load(dir)?.layer.destinations, []);
    writeFileSync(file, 'destinations:\n  - name: dev\n    url: https://sap.example.com\n', 'utf8');
    const reloaded = store.load(dir);
    assert.equal(reloaded?.layer.destinations?.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WorkspaceConfigStore.write: creates the file with header, atomically, and updates its cache', () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-ws-'));
  try {
    const store = new WorkspaceConfigStore();
    const { path } = store.write(dir, () => ({ destinations: [dest('dev')] }));
    assert.equal(path, join(dir, '.dsh-abap-adt', 'destinations.yaml'));
    const raw = readFileSync(path, 'utf8');
    assert.match(raw, /^# abap-adt workspace destinations/);
    assert.match(raw, /- name: dev/);
    // Atomic write leaves no temp files behind.
    assert.deepEqual(readdirSync(dirname(path)).filter((f) => f.includes('.tmp')), []);
    // The cache reflects the write immediately.
    assert.equal(store.load(dir)?.layer.destinations?.[0]?.name, 'dev');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('upsertDestination: replace keeps order; new names append; created flag', () => {
  const base = { destinations: [dest('a'), dest('b')] } as never;
  const replaced = upsertDestination(base, dest('a', { url: 'https://new' }));
  assert.equal(replaced.created, false);
  assert.deepEqual(replaced.layer.destinations?.map((d) => `${d.name}:${d.url}`), ['a:https://new', 'b:https://b.example.com']);
  const added = upsertDestination(replaced.layer, dest('c'));
  assert.equal(added.created, true);
  assert.equal(added.layer.destinations?.length, 3);
});

test('destinationNameFromLabel: slugifies GUI labels', () => {
  assert.equal(destinationNameFromLabel('IMPC S4 DEV 100'), 'impc-s4-dev-100');
  assert.equal(destinationNameFromLabel('[120] 蒙电 (PRD)'), '120-prd');
  assert.equal(destinationNameFromLabel('  '), 'sap-system');
});

// ---------------------------------------------------------------------------
// Registry workspace views (the per-tool-call layer)
// ---------------------------------------------------------------------------

test('viewFor: workspace file overrides same-name globals, appends new ones, sets the default', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-ws-'));
  const registry = await AdtRegistry.create({
    ...builtinDefaults(),
    demo: false,
    defaultDestination: 'global-default',
    destinations: [dest('shared', { url: 'https://global.example.com' })],
  });
  try {
    const file = join(ws, '.dsh-abap-adt', 'destinations.yaml');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      [
        'defaultDestination: local',
        'destinations:',
        '  - name: shared',
        '    url: https://workspace.example.com',
        '  - name: local',
        '    url: https://local.example.com',
        '',
      ].join('\n'),
      'utf8',
    );
    const view = await registry.viewFor(ws);
    assert.equal(view.workspaceFile, file);
    assert.equal(view.defaultName, 'local');
    assert.equal(view.destinations.get('shared')?.config.url, 'https://workspace.example.com');
    assert.equal(view.destinations.get('local')?.config.url, 'https://local.example.com');
    // require() honours the workspace default and entries.
    assert.equal((await registry.require(undefined, ws)).config.name, 'local');
    assert.equal((await registry.require('shared', ws)).config.url, 'https://workspace.example.com');
    // Without a cwd the shared global view is untouched.
    assert.equal((await registry.viewFor()).destinations.get('shared')?.config.url, 'https://global.example.com');
    assert.equal((await registry.viewFor()).defaultName, 'global-default');
  } finally {
    await registry.dispose();
    rmSync(ws, { recursive: true, force: true });
  }
});

test('require: unknown destination error names the workspace file and the create tool', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-ws-'));
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false });
  try {
    const file = join(ws, '.dsh-abap-adt', 'destinations.yaml');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, 'destinations: []\n', 'utf8');
    await assert.rejects(
      () => registry.require('typo', ws),
      (error: unknown) => {
        const message = (error as Error).message;
        return message.includes("Unknown ADT destination 'typo'") && message.includes(file) && message.includes('adt_create_destination');
      },
    );
  } finally {
    await registry.dispose();
    rmSync(ws, { recursive: true, force: true });
  }
});

test('viewFor: workspace top-level policy keys apply to ITS destinations only', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-ws-'));
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false, destinations: [dest('g')] });
  try {
    const file = join(ws, '.dsh-abap-adt', 'destinations.yaml');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      [
        "allowedPackages: 'Z*'",
        'destinations:',
        '  - name: w',
        '    url: https://w.example.com',
        '',
      ].join('\n'),
      'utf8',
    );
    const view = await registry.viewFor(ws);
    assert.deepEqual(view.destinations.get('w')?.policy.describe().allowedPackages, ['Z*']);
    // Global destination untouched (falls back to env/built-in defaults).
    assert.deepEqual(view.destinations.get('g')?.policy.describe().allowedPackages, ['*']);
  } finally {
    await registry.dispose();
    rmSync(ws, { recursive: true, force: true });
  }
});

test('viewFor: workspace clients are reused across calls with the same config', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-ws-'));
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false });
  try {
    const file = join(ws, '.dsh-abap-adt', 'destinations.yaml');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, 'destinations:\n  - name: dev\n    url: https://dev.example.com\n', 'utf8');
    const first = (await registry.viewFor(ws)).destinations.get('dev');
    const second = (await registry.viewFor(ws)).destinations.get('dev');
    assert.equal(first, second, 'same AdtClient across calls (CSRF/cookies survive)');
    // A config change produces a fresh entry.
    writeFileSync(file, 'destinations:\n  - name: dev\n    url: https://dev2.example.com\n', 'utf8');
    const changed = (await registry.viewFor(ws)).destinations.get('dev');
    assert.notEqual(changed, first);
  } finally {
    await registry.dispose();
    rmSync(ws, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// adt_create_destination / adt_list_gui_connections (tool level)
// ---------------------------------------------------------------------------

const LANDSCAPE_XML = `<?xml version="1.0"?>
<Landscape version="1">
\t<Services>
\t\t<Service type="SAPGUI" uuid="svc-impc-dev" name="IMPC S4 DEV" systemid="D01" mode="1" server="10.126.22.123:3201" sncop="-1" dcpg="2"/>
\t\t<Service type="Reference" uuid="svc-impc-dev-100" name="IMPC S4 DEV 100" systemid="D01" client="100" user="DC_HUXF" language="ZH" link="svc-impc-dev"/>
\t\t<Service type="SAPGUI" uuid="svc-group" name="IMPC PRD GROUP" systemid="S4P" msid="ms1" server="PUBLIC" sncop="-1" dcpg="2"/>
\t</Services>
\t<Messageservers>
\t\t<Messageserver uuid="ms1" name="S4P" host="ms.example.com" port="3600"/>
\t</Messageservers>
</Landscape>
`;

function withLandscape<T>(path: string, fn: () => T): T {
  const previous = process.env.ADT_SAPGUI_LANDSCAPE;
  process.env.ADT_SAPGUI_LANDSCAPE = path;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.ADT_SAPGUI_LANDSCAPE;
    else process.env.ADT_SAPGUI_LANDSCAPE = previous;
  }
}

test('adt_create_destination: manual mode writes the workspace file and the registry sees it', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-tool-'));
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false });
  try {
    const create = destinationTools({ registry, ledger: new LockLedger() }, { get: () => undefined } as never).find((t) => t.name === 'adt_create_destination')!;
    const exec = { signal: undefined, agent: { session: { header: { cwd: ws } } } } as never;
    const result = (await create.execute(
      { name: 'impc-dev', url: 'https://sap.impc.example.com:44301', client: '100', language: 'ZH', username: 'DC_HUXF', setDefault: true } as never,
      exec,
    )) as Record<string, unknown>;
    assert.equal(result.action, 'created');
    assert.equal(result.setAsDefault, true);
    const file = join(ws, '.dsh-abap-adt', 'destinations.yaml');
    assert.equal(result.file, file);
    assert.equal(existsSync(file), true);
    assert.match(readFileSync(file, 'utf8'), /name: impc-dev/);
    assert.match(String(result.hint), /ADT_IMPC_DEV_PASSWORD/);
    // The registry view of the same workspace resolves it — hot-apply.
    assert.equal((await registry.require('impc-dev', ws)).config.url, 'https://sap.impc.example.com:44301');
    assert.equal((await registry.viewFor(ws)).defaultName, 'impc-dev');
  } finally {
    await registry.dispose();
    rmSync(ws, { recursive: true, force: true });
  }
});

test('adt_create_destination: password goes to the DSH credential store, only the reference lands in the file', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-tool-'));
  const store = new Map<string, string>();
  // Fake ctx: the credentials service stores values like ~/.dsh/.credentials.yaml.
  const fakeCtx = {
    get: (name: string) =>
      name === 'credentials'
        ? {
            resolve: async (ref: string) => (store.has(ref) ? { value: store.get(ref)!, source: 'file' } : undefined),
            set: async (ref: string, value: string) => void store.set(ref, value),
          }
        : undefined,
  } as never;
  const registry = await AdtRegistry.create(
    { ...builtinDefaults(), demo: false },
    { credentialResolver: async (ref) => store.get(ref) },
  );
  try {
    const create = destinationTools({ registry, ledger: new LockLedger() }, fakeCtx).find((t) => t.name === 'adt_create_destination')!;
    const exec = { signal: undefined, agent: { session: { header: { cwd: ws } } } } as never;
    const result = (await create.execute(
      { name: 'dev', url: 'https://dev.example.com', username: 'DEVUSER', password: 's3cret!' } as never,
      exec,
    )) as {
      passwordStoredIn?: string;
      destination: { passwordEnv?: string; password?: string };
      notes: string[];
    };
    assert.equal(result.passwordStoredIn, 'credential-store');
    // The store holds the secret under the convention reference…
    assert.equal(store.get('ADT_DEV_PASSWORD'), 's3cret!');
    // …the file (and the echoed destination) holds ONLY the reference.
    const file = join(ws, '.dsh-abap-adt', 'destinations.yaml');
    const raw = readFileSync(file, 'utf8');
    assert.match(raw, /passwordEnv: ADT_DEV_PASSWORD/);
    assert.doesNotMatch(raw, /s3cret/);
    assert.equal(result.destination.password, undefined);
    // The registry resolves the password through the credential layer.
    const entry = await registry.require('dev', ws);
    assert.deepEqual(entry.config.auth, { type: 'basic', username: 'DEVUSER', password: 's3cret!' });
  } finally {
    await registry.dispose();
    rmSync(ws, { recursive: true, force: true });
  }
});

test('adt_create_destination: no credential service (or passwordInFile) writes plaintext with a warning', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-tool-'));
  const noServiceCtx = { get: () => undefined } as never;
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false });
  try {
    const create = destinationTools({ registry, ledger: new LockLedger() }, noServiceCtx).find((t) => t.name === 'adt_create_destination')!;
    const exec = { signal: undefined, agent: { session: { header: { cwd: ws } } } } as never;
    // No service mounted -> plaintext fallback.
    const fallback = (await create.execute(
      { name: 'a', url: 'https://a.example.com', username: 'U', password: 'pw-a' } as never,
      exec,
    )) as { passwordStoredIn?: string; notes: string[] };
    assert.equal(fallback.passwordStoredIn, 'file');
    assert.ok(fallback.notes.some((n) => /PLAINTEXT/.test(n)));
    assert.match(readFileSync(join(ws, '.dsh-abap-adt', 'destinations.yaml'), 'utf8'), /password: pw-a/);

    // Explicit passwordInFile wins even with a service mounted.
    const store = new Map<string, string>();
    const serviceCtx = {
      get: (name: string) =>
        name === 'credentials'
          ? { resolve: async (r: string) => (store.has(r) ? { value: store.get(r)! } : undefined), set: async (r: string, v: string) => void store.set(r, v) }
          : undefined,
    } as never;
    const forced = (await create.execute(
      { name: 'b', url: 'https://b.example.com', username: 'U', password: 'pw-b', passwordInFile: true } as never,
      exec,
    )) as { passwordStoredIn?: string };
    assert.equal(forced.passwordStoredIn, 'file');
    assert.equal(store.size, 0, 'credential store untouched in file mode');
    assert.match(readFileSync(join(ws, '.dsh-abap-adt', 'destinations.yaml'), 'utf8'), /password: pw-b/);

    // A store that refuses the write (read-only source shadows it) falls back to the file.
    const refusingCtx = {
      get: (name: string) =>
        name === 'credentials'
          ? { resolve: async () => undefined, set: async () => { throw new Error('read-only source shadows ADT_C_PASSWORD'); } }
          : undefined,
    } as never;
    const createRefusing = destinationTools({ registry, ledger: new LockLedger() }, refusingCtx).find((t) => t.name === 'adt_create_destination')!;
    const refused = (await createRefusing.execute(
      { name: 'c', url: 'https://c.example.com', username: 'U', password: 'pw-c' } as never,
      exec,
    )) as { passwordStoredIn?: string; notes: string[] };
    assert.equal(refused.passwordStoredIn, 'file');
    assert.ok(refused.notes.some((n) => /refused the write/.test(n)));
  } finally {
    await registry.dispose();
    rmSync(ws, { recursive: true, force: true });
  }
});

test('adt_create_destination: a non-identifier passwordEnv is rejected before anything is written', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-tool-'));
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false });
  try {
    const create = destinationTools({ registry, ledger: new LockLedger() }, { get: () => undefined } as never).find((t) => t.name === 'adt_create_destination')!;
    const exec = { signal: undefined, agent: { session: { header: { cwd: ws } } } } as never;
    await assert.rejects(
      () => create.execute({ name: 'x', url: 'https://x.example.com', password: 'p', passwordEnv: 'not a ref!' } as never, exec),
      /not a valid credential reference/,
    );
    assert.equal(existsSync(join(ws, '.dsh-abap-adt')), false, 'nothing written on refusal');
  } finally {
    await registry.dispose();
    rmSync(ws, { recursive: true, force: true });
  }
});

test('adt_create_destination: import from a GUI reference entry (client/user/language carried over)', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-tool-'));
  const landscape = join(ws, 'SAPUILandscape.xml');
  mkdirSync(ws, { recursive: true });
  writeFileSync(landscape, LANDSCAPE_XML, 'utf8');
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false });
  try {
    const create = destinationTools({ registry, ledger: new LockLedger() }, { get: () => undefined } as never).find((t) => t.name === 'adt_create_destination')!;
    const exec = { signal: undefined, agent: { session: { header: { cwd: ws } } } } as never;
    const result = (await withLandscape(landscape, () =>
      create.execute({ guiUuid: 'svc-impc-dev-100' } as never, exec),
    )) as {
      action: string;
      destination: { name: string; url: string; client: string; language: string; username: string; strictSSL: boolean };
      importedFromGui?: { name: string };
      notes: string[];
    };
    assert.equal(result.action, 'created');
    assert.equal(result.destination.name, 'impc-s4-dev-100');
    assert.equal(result.destination.url, 'https://10.126.22.123:44301');
    assert.equal(result.destination.client, '100');
    assert.equal(result.destination.username, 'DC_HUXF');
    assert.equal(result.destination.language, 'ZH');
    assert.equal(result.destination.strictSSL, false, 'GUI imports default strictSSL off');
    assert.equal(result.importedFromGui?.name, 'IMPC S4 DEV 100');
    assert.ok(result.notes.some((n) => /strictSSL/.test(n)));
  } finally {
    await registry.dispose();
    rmSync(ws, { recursive: true, force: true });
  }
});

test('adt_create_destination: group GUI entry without an explicit url is refused with guidance', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-tool-'));
  const landscape = join(ws, 'SAPUILandscape.xml');
  mkdirSync(ws, { recursive: true });
  writeFileSync(landscape, LANDSCAPE_XML, 'utf8');
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false });
  try {
    const create = destinationTools({ registry, ledger: new LockLedger() }, { get: () => undefined } as never).find((t) => t.name === 'adt_create_destination')!;
    const exec = { signal: undefined, agent: { session: { header: { cwd: ws } } } } as never;
    await assert.rejects(
      () => withLandscape(landscape, () => create.execute({ guiUuid: 'svc-group' } as never, exec)),
      /load-balancing.*explicit .*url/s,
    );
    // …but succeeds when a url is supplied alongside.
    const result = (await withLandscape(landscape, () =>
      create.execute({ guiUuid: 'svc-group', url: 'https://wd.example.com' } as never, exec),
    )) as { action: string };
    assert.equal(result.action, 'created');
  } finally {
    await registry.dispose();
    rmSync(ws, { recursive: true, force: true });
  }
});

test('adt_create_destination: unknown guiUuid, duplicate guard and overwrite', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-tool-'));
  const landscape = join(ws, 'SAPUILandscape.xml');
  mkdirSync(ws, { recursive: true });
  writeFileSync(landscape, LANDSCAPE_XML, 'utf8');
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false });
  try {
    const create = destinationTools({ registry, ledger: new LockLedger() }, { get: () => undefined } as never).find((t) => t.name === 'adt_create_destination')!;
    const exec = { signal: undefined, agent: { session: { header: { cwd: ws } } } } as never;
    await assert.rejects(
      () => withLandscape(landscape, () => create.execute({ guiUuid: 'nope' } as never, exec)),
      /not found in the SAP GUI landscape.*adt_list_gui_connections/s,
    );

    const first = (await create.execute({ name: 'dev', url: 'https://dev.example.com' } as never, exec)) as { action: string };
    assert.equal(first.action, 'created');
    await assert.rejects(
      () => create.execute({ name: 'dev', url: 'https://other.example.com' } as never, exec),
      /already exists.*overwrite/s,
    );
    const updated = (await create.execute({ name: 'dev', url: 'https://other.example.com', overwrite: true } as never, exec)) as {
      action: string;
    };
    assert.equal(updated.action, 'updated');
    assert.equal((await registry.require('dev', ws)).config.url, 'https://other.example.com');
  } finally {
    await registry.dispose();
    rmSync(ws, { recursive: true, force: true });
  }
});

test('adt_list_gui_connections: matches by query; degrades to a helpful message without SAP GUI', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-tool-'));
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false });
  try {
    const list = destinationTools({ registry, ledger: new LockLedger() }, { get: () => undefined } as never).find((t) => t.name === 'adt_list_gui_connections')!;
    // No landscape at all.
    const none = (await withLandscape(join(ws, 'nowhere.xml'), () => list.execute({} as never, {} as never))) as {
      available: boolean;
      message?: string;
    };
    assert.equal(none.available, false);
    assert.match(none.message ?? '', /No SAP GUI/);

    // With a landscape: query filter + uuid passthrough.
    const landscape = join(ws, 'SAPUILandscape.xml');
    writeFileSync(landscape, LANDSCAPE_XML, 'utf8');
    const found = (await withLandscape(landscape, () => list.execute({ query: 'impc' } as never, {} as never))) as {
      available: boolean;
      connections: Array<{ uuid: string; name: string; adtUrl?: string }>;
    };
    assert.equal(found.available, true);
    assert.deepEqual(found.connections.map((c) => c.uuid).sort(), ['svc-group', 'svc-impc-dev', 'svc-impc-dev-100']);
    assert.equal(found.connections.find((c) => c.uuid === 'svc-impc-dev')?.adtUrl, 'https://10.126.22.123:44301');
  } finally {
    await registry.dispose();
    rmSync(ws, { recursive: true, force: true });
  }
});
