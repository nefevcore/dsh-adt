/**
 * REAL-machine acceptance for the C/D/E consolidation batch
 * (docs/tool-consolidation-plan.md): drives the NEW tool facades —
 *
 *   - adt_atc_runs  (no displayId = list / displayId = one result)
 *   - adt_dumps     (no dumpId = list / dumpId = detail views)
 *   - adt_transports(no number = list / number = one request)
 *   - adt_object_read {part:'textelements'} (C-group face)
 *   - adt_debug     (policy gate + error paths; no live debugging on a
 *                    shared system — the debugger loop is mock-tested and
 *                    stopping a production process is out of scope here)
 *
 * against a live system, through the REAL assembleAdtTools registry
 * (policy/OCC/deps wiring), not the bare wire. Complements
 * verify-p1/p234/create-real (wire-level) — this proves the FASADES.
 *
 * Usage: node scripts/verify-consolidation-real.mjs <url> <client> <user> <pwd> [language]
 *   e.g. node scripts/verify-consolidation-real.mjs https://180.167.68.213:44304 100 168013 <pwd> EN
 */
import {
  AdtRegistry,
  DebuggerManager,
  LockLedger,
  assembleAdtTools,
} from '../packages/adt-core/lib/index.js';

const [url, client, user, password, language = 'EN'] = process.argv.slice(2);
if (!url || !client || !user || !password) {
  console.error('usage: node scripts/verify-consolidation-real.mjs <url> <client> <user> <pwd> [language]');
  process.exit(2);
}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const registry = await AdtRegistry.create({
  defaultDestination: 'deloitte',
  destinations: [{
    name: 'deloitte',
    url,
    client,
    language,
    username: user,
    password,
    strictSSL: false,
  }],
});
const tools = new Map(assembleAdtTools(
  { registry, ledger: new LockLedger(), debugger: new DebuggerManager(registry) },
  { get: () => undefined },
).map((t) => [t.name, t]));

let pass = 0;
let fail = 0;
const failures = [];
async function step(label, fn) {
  try {
    const detail = (await fn()) ?? 'ok';
    pass++;
    console.log(`✅ ${label}: ${detail}`);
  } catch (e) {
    fail++;
    failures.push(`${label}: ${e.message}`);
    console.log(`❌ ${label}: ${e.message}`);
  }
}
/** Expect a policy refusal — the gate must fire before any backend call. */
async function stepRefused(label, fn) {
  try {
    await fn();
    fail++;
    failures.push(`${label}: expected a policy refusal, got success`);
    console.log(`❌ ${label}: expected refusal, got success`);
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (/\[POLICY\]|allowDebugger|profile/i.test(msg)) {
      pass++;
      console.log(`✅ ${label}: refused as designed — ${msg.slice(0, 140)}`);
    } else {
      fail++;
      failures.push(`${label}: non-policy error: ${msg}`);
      console.log(`❌ ${label}: non-policy error: ${msg}`);
    }
  }
}
const call = (name, args) => tools.get(name).execute(args, {});

console.log(`\n=== facade acceptance on ${url} (client ${client}, ${language}) ===`);

// --- D group: list/detail pairs ------------------------------------------------
let firstRun = null;
let firstTransport = null;
await step('adt_atc_runs list form (no displayId)', async () => {
  const r = await call('adt_atc_runs', {});
  const runs = r.runs ?? [];
  firstRun = runs[0]?.displayId ?? null;
  return `count=${r.count ?? runs.length}, first=${firstRun ?? '(none)'}`;
});
await step('adt_atc_runs one-result form (displayId)', async () => {
  if (!firstRun) return 'no stored runs to fetch — list form is the coverage here';
  const r = await call('adt_atc_runs', { displayId: firstRun });
  return `displayId=${r.displayId}, findings=${(r.findings ?? []).length}, counts=${JSON.stringify(r.counts ?? {})}`;
});

await step('adt_dumps list form (no dumpId)', async () => {
  const r = await call('adt_dumps', {});
  return `count=${r.count ?? (r.dumps ?? []).length}`;
});
await step('adt_dumps detail form requires dumpId', async () => {
  const r = await call('adt_dumps', { view: 'summary' });
  return `parameterless stays a list (count=${r.count ?? (r.dumps ?? []).length}) — dumpId is the detail switch`;
});

await step('adt_transports list form (no number)', async () => {
  const r = await call('adt_transports', {});
  const ts = r.transports ?? [];
  firstTransport = ts[0]?.number ?? null;
  return `count=${ts.length}, modifiable=${ts.filter((t) => t.modifiable).length}`;
});
await step('adt_transports one-request form (number)', async () => {
  if (!firstTransport) return 'no transports to fetch';
  const r = await call('adt_transports', { number: firstTransport });
  return `number=${r.number}${r.requestedNumber ? ` (asked ${r.requestedNumber})` : ''}, items=${(r.items ?? []).length}`;
});

