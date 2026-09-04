import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hostProfileOf, type HostProfile } from '../lib/hostprofile.js';
import { AdtRegistry } from '../lib/registry.js';
import { LockLedger } from '../lib/locks.js';
import { builtinDefaults } from '../lib/config.js';
import { destinationTools } from '../lib/tools/destinations.js';

/**
 * Host environment detection (core src/hostprofile.ts): declared profiles
 * voice the credential-store wording for THEIR host; undeclared hosts get
 * capability-inferred, host-neutral wording — a machine without DSH must
 * never be told to edit ~/.dsh/... files.
 */

/** The profile the DSH plugin declares (kept in lockstep with its index.ts). */
const DSH_LIKE: HostProfile = {
  id: 'dsh',
  label: 'DSH',
  credentialStore: { label: 'DSH credential store', locationHint: '~/.dsh/.credentials.yaml' },
  passwordResolution: 'process env > ~/.dsh/.credentials.yaml > .env files',
  globalConfigHint: 'overrides ~/.dsh/settings.yaml `abap-adt:`',
  workspaceConfigDir: '.dsh-abap-adt',
};

/** A host with no secret store anywhere (declared standalone embedding). */
const STANDALONE_LIKE: HostProfile = {
  id: 'standalone',
  label: 'the runtime',
  passwordResolution: 'process environment variables only',
};

/** A writable in-memory credential service, as the DSH/AgentChat hosts mount. */
const serviceHost = (store: Map<string, string>, profile?: unknown) =>
  ({
    get: (n: string) => {
      if (n === 'host') return profile;
      if (n === 'credentials') {
        return {
          resolve: async (r: string) => (store.has(r) ? { value: store.get(r)! } : undefined),
          set: async (r: string, v: string) => void store.set(r, v),
        };
      }
      return undefined;
    },
  }) as never;

/** A host with NO credential service at all (bare embedding). */
const bareHost = (profile?: unknown) =>
  ({ get: (n: string) => (n === 'host' ? profile : undefined) }) as never;

// ---------------------------------------------------------------------------
// hostProfileOf: declaration wins, capability inference otherwise
// ---------------------------------------------------------------------------

test('hostProfileOf: a valid declared profile wins over inference', () => {
  assert.equal(hostProfileOf(serviceHost(new Map(), DSH_LIKE)).id, 'dsh');
  assert.equal(hostProfileOf(bareHost(DSH_LIKE)).id, 'dsh');
});

test('hostProfileOf: invalid declarations are ignored — capability inference applies', () => {
  // Not a HostProfile shape (no usable id/label/passwordResolution).
  const garbage = { id: 42, label: null };
  assert.equal(hostProfileOf(serviceHost(new Map(), garbage)).id, 'host');
  assert.equal(hostProfileOf(bareHost(garbage)).id, 'standalone');
  // A declared store without a label is unusable for wording, dropped too.
  assert.equal(hostProfileOf(serviceHost(new Map(), { id: 'x', label: 'X', passwordResolution: 'p', credentialStore: {} })).id, 'host');
});

test('hostProfileOf: credential service mounted -> generic store profile; none -> standalone', () => {
  assert.equal(hostProfileOf(serviceHost(new Map())).credentialStore?.label, 'host credential store');
  const standalone = hostProfileOf(bareHost());
  assert.equal(standalone.credentialStore, undefined);
  assert.match(standalone.passwordResolution, /process environment variables only/);
});

// ---------------------------------------------------------------------------
// adt_create_destination wording per host form
// ---------------------------------------------------------------------------

interface CreateOutcome {
  passwordStoredIn?: string;
  notes: string[];
  hint: string;
  file: string;
  destination: Record<string, unknown>;
}

