import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AdtRegistry } from '../lib/registry.js';
import { LockLedger } from '../lib/locks.js';
import { DebuggerManager } from '../lib/debugger.js';
import { builtinDefaults } from '../lib/config.js';
import { AdtPolicyError } from '../lib/policy.js';
import { debuggerTools } from '../lib/tools/debugger.js';

/**
 * adt_debug_* against the in-process mock debugger state machine: the full
 * loop (set breakpoint → listen → hit → stack → variables → step → set
 * variable → delete breakpoint → detach), the prd-profile hard deny, and the
 * double opt-in for writing debuggee variables.
 */

const exec = { signal: undefined } as never;

/** Registry with the debugger family enabled (and variable writes optionally). */
function registryWith(options: { allowDebugger?: boolean; allowDebugVariables?: boolean } = {}) {
  return AdtRegistry.create({
    ...builtinDefaults(),
    demo: true,
    demoPort: 0,
    allowDebugger: options.allowDebugger,
    allowDebugVariables: options.allowDebugVariables,
  });
}

let registry: AdtRegistry;
let manager: DebuggerManager;

before(async () => {
  registry = await registryWith({ allowDebugger: true, allowDebugVariables: true });
  manager = new DebuggerManager(registry);
});

after(async () => {
  await manager.dispose();
  await registry.dispose();
});

function tools() {
  const by = new Map(
    debuggerTools({ registry, ledger: new LockLedger(), debugger: manager }).map((t) => [t.name, t]),
  );
  return by;
}

test('debugger: full loop — breakpoint → listen hit → stack → variables → step → set variable → detach', async () => {
  const by = tools();

  // 1. Set a breakpoint (name+type resolution → source URI + line).
  const set = await by.get('adt_debug_breakpoint')!.execute(
    { action: 'set', name: 'ZPROG_DEMO', type: 'PROG', line: 12 },
    exec,
  );
  assert.equal(set.action, 'set');
  assert.equal(set.breakpoints.length, 1);
  const bp = set.breakpoints[0]!;
  assert.match(bp.id, /^BP\d+$/);
  assert.match(bp.uri, /programs\/programs\/zprog_demo\/source\/main/);
  assert.equal(bp.line, 12);

  // 2. Listen → the mock catches immediately (deterministic hit).
  const listen = await by.get('adt_debug_session')!.execute({ action: 'listen', timeoutSeconds: 5 }, exec);
  assert.equal(listen.hit, true);
  assert.equal(listen.timedOut, false);
  assert.equal(listen.debuggee!.program, 'ZPROG_DEMO');
  assert.equal(listen.debuggee!.line, 12);
  assert.equal(listen.debuggee!.user, 'DEMO');

  // 3. Status reports the registered session.
  const status = await by.get('adt_debug_session')!.execute({ action: 'status' }, exec);
  assert.equal(status.session.registered, true);
  assert.match(status.backendListeners!, /dbg:listener/);

  // 4. Stack with two frames, cursor at frame 0.
  const stack = await by.get('adt_debug_inspect')!.execute({ action: 'stack' }, exec);
  assert.equal(stack.stack.entries.length, 2);
  assert.equal(stack.stack.entries[0]!.programName, 'ZPROG_DEMO');
  assert.equal(stack.stack.entries[0]!.line, 12);
  assert.equal(stack.stack.entries[1]!.programName, 'SAPLMOCK_CALLER');
  assert.equal(stack.stack.unavailable, undefined);

  // 5. Variables read the mock values.
  const vars = await by.get('adt_debug_inspect')!.execute(
    { action: 'variables', variables: ['LV_COUNT', 'LV_NAME', 'LV_LOCKED'] },
    exec,
  );
  const byName = new Map(vars.variables.map((v) => [v.name, v]));
  assert.equal(byName.get('LV_COUNT')!.value, '41');
  assert.equal(byName.get('LV_NAME')!.value, 'MOCK');
  assert.equal(byName.get('LV_LOCKED')!.readOnly, true);

  // 6. Step over advances the line.
  const step = await by.get('adt_debug_step')!.execute({ step: 'stepOver' }, exec);
  assert.equal(step.result.line, 13);
  assert.equal(step.result.isSteppingPossible, true);

  // 7. Set a variable (write path, double opt-in satisfied here).
  const write = await by.get('adt_debug_set_variable')!.execute(
    { name: 'LV_COUNT', value: '42' },
    exec,
  );
  assert.equal(write.name, 'LV_COUNT');
  const reread = await by.get('adt_debug_inspect')!.execute(
    { action: 'variables', variables: ['LV_COUNT'] },
    exec,
  );
  assert.equal(reread.variables[0]!.value, '42');

  // 8. Read-only variables are refused by the backend.
  await assert.rejects(
    () => by.get('adt_debug_set_variable')!.execute({ name: 'LV_LOCKED', value: 'x' }, exec),
    /read-only/i,
  );

  // 9. Delete the breakpoint by id.
  const del = await by.get('adt_debug_breakpoint')!.execute({ action: 'delete', id: bp.id }, exec);
  assert.equal(del.deleted, true);

  // 10. Detach ends the session.
  const detach = await by.get('adt_debug_session')!.execute({ action: 'detach' }, exec);
  assert.equal(detach.detached, true);
  // After the session ended, inspecting is refused with a clear error.
  await assert.rejects(
    () => by.get('adt_debug_inspect')!.execute({ action: 'stack' }, exec),
    /no stopped debuggee/i,
  );
});