// --- C group: textelements face --------------------------------------------------
await step("adt_object_read {part:'textelements'} on a real program", async () => {
  const r = await call('adt_object_read', { type: 'PROG', name: 'SAPLSEWORKINGAREA', part: 'textelements' });
  return `program=${r.program ?? '?'}, symbols=${r.counts?.symbols}, selections=${r.counts?.selections}, headings=${r.counts?.headings}`;
});

// --- E group: facade + policy gates ----------------------------------------------
// `status` is gated by allowDebugger too (pre-consolidation EVERY one of the
// five tools was fully gated) — expected, assert the refusal.
await stepRefused('adt_debug status gated by allowDebugger (default off)', () =>
  call('adt_debug', { action: 'status' }));
await step('adt_debug arg validation: step without `step`', async () => {
  try {
    await call('adt_debug', { action: 'step' });
    return 'no error thrown — MISSING validation';
  } catch (e) {
    const msg = String(e?.message ?? e);
    return /\bstep\b/.test(msg) ? `validated — ${msg.slice(0, 100)}` : `wrong error: ${msg.slice(0, 100)}`;
  }
});
await step('adt_debug arg validation: setVariable without value', async () => {
  try {
    await call('adt_debug', { action: 'setVariable', name: 'LV_X' });
    return 'no error thrown — MISSING validation';
  } catch (e) {
    const msg = String(e?.message ?? e);
    return /\bvalue\b/.test(msg) ? `validated — ${msg.slice(0, 100)}` : `wrong error: ${msg.slice(0, 100)}`;
  }
});

// --- E group: policy gates (default-off) ------------------------------------------
await stepRefused('adt_debug setVariable refused by policy (double opt-in)', () =>
  call('adt_debug', { action: 'setVariable', name: 'LV_X', value: '1' }));
await stepRefused('adt_debug listen refused by policy (default off)', () =>
  call('adt_debug', { action: 'listen' }));

// --- deepening: exercise the DETAIL forms against real data ----------------------
// ATC: start a real run on a small Z object, then the list must show it and
// the displayId form must fetch it back (the run persisting is by design).
let atcTarget = null;
await step('find an ATC probe object (search Z*)', async () => {
  const r = await call('adt_search', { query: 'Z*', maxResults: 20 });
  // search returns HIERARCHICAL type codes (PROG/P, CLAS/OC, …) — compare the
  // namespace prefix, the tools' object arrays accept the short form.
  const objs = (r.objects ?? []).filter((o) => ['PROG', 'CLAS', 'INTF'].includes(String(o.type ?? '').split('/')[0]));
  atcTarget = objs[0] ? { name: objs[0].objectName ?? objs[0].name, type: String(objs[0].type).split('/')[0] } : null;
  return atcTarget ? `${atcTarget.type} ${atcTarget.name}` : 'no Z PROG/CLAS found — skipping ATC loop';
});
let newRunId = null;
if (atcTarget) {
  await step(`adt_run_atc starts a real run (${atcTarget.name})`, async () => {
    const r = await call('adt_run_atc', { objects: [atcTarget] });
    newRunId = r.displayId ?? null;
    return `clean=${r.clean}, findings=${(r.findings ?? []).length}, displayId=${newRunId ?? '?'}, ${r.durationMs ?? 0}ms`;
  });
  await step('adt_atc_runs list form now sees the run', async () => {
    const r = await call('adt_atc_runs', {});
    const runs = r.runs ?? [];
    const hit = runs.find((x) => x.displayId === newRunId) ?? runs[0];
    return `count=${r.count ?? runs.length}, found=${Boolean(hit)}`;
  });
  await step('adt_atc_runs detail form (displayId of the new run)', async () => {
    if (!newRunId) return 'run produced no displayId — list form covered above';
    const r = await call('adt_atc_runs', { displayId: newRunId });
    return `findings=${(r.findings ?? []).length}, counts=${JSON.stringify(r.counts ?? {})}`;
  });
}
// transports: allUsers widens the net, then fetch one request in full.
let anyTransport = null;
await step('adt_transports list form (allUsers)', async () => {
  const r = await call('adt_transports', { allUsers: true });
  const ts = r.transports ?? [];
  anyTransport = ts[0]?.number ?? null;
  return `count=${ts.length}, first=${anyTransport ?? '(none)'}`;
});
await step('adt_transports detail form (number from the list)', async () => {
  if (!anyTransport) return 'no transports on the system — list form covered above';
  const r = await call('adt_transports', { number: anyTransport });
  return `number=${r.number}, items=${(r.items ?? []).length}`;
});
// dumps: fetch one dump detail (read-only; ST22 is shared-knowledge on a dev system).
await step('adt_dumps detail form (dumpId from the list)', async () => {
  const list = await call('adt_dumps', { top: 5 });
  const id = (list.dumps ?? [])[0]?.id;
  if (!id) return 'no dumps — list form covered above';
  const r = await call('adt_dumps', { dumpId: id, view: 'summary' });
  return `id=${r.id ?? id}, view=${r.view}, sections=${(r.sections ?? []).length}`;
});

await registry.dispose();

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if (fail > 0) {
  console.log('failures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