async function runCreate(
  ctx: unknown,
  args: Record<string, unknown>,
  registryProfile?: HostProfile,
): Promise<{ result: CreateOutcome; raw: string; tool: { description: string; parameters: { properties: Record<string, { description?: string }> } } }> {
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-hostprofile-'));
  // The registry is the STORAGE authority (host profile fixes the config dir
  // + file-comment voice); the ctx declaration drives the live wording.
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false }, { hostProfile: registryProfile });
  try {
    const tool = destinationTools({ registry, ledger: new LockLedger() }, ctx as never).find((t) => t.name === 'adt_create_destination')!;
    const exec = { signal: undefined, agent: { session: { header: { cwd: ws } } } } as never;
    const result = (await tool.execute(args as never, exec)) as unknown as CreateOutcome;
    const raw = readFileSync(join(ws, ...registry.workspaceConfigDir.split(/[\\/]/), 'destinations.yaml'), 'utf8');
    return {
      result,
      raw,
      tool: {
        description: tool.description,
        parameters: tool.parameters as unknown as { properties: Record<string, { description?: string }> },
      },
    };
  } finally {
    await registry.dispose();
    rmSync(ws, { recursive: true, force: true });
  }
}

test('declared DSH host: wording names the DSH credential store byte-for-byte', async () => {
  const store = new Map<string, string>();
  const { result, raw, tool } = await runCreate(serviceHost(store, DSH_LIKE), {
    name: 'dev', url: 'https://dev.example.com', username: 'DEVUSER', password: 's3cret!',
  }, DSH_LIKE);
  assert.equal(result.passwordStoredIn, 'credential-store');
  assert.ok(
    result.notes.includes(
      'password stored in the DSH credential store (reference ADT_DEV_PASSWORD; backing file ~/.dsh/.credentials.yaml) — destinations.yaml keeps only the reference',
    ),
  );
  // Tool descriptions carry the DSH vocabulary for the agent…
  assert.match(tool.description, /stored in the DSH credential store \(~\/\.dsh\/\.credentials\.yaml, referenced/);
  assert.match(tool.parameters.properties.password!.description!, /Stored in the DSH credential store \(~\/\.dsh\/\.credentials\.yaml\)/);
  assert.match(
    tool.parameters.properties.passwordEnv!.description!,
    /DSH resolves it layer-wise: process env > ~\/\.dsh\/\.credentials\.yaml > \.env files\./,
  );
  // …and the workspace file header/comment speak DSH's config layers (the
  // registry carries the same DSH profile — the storage authority).
  assert.match(raw, /# Layering: this file overrides ~\/\.dsh\/settings\.yaml `abap-adt:` \(nearest wins\)\./);
  assert.match(raw, /passwordEnv: ADT_DEV_PASSWORD/);
  assert.match(raw, /# password: CHANGE_ME\s+# plaintext password stored IN THIS FILE — prefer passwordEnv \(process env > ~\/\.dsh\/\.credentials\.yaml > \.env files\)/);
});

test('declared workspaceConfigDir relocates the destinations file (AgentChat-style host)', async () => {
  const AC_PROFILE: HostProfile = {
    id: 'agentchat',
    label: 'AgentChat',
    credentialStore: { label: 'AgentChat encrypted credential store' },
    passwordResolution: 'AgentChat credential store > process env',
    workspaceConfigDir: '.agentchat/abap-adt',
  };
  const ws = mkdtempSync(join(tmpdir(), 'abap-adt-hostprofile-'));
  const store = new Map<string, string>();
  // Storage authority = the registry's profile (declared at create); the
  // ctx declaration voices the live wording — same host on both seams.
  const registry = await AdtRegistry.create({ ...builtinDefaults(), demo: false }, { hostProfile: AC_PROFILE });
  try {
    assert.equal(registry.workspaceConfigDir, '.agentchat/abap-adt');
    const tool = destinationTools({ registry, ledger: new LockLedger() }, serviceHost(store, AC_PROFILE)).find((t) => t.name === 'adt_create_destination')!;
    // The description tells the agent where THIS host keeps the file — and
    // never presumes the DSH-style directory.
    assert.match(tool.description, /\.agentchat\/abap-adt\/destinations\.yaml/);
    assert.doesNotMatch(tool.description, /\.dsh-abap-adt/);
    const exec = { signal: undefined, agent: { session: { header: { cwd: ws } } } } as never;
    const result = (await tool.execute(
      { name: 'ac', url: 'https://ac.example.com', username: 'U', password: 'pw' } as never,
      exec,
    )) as { file: string; notes: string[] };
    assert.equal(result.file, join(ws, '.agentchat', 'abap-adt', 'destinations.yaml'));
    assert.ok(result.notes.some((n) => n.includes('AgentChat encrypted credential store')));
    // The read path follows the same registry dir — the relocated file is live.
    assert.equal((await registry.viewFor(ws)).destinations.has('ac'), true);
  } finally {
    await registry.dispose();
    rmSync(ws, { recursive: true, force: true });
  }
});

test('declared DSH host without a password: the hint points at the DSH store', async () => {
  const { result } = await runCreate(serviceHost(new Map(), DSH_LIKE), {
    name: 'dev', url: 'https://dev.example.com', username: 'DEVUSER',
  }, DSH_LIKE);
  assert.equal(
    result.hint,
    'set the password under reference ADT_DEV_PASSWORD (DSH credential store ~/.dsh/.credentials.yaml or an env var of that name), then verify with adt_ping',
  );
});

test('undeclared host with a credential service: generic wording, zero ~/.dsh mentions', async () => {
  const store = new Map<string, string>();
  const { result, raw, tool } = await runCreate(serviceHost(store), {
    name: 'qa', url: 'https://qa.example.com', username: 'QAUSER', password: 'pw',
  });
  assert.equal(result.passwordStoredIn, 'credential-store');
  assert.ok(
    result.notes.includes(
      'password stored in the host credential store (reference ADT_QA_PASSWORD) — destinations.yaml keeps only the reference',
    ),
  );
  // Nothing — notes, file, tool description — presumes DSH.
  assert.doesNotMatch(JSON.stringify(result) + raw + tool.description + JSON.stringify(tool.parameters), /\.dsh\/|DSH/);
  assert.match(raw, /# Layering: this file overrides the global abap-adt configuration \(nearest wins\)\./);
  assert.match(raw, /passwordEnv: ADT_QA_PASSWORD/);
  // Registry carries NO profile (undeclared host) → host-neutral file comments.
  assert.match(raw, /# password: CHANGE_ME\s+# plaintext password stored IN THIS FILE — prefer passwordEnv \(process env \/ host credential store\)/);
  assert.match(tool.parameters.properties.passwordEnv!.description!, /the host resolves it layer-wise: host credential store > process env\./);
});

test('no credential service (machine without a secret store): plaintext fallback says env vars', async () => {
  const { result, raw, tool } = await runCreate(bareHost(), {
    name: 'prd', url: 'https://prd.example.com', username: 'PRDUSER', password: 'pw',
  });
  assert.equal(result.passwordStoredIn, 'file');
  assert.ok(
    result.notes.includes(
      'no host credential store on the runtime: password written PLAINTEXT into destinations.yaml — do not commit this file; prefer exporting ADT_PRD_PASSWORD as an environment variable',
    ),
  );
  assert.match(raw, /password: pw/);
  assert.match(tool.parameters.properties.password!.description!, /No credential store on the runtime: written PLAINTEXT/);
  assert.match(tool.parameters.properties.passwordEnv!.description!, /It resolves through process environment variables only\./);
  // Without a password supplied, the hint names env vars (not a DSH file)…
  const followUp = await runCreate(bareHost(STANDALONE_LIKE), { name: 'prd2', url: 'https://prd2.example.com', username: 'U' }, STANDALONE_LIKE);
  assert.equal(
    followUp.result.hint,
    'set the password under reference ADT_PRD2_PASSWORD (an environment variable of that name), then verify with adt_ping',
  );
  // …and the file's commented passwordEnv template carries the env-only chain.
  assert.match(followUp.raw, /# passwordEnv: ADT_PRD2_PASSWORD\s+# credential reference: process environment variables only/);
});

test('read-only credential service (no set): distinct not-writable wording', async () => {
  const readOnly = {
    get: (n: string) =>
      n === 'credentials'
        ? { resolve: async () => undefined } // resolves, but cannot store
        : undefined,
  } as never;
  const { result } = await runCreate(readOnly, {
    name: 'ro', url: 'https://ro.example.com', username: 'U', password: 'pw',
  });
  assert.equal(result.passwordStoredIn, 'file');
  assert.ok(
    result.notes.includes(
      'the host credential store is mounted but cannot store values: password written PLAINTEXT into destinations.yaml — do not commit this file; prefer exporting ADT_RO_PASSWORD as an environment variable',
    ),
  );
});
