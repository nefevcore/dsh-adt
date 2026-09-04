import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { startAdtStubServer } from './helpers/stub-server.ts';
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

/** Bare entry with ONLY the required keys — everything else must template. */
const bareDest = (name: string, url = `https://${name}.example.com`) => ({ name, url }) as never;

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

test('WorkspaceConfigStore.write: unset options land as commented templates with their defaults', () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-ws-'));
  try {
    const store = new WorkspaceConfigStore();
    const { path } = store.write(dir, () => ({ destinations: [bareDest('dev')] }));
    const raw = readFileSync(path, 'utf8');
    // Set keys render as real lines…
    assert.match(raw, /- name: dev/);
    assert.match(raw, /url: https:\/\/dev\.example\.com/);
    // …every unset option as a commented template with its default + purpose.
    assert.match(raw, /# defaultDestination: dev +# destination used when a tool call omits/);
    assert.match(raw, /# client: "000" +# SAP client \(mandant\)/);
    assert.match(raw, /# language: EN +# logon language/);
    assert.match(raw, /# username: YOUR_USER +# ABAP user name/);
    assert.match(raw, /# password: CHANGE_ME +# plaintext password stored IN THIS FILE/);
    assert.match(raw, /# passwordEnv: ADT_DEV_PASSWORD +# credential reference/);
    assert.match(raw, /# strictSSL: true +# verify TLS certificates/);
    assert.match(raw, /# timeoutMs: 60000 +# request timeout in milliseconds/);
    assert.match(raw, /# policy: +# per-destination permission overrides/);
    assert.match(raw, /# enableTransports: true +# allow the transport tool family and transport usage \(or env SAP_ENABLE_TRANSPORTS\)/);
    // Unset keys stay comments only — no real default lines sneak in.
    assert.doesNotMatch(raw, /^defaultDestination:/m);
    assert.doesNotMatch(raw, /^ {4}strictSSL:/m);
    // …and the commented file still loads (comments are plain YAML).
    const loaded = store.load(dir)?.layer;
    assert.equal(loaded?.destinations?.[0]?.name, 'dev');
    assert.equal(loaded?.destinations?.[0]?.strictSSL, true, 'schema default applies on load');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('WorkspaceConfigStore.write: hand-set values survive rewrites; schema defaults never materialize', () => {
  const dir = mkdtempSync(join(tmpdir(), 'abap-adt-ws-'));
  try {
    const store = new WorkspaceConfigStore();
    store.write(dir, () => ({ destinations: [bareDest('dev')] }));
    // The user hand-edits the generated file by uncommenting lines.
    const file = join(dir, '.dsh-abap-adt', 'destinations.yaml');
    writeFileSync(
      file,
      readFileSync(file, 'utf8')
        .replace('# client: "000"', 'client: "200"')
        .replace('# timeoutMs: 60000', 'timeoutMs: 45000')
        .replace('# enableTransports: true', 'enableTransports: false'),
      'utf8',
    );
    // A later managed write adds another destination.
    store.write(dir, (current) => ({
      ...current,
      destinations: [...(current.destinations ?? []), bareDest('qas')],
    }));
    const next = readFileSync(file, 'utf8');
    // Hand-set values are kept…
    assert.match(next, /^ {4}client: "200"/m);
    assert.match(next, /^ {4}timeoutMs: 45000/m);
    assert.match(next, /^enableTransports: false/m);
    // …the new entry gets its own template menu (per-entry ref name)…
    assert.match(next, /# passwordEnv: ADT_QAS_PASSWORD/);
    // …and schema defaults are never materialized as real lines.
    assert.doesNotMatch(next, /^demo:/m);
    assert.doesNotMatch(next, /^demoPort:/m);
    assert.doesNotMatch(next, /^defaultDestination:/m);
    assert.doesNotMatch(next, /^ {4}strictSSL:/m);
    // The validated load still composes both destinations and the edits.
    const loaded = store.load(dir)?.layer;
    assert.deepEqual(loaded?.destinations?.map((d) => d.name), ['dev', 'qas']);
    assert.equal(loaded?.destinations?.[0]?.client, '200');
    assert.equal(loaded?.destinations?.[0]?.timeoutMs, 45_000);
    assert.equal(loaded?.enableTransports, false);
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
    const raw = readFileSync(file, 'utf8');
    assert.match(raw, /name: impc-dev/);
    // Unset options ride along as commented templates (self-documenting file):
    // per-destination password reference + file-level default hint.
    assert.match(raw, /# passwordEnv: ADT_IMPC_DEV_PASSWORD/);
    assert.match(raw, /# timeoutMs: 60000/);
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

test('adt_create_destination: policy knobs land in the entry policy block and take effect', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-tool-'));
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false });
  try {
    const create = destinationTools({ registry, ledger: new LockLedger() }, { get: () => undefined } as never).find((t) => t.name === 'adt_create_destination')!;
    const exec = { signal: undefined, agent: { session: { header: { cwd: ws } } } } as never;
    const result = (await create.execute(
      {
        name: 'pr',
        url: 'https://pr.example.com',
        enableTransports: false,
        allowedPackages: 'Z*,$TMP',
        allowBatchWrites: true,
      } as never,
      exec,
    )) as { destination: { policy?: Record<string, unknown> } };
    // Echoed back exactly as passed.
    assert.deepEqual(result.destination.policy, { enableTransports: false, allowedPackages: 'Z*,$TMP', allowBatchWrites: true });
    // The file: set policy keys are real lines inside the entry block…
    const raw = readFileSync(join(ws, '.dsh-abap-adt', 'destinations.yaml'), 'utf8');
    assert.match(raw, /^ {4}policy:/m);
    assert.match(raw, /^ {6}enableTransports: false$/m);
    assert.match(raw, /^ {6}allowedPackages: Z\*,\$TMP$/m);
    assert.match(raw, /^ {6}allowBatchWrites: true$/m);
    // …the keys NOT passed stay commented templates inside the block.
    assert.match(raw, /^ {6}# allowedTransports: "\*"/m);
    assert.match(raw, /^ {6}# allowExecution: true/m);
    assert.doesNotMatch(raw, /^ {6}allowExecution:/m);
    // Effective policy: per-destination overrides apply, unset keys inherit.
    const entry = await registry.require('pr', ws);
    assert.equal(entry.policy.enableTransports, false, 'per-destination override');
    assert.equal(entry.policy.allowBatchWrites, true);
    assert.equal(entry.policy.allowExecution, true, 'unset key inherits the global default');
    assert.deepEqual(entry.policy.allowedPackages, ['Z*', '$TMP']);
  } finally {
    await registry.dispose();
    rmSync(ws, { recursive: true, force: true });
  }
});

test('adt_create_destination: read-side knobs and the environment profile land and take effect', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-tool-'));
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false });
  try {
    const create = destinationTools({ registry, ledger: new LockLedger() }, { get: () => undefined } as never).find((t) => t.name === 'adt_create_destination')!;
    const exec = { signal: undefined, agent: { session: { header: { cwd: ws } } } } as never;
    const result = (await create.execute(
      {
        name: 'qa2',
        url: 'https://qa2.example.com',
        profile: 'qa',
        blockedTablesProfile: 'standard',
        blockedTables: ['ZSECRET*'],
        allowedTables: ['KNA1'],
      } as never,
      exec,
    )) as { destination: { profile?: string; policy?: Record<string, unknown> } };
    // The profile rides as a destination-level key; read-side knobs in policy.
    assert.equal(result.destination.profile, 'qa');
    assert.deepEqual(result.destination.policy, {
      blockedTablesProfile: 'standard',
      blockedTables: ['ZSECRET*'],
      allowedTables: ['KNA1'],
    });
    // Effective policy: qa tier closes the unset execution knob…
    const entry = await registry.require('qa2', ws);
    assert.equal(entry.policy.profile, 'qa');
    assert.equal(entry.policy.allowExecution, false, 'qa defaults execution to closed');
    assert.equal(entry.policy.blockedTablesProfile, 'standard');
    assert.throws(() => entry.policy.assertTableReadsAllowed(['USR02'], 'x'), /blockedTables/);
    assert.doesNotThrow(() => entry.policy.assertTableReadsAllowed(['KNA1'], 'x'));
    // The file: profile as a real line, read-side keys inside the policy block.
    const raw = readFileSync(join(ws, '.dsh-abap-adt', 'destinations.yaml'), 'utf8');
    assert.match(raw, /^ {4}profile: qa$/m);
    assert.match(raw, /^ {6}blockedTablesProfile: standard$/m);
    // Invalid profile values are refused before anything is written.
    await assert.rejects(
      () => create.execute({ name: 'bad', url: 'https://bad.example.com', profile: 'prod' } as never, exec),
      /profile/,
    );
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
      create.execute({ guiUuid: 'svc-impc-dev-100', probe: false } as never, exec),
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

    // With a landscape: query filter + uuid passthrough (probe off — the
    // fixture hosts are RFC1918 addresses that must never be contacted).
    const landscape = join(ws, 'SAPUILandscape.xml');
    writeFileSync(landscape, LANDSCAPE_XML, 'utf8');
    const found = (await withLandscape(landscape, () => list.execute({ query: 'impc', probe: false } as never, {} as never))) as {
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

// ---------------------------------------------------------------------------
// GUI URL probing (candidate combos verified against a LOCAL server)
// ---------------------------------------------------------------------------

/** Minimal one-entry landscape pointing at `host` with instance number nn. */
function singleEntryLandscapeXml(host: string, sysnr: string): string {
  return `<?xml version="1.0"?>
<Landscape version="1">
\t<Services>
\t\t<Service type="SAPGUI" uuid="svc-local" name="LOCAL PROBE SYS" systemid="L01" mode="1" server="${host}:32${sysnr}" sncop="-1" dcpg="2"/>
\t</Services>
</Landscape>
`;
}

interface ToolResult {
  action: string;
  notes: string[];
  hint: string;
  destination: { name: string; url: string };
  urlVerified?: { ok: boolean; url?: string; status?: number; detail: string };
}

test('adt_list_gui_connections: probes the combos and reports the url that ACTUALLY answers', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-probe-'));
  const { server, port } = await startAdtStubServer(401);
  const sysnr = String(port - 8000).padStart(2, '0');
  const landscape = join(ws, 'SAPUILandscape.xml');
  writeFileSync(landscape, singleEntryLandscapeXml('127.0.0.1', sysnr), 'utf8');
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false });
  try {
    const list = destinationTools({ registry, ledger: new LockLedger() }, { get: () => undefined } as never).find((t) => t.name === 'adt_list_gui_connections')!;
    const found = (await withLandscape(landscape, () =>
      list.execute({ query: 'LOCAL', probeTimeoutMs: 2000 } as never, {} as never),
    )) as {
      connections: Array<{
        adtUrl?: string;
        probe?: { reachable: boolean; verifiedUrl?: string; status?: number; detail: string; tried: unknown[] };
      }>;
    };
    const conn = found.connections[0]!;
    // Naive derivation guesses the https convention port…
    assert.equal(conn.adtUrl, `https://127.0.0.1:443${sysnr}`);
    // …but the probe found the local plain-HTTP stub instead.
    assert.equal(conn.probe?.reachable, true);
    assert.equal(conn.probe?.verifiedUrl, `http://127.0.0.1:${port}`);
    assert.equal(conn.probe?.status, 401);
    assert.match(conn.probe?.detail ?? '', /did not respond/);
    assert.equal(conn.probe?.tried.length, 4);
  } finally {
    await registry.dispose();
    server.close();
    rmSync(ws, { recursive: true, force: true });
  }
});

test('adt_list_gui_connections: unreachable host gets guidance, not a silent guess', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-probe-'));
  const landscape = join(ws, 'SAPUILandscape.xml');
  writeFileSync(landscape, singleEntryLandscapeXml('host-that-cannot-resolve.invalid', '07'), 'utf8');
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false });
  try {
    const list = destinationTools({ registry, ledger: new LockLedger() }, { get: () => undefined } as never).find((t) => t.name === 'adt_list_gui_connections')!;
    const found = (await withLandscape(landscape, () =>
      list.execute({ query: 'LOCAL', probeTimeoutMs: 1000 } as never, {} as never),
    )) as {
      connections: Array<{ probe?: { reachable: boolean; detail: string } }>;
    };
    const probe = found.connections[0]?.probe;
    assert.equal(probe?.reachable, false);
    assert.match(probe?.detail ?? '', /tried:/);
    assert.match(probe?.detail ?? '', /https:\/\/host-that-cannot-resolve\.invalid:44307/);
  } finally {
    await registry.dispose();
    rmSync(ws, { recursive: true, force: true });
  }
});

test('adt_create_destination: GUI import uses the probe-verified candidate instead of the failed guess', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-probe-'));
  const { server, port } = await startAdtStubServer(401);
  const sysnr = String(port - 8000).padStart(2, '0');
  const landscape = join(ws, 'SAPUILandscape.xml');
  writeFileSync(landscape, singleEntryLandscapeXml('127.0.0.1', sysnr), 'utf8');
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false });
  try {
    const create = destinationTools({ registry, ledger: new LockLedger() }, { get: () => undefined } as never).find((t) => t.name === 'adt_create_destination')!;
    const exec = { signal: undefined, agent: { session: { header: { cwd: ws } } } } as never;
    const result = (await withLandscape(landscape, () =>
      create.execute({ guiUuid: 'svc-local', probeTimeoutMs: 2000 } as never, exec),
    )) as ToolResult;
    assert.equal(result.action, 'created');
    // The destination carries the URL that actually responded, and the
    // correction is explained — not silently papered over.
    assert.equal(result.destination.url, `http://127.0.0.1:${port}`);
    assert.equal(result.urlVerified?.ok, true);
    assert.equal(result.urlVerified?.url, `http://127.0.0.1:${port}`);
    assert.ok(result.notes.some((n) => /did not respond; using probed/.test(n)));
    assert.equal((await registry.require('local-probe-sys', ws)).config.url, `http://127.0.0.1:${port}`);
  } finally {
    await registry.dispose();
    server.close();
    rmSync(ws, { recursive: true, force: true });
  }
});

test('adt_create_destination: unprovable GUI import is REFUSED unless force; force saves it loudly marked', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-probe-'));
  const landscape = join(ws, 'SAPUILandscape.xml');
  writeFileSync(landscape, singleEntryLandscapeXml('host-that-cannot-resolve.invalid', '07'), 'utf8');
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false });
  try {
    const create = destinationTools({ registry, ledger: new LockLedger() }, { get: () => undefined } as never).find((t) => t.name === 'adt_create_destination')!;
    const exec = { signal: undefined, agent: { session: { header: { cwd: ws } } } } as never;
    // Without force: refusal, nothing written, guidance in the error.
    await assert.rejects(
      () => withLandscape(landscape, () => create.execute({ guiUuid: 'svc-local', probeTimeoutMs: 1000 } as never, exec)),
      (error: unknown) => {
        const message = (error as Error).message;
        return message.includes('NOT saved') && message.includes('unusable') && message.includes('force: true');
      },
    );
    assert.equal(existsSync(join(ws, '.dsh-abap-adt')), false, 'nothing written on refusal');
    // force: true saves it — but never silently "ok".
    const forced = (await withLandscape(landscape, () =>
      create.execute({ guiUuid: 'svc-local', probeTimeoutMs: 1000, force: true } as never, exec),
    )) as ToolResult;
    assert.equal(forced.action, 'created');
    assert.equal(forced.destination.url, 'https://host-that-cannot-resolve.invalid:44307');
    assert.equal(forced.urlVerified?.ok, false);
    assert.match(forced.urlVerified?.detail ?? '', /tried:/);
    assert.ok(forced.notes.some((n) => /UNVERIFIED/.test(n)));
    assert.match(forced.hint, /UNVERIFIED/);
    const rendered = (create.output.render({}, forced as never) as unknown as Array<{ text: string }>)[0]!.text;
    assert.match(rendered, /url UNVERIFIED/);
  } finally {
    await registry.dispose();
    rmSync(ws, { recursive: true, force: true });
  }
});

test('adt_create_destination: connect-level ping failure refuses to save unless force', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-probe-'));
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false });
  try {
    const create = destinationTools({ registry, ledger: new LockLedger() }, { get: () => undefined } as never).find((t) => t.name === 'adt_create_destination')!;
    const exec = { signal: undefined, agent: { session: { header: { cwd: ws } } } } as never;
    // ping BEFORE save: no HTTP status = connect-level → refuse, no file.
    await assert.rejects(
      () =>
        create.execute(
          { name: 'dead', url: 'https://host-that-cannot-resolve.invalid', ping: true, timeoutMs: 3000 } as never,
          exec,
        ),
      (error: unknown) => {
        const message = (error as Error).message;
        return message.includes('NOT saved') && message.includes('ping cannot reach') && message.includes('force: true');
      },
    );
    assert.equal(existsSync(join(ws, '.dsh-abap-adt')), false, 'nothing written on refusal');
    // force overrides: saved with the failed ping reported honestly.
    const forced = (await create.execute(
      { name: 'dead', url: 'https://host-that-cannot-resolve.invalid', ping: true, timeoutMs: 3000, force: true } as never,
      exec,
    )) as ToolResult & { ping?: { ok: boolean; detail: string } };
    assert.equal(forced.action, 'created');
    assert.equal(forced.ping?.ok, false);
    // Connect-level failure OR its timeout form — both are the honest
    // "cannot reach" report; which one depends on how fast the resolver
    // fails .invalid (fast NXDOMAIN → "failed", slow CI resolver → "timed out").
    assert.match(forced.ping?.detail ?? '', /(failed|timed out)/i);
  } finally {
    await registry.dispose();
    rmSync(ws, { recursive: true, force: true });
  }
});

test('adt_create_destination: HTTP-level ping failure (401) proves the url alive — saved with a note', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-probe-'));
  const { server, port } = await startAdtStubServer(401);
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false });
  try {
    const create = destinationTools({ registry, ledger: new LockLedger() }, { get: () => undefined } as never).find((t) => t.name === 'adt_create_destination')!;
    const exec = { signal: undefined, agent: { session: { header: { cwd: ws } } } } as never;
    const result = (await create.execute(
      { name: 'authcheck', url: `http://127.0.0.1:${port}`, ping: true, timeoutMs: 5000 } as never,
      exec,
    )) as ToolResult & { ping?: { ok: boolean; detail: string } };
    // The stub answers 401 to everything: url reachable, auth rejected →
    // the destination is KEPT and the failure explained.
    assert.equal(result.action, 'created');
    assert.equal(result.ping?.ok, false);
    assert.match(result.ping?.detail ?? '', /401/);
    assert.ok(result.notes.some((n) => /ping FAILED before saving/.test(n)));
    assert.equal(existsSync(join(ws, '.dsh-abap-adt', 'destinations.yaml')), true);
  } finally {
    await registry.dispose();
    server.close();
    rmSync(ws, { recursive: true, force: true });
  }
});

