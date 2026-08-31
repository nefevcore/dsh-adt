/**
 * LIVE destination verification: exercise the rebuilt plugin tool layer
 * against a REAL ADT system configured in ~/.dsh/settings.yaml (abap-adt
 * section). Complements scripts/smoke-tools.mjs (which runs against the
 * in-process mock): this one proves the backend-compatibility fixes on real
 * hardware — kind-aware structure resolution, message-class create/read/
 * write, activation-after-unlock, dump metadata parsing.
 *
 * Usage:  node scripts/verify-destination.mjs [destinationName]
 * (default: the abap-adt.defaultDestination; demo destination is rejected.)
 */
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { AdtRegistry } from '../packages/dsh-plugin-abap-adt/lib/registry.js';
import { LockLedger } from '../packages/dsh-plugin-abap-adt/lib/locks.js';
import { structureTools } from '../packages/dsh-plugin-abap-adt/lib/tools/structure.js';
import { objectTools } from '../packages/dsh-plugin-abap-adt/lib/tools/objects.js';
import { writeTools } from '../packages/dsh-plugin-abap-adt/lib/tools/write.js';
import { dumpTools } from '../packages/dsh-plugin-abap-adt/lib/tools/dumps.js';

const exec = { signal: undefined };
const ctx = { get: () => undefined };

// --- load destination config from ~/.dsh/settings.yaml -----------------------
const settingsPath = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'settings.yaml');
const settings = parse(await readFile(settingsPath, 'utf8'));
const abap = settings['abap-adt'];
if (!abap) {
  console.error(`no abap-adt section in ${settingsPath}`);
  process.exit(1);
}
const destName = process.argv[2] ?? abap.defaultDestination;
const dest = (abap.destinations ?? []).find((d) => d.name === destName);
if (!dest) {
  console.error(`destination '${destName}' not found in ${settingsPath}`);
  process.exit(1);
}

const registry = await AdtRegistry.create({
  demo: false,
  defaultDestination: destName,
  destinations: [dest],
});
const deps = { registry, ledger: new LockLedger() };
const by = new Map(
  [...structureTools(deps), ...objectTools(deps), ...writeTools(deps, ctx), ...dumpTools(deps)].map((t) => [
    t.name,
    t,
  ]),
);

let pass = 0;
let fail = 0;
const check = async (label, fn) => {
  try {
    await fn();
    pass++;
    console.log(`PASS ${label}`);
  } catch (e) {
    fail++;
    console.log(`FAIL ${label}: ${(e instanceof Error ? e.message : String(e)).slice(0, 220)}`);
  }
};
const call = (name, args) => by.get(name).execute({ ...args, destination: destName }, exec);

const runId = Date.now().toString(36).toUpperCase();

// 1. Structure reads resolve by KIND (same-name DDIC objects across categories)
await check('adt_read_structure DOMA by name+kind', async () => {
  const r = await call('adt_read_structure', { name: 'CHAR10', kind: 'DOMA' });
  if (r.properties?.datatype !== 'CHAR') throw new Error(`unexpected properties ${JSON.stringify(r.properties)}`);
});
await check('adt_read_structure DTEL labels', async () => {
  const r = await call('adt_read_structure', { name: 'BUKRS', kind: 'DTEL' });
  if (!r.labels || Object.keys(r.labels).length === 0) throw new Error('no labels parsed');
});

// 2. Message class lifecycle: create → write message → read back → delete
const msgName = `ZDSH_VERIFY_${runId}`.slice(0, 20);
let msgCreated = false;
await check('adt_create_object MSAG', async () => {
  await call('adt_create_object', { type: 'MSAG', name: msgName, description: 'verify script', packageName: '$TMP' });
  msgCreated = true;
});
if (msgCreated) {
  await check('adt_write_structure MSAG message', async () => {
    const r = await call('adt_write_structure', {
      name: msgName,
      kind: 'MSAG',
      packageName: '$TMP',
      messages: [{ number: '001', text: 'verify &1' }],
    });
    if (!r.changed?.length) throw new Error('nothing changed');
  });
  await check('adt_read_structure MSAG round-trip', async () => {
    const r = await call('adt_read_structure', { name: msgName, kind: 'MSAG' });
    if (!r.messages?.some((m) => m.number === '001')) throw new Error('message 001 missing');
  });
  await check('adt_delete_object MSAG', async () => {
    await call('adt_delete_object', { name: msgName, type: 'MSAG', packageName: '$TMP' });
  });
}

// 3. Class write+activate in one call (activation AFTER unlock — 403 fix)
const clsName = `ZCL_DSH_VERIFY_${runId}`.slice(0, 30);
let clsCreated = false;
await check('adt_create_object CLAS', async () => {
  await call('adt_create_object', { type: 'CLAS', name: clsName, description: 'verify script', packageName: '$TMP' });
  clsCreated = true;
});
if (clsCreated) {
  await check('adt_write_object activate:true', async () => {
    const r = await call('adt_write_object', {
      name: clsName,
      type: 'CLAS',
      activate: true,
      source:
        `CLASS ${clsName.toLowerCase()} DEFINITION PUBLIC FINAL CREATE PUBLIC.\n` +
        '  PUBLIC SECTION.\n' +
        '    INTERFACES if_oo_adt_classrun.\n' +
        'ENDCLASS.\n' +
        `CLASS ${clsName.toLowerCase()} IMPLEMENTATION.\n` +
        '  METHOD if_oo_adt_classrun~main.\n' +
        "    out->write( 'verify ok' ).\n" +
        '  ENDMETHOD.\n' +
        'ENDCLASS.\n',
    });
    if (r.activated !== true) throw new Error(`activated=${r.activated} ${JSON.stringify(r.activation)}`);
  });
  await check('adt_delete_object CLAS', async () => {
    await call('adt_delete_object', { name: clsName, type: 'CLAS', packageName: '$TMP' });
  });
}

// 4. Runtime dumps: list + default view carries metadata sections
await check('adt_get_dump default view metadata', async () => {
  const list = await call('adt_list_dumps', { top: 1 });
  if (!list.dumps.length) return; // no dumps on the system — nothing to verify
  const d = await call('adt_get_dump', { dumpId: list.dumps[0].id });
  if (!d.sections?.length && d.raw === undefined) throw new Error('neither sections nor raw content');
});

await registry.dispose();
console.log(`\n${destName}: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