test('debugger: continue releases the debuggee — inspect then refuses', async () => {
  const by = tools();
  await by.get('adt_debug_breakpoint')!.execute({ action: 'set', name: 'ZCL_DEMO', type: 'CLAS', line: 3 }, exec);
  await by.get('adt_debug_session')!.execute({ action: 'listen', timeoutSeconds: 5 }, exec);
  const cont = await by.get('adt_debug_step')!.execute({ step: 'stepContinue' }, exec);
  assert.equal(cont.result.isSteppingPossible, false);
  await assert.rejects(
    () => by.get('adt_debug_inspect')!.execute({ action: 'variables', variables: ['LV_COUNT'] }, exec),
    /running/i,
  );
  await by.get('adt_debug_session')!.execute({ action: 'detach' }, exec);
});

test('debugger: default policy denies the family (allowDebugger off)', async () => {
  const plain = await registryWith();
  try {
    const by = new Map(
      debuggerTools({ registry: plain, ledger: new LockLedger(), debugger: new DebuggerManager(plain) }).map((t) => [
        t.name,
        t,
      ]),
    );
    await assert.rejects(
      () => by.get('adt_debug_session')!.execute({ action: 'listen' }, exec),
      (error: unknown) => {
        assert.ok(error instanceof AdtPolicyError);
        assert.equal(error.rule, 'allowDebugger');
        assert.match(error.message, /SAP_ALLOW_DEBUGGER/);
        return true;
      },
    );
    await assert.rejects(() => by.get('adt_debug_breakpoint')!.execute({ action: 'set', name: 'ZPROG_DEMO', type: 'PROG', line: 1 }, exec), /allowDebugger/);
    await assert.rejects(() => by.get('adt_debug_step')!.execute({ step: 'stepOver' }, exec), /allowDebugger/);
  } finally {
    await plain.dispose();
  }
});

test('debugger: variable writes need the second knob (allowDebugVariables)', async () => {
  const noVarWrites = await registryWith({ allowDebugger: true });
  try {
    const by = new Map(
      debuggerTools({ registry: noVarWrites, ledger: new LockLedger(), debugger: new DebuggerManager(noVarWrites) }).map(
        (t) => [t.name, t],
      ),
    );
    // Family open: breakpoints work…
    await by.get('adt_debug_breakpoint')!.execute({ action: 'set', name: 'ZPROG_DEMO', type: 'PROG', line: 5 }, exec);
    await by.get('adt_debug_session')!.execute({ action: 'listen', timeoutSeconds: 5 }, exec);
    // …but writing values is refused by the second gate BEFORE any request.
    await assert.rejects(
      () => by.get('adt_debug_set_variable')!.execute({ name: 'LV_COUNT', value: '1' }, exec),
      (error: unknown) => {
        assert.ok(error instanceof AdtPolicyError);
        assert.equal(error.rule, 'allowDebugVariables');
        return true;
      },
    );
    await by.get('adt_debug_session')!.execute({ action: 'detach' }, exec);
  } finally {
    await noVarWrites.dispose();
  }
});

test('debugger: prd-profile destinations hard-deny the family', async () => {
  const p = (await import('../lib/policy.js')).AdtPolicy.resolve(
    { profile: 'prd', allowDebugger: true, allowDebugVariables: true },
    {},
  );
  assert.equal(p.allowDebugger, false, 'prd forces the debugger closed');
  assert.throws(() => p.assertDebuggerAllowed('adt_debug_session'), (error: unknown) => {
    assert.ok(error instanceof AdtPolicyError);
    assert.equal(error.rule, 'allowDebugger');
    assert.match(error.message, /profile: prd/);
    return true;
  });
  // allowDebugVariables alone is NOT prd-hard-denied — the family gate
  // already refuses everything on prd, and a dev/qa destination may still
  // choose to deny just the write.
  assert.equal(p.allowDebugVariables, true);
});