test('adt_list_gui_connections: a port that answers HTTP without ADT is INCONCLUSIVE, never "probe OK"', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-probe-'));
  const { server, port } = await startAdtStubServer(404);
  const sysnr = String(port - 8000).padStart(2, '0');
  const landscape = join(ws, 'SAPUILandscape.xml');
  writeFileSync(landscape, singleEntryLandscapeXml('127.0.0.1', sysnr), 'utf8');
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false });
  try {
    const list = destinationTools({ registry, ledger: new LockLedger() }, { get: () => undefined } as never).find((t) => t.name === 'adt_list_gui_connections')!;
    const found = (await withLandscape(landscape, () =>
      list.execute({ query: 'LOCAL', probeTimeoutMs: 2000 } as never, {} as never),
    )) as {
      connections: Array<{ probe?: { reachable: boolean; verifiedUrl?: string; detail: string } }>;
    };
    // Something responded (reachable), but a 404 is NOT a usable ADT url —
    // verifiedUrl stays absent instead of a misleading "probe OK".
    const probe = found.connections[0]?.probe;
    assert.equal(probe?.reachable, true);
    assert.equal(probe?.verifiedUrl, undefined);
    assert.match(probe?.detail ?? '', /no working ADT endpoint/);
    // The render carries the same honest verdict.
    const rendered = (list.output.render({}, found as never) as unknown as Array<{ text: string }>)[0]!.text;
    assert.match(rendered, /probe INCONCLUSIVE/);
    assert.doesNotMatch(rendered, /probe OK/);
  } finally {
    await registry.dispose();
    server.close();
    rmSync(ws, { recursive: true, force: true });
  }
});
