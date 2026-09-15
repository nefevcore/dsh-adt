/**
 * adt_debug — the ABAP debugger over the STANDARD ADT REST API
 * (`/sap/bc/adt/debugger/*`), zero server-side installation. Lineage:
 * abap-mcp's 7-tool set → abap-config-mcp → 5 action-routed tools →
 * E-group consolidation into ONE tool (docs/tool-consolidation-plan.md §6) —
 * every former noun (session/breakpoint/step/inspect/set_variable) is an
 * `action` now. The vsp field pitfalls stay handled:
 *
 *  - the debug loop rides the STATEFUL session of the destination client
 *    (sap-contextid cookie) — all calls go through the registry's cached
 *    AdtClient, never a fresh one;
 *  - the listener identity (terminalId/ideId) is plugin-level state
 *    (DebuggerManager) because an ADT session holds ONE debug session and a
 *    detached session cannot be re-attached — fresh ids on every re-listen;
 *  - `/debugger/stack` is absent on older releases (7.50) — the protocol
 *    client probes once and then answers locally with `unavailable`.
 *
 * Policy: the whole tool is gated by `allowDebugger` (default false — a
 * debugger holds a live session and can stop production processes); the
 * `setVariable` action additionally needs `allowDebugVariables`
 * (double opt-in). prd-profile destinations hard-deny the tool.
 */
import { defineTool } from '../tooldef.js';
import { DESTINATION_PARAM, destinationOf, optStr, resolveToolObject, sessionCwd, text, } from './common.js';
const STEP_NAMES = {
    stepInto: 'F5 — step into the called unit',
    stepOver: 'F6 — step over the current line',
    stepReturn: 'F7 — run until the current unit returns',
    stepContinue: 'F8 — run free until the next breakpoint',
    terminateDebuggee: 'terminate the debuggee and end the session',
};
const ACTIONS = [
    'listen', 'status', 'detach',
    'setBreakpoint', 'deleteBreakpoint',
    'step',
    'variables', 'stack',
    'setVariable',
];
export function debuggerTools(deps) {
    const { registry, debugger: manager } = deps;
    if (!manager) {
        // ToolDeps keeps the manager optional for lightweight harnesses; the
        // debugger is useless without plugin-level session state.
        throw new Error('adt_debug: the debugger session manager is not wired (deps.debugger missing)');
    }
    return [
        defineTool({
            name: 'adt_debug',
            description: 'Debug ABAP code live over the standard ADT debugger (SE37-style new debugger, /sap/bc/adt/debugger) — one ' +
                'tool, nine actions. Loop: set the breakpoint FIRST (`setBreakpoint` — external scope, fires for the target user; ' +
                'standard-code breakpoints often do NOT trigger because SAP defaults to customer-code-only debugging), trigger ' +
                'the code path, then `listen` (long-poll) for the hit. While stopped: `variables` reads values, `stack` the call ' +
                'stack (absent on BASIS < ~7.51 — reported as unavailable), `step` advances (F5/F6/F7/F8 or terminateDebuggee), ' +
                '`setVariable` overrides a value (DANGEROUS — double opt-in: allowDebugger AND allowDebugVariables). `status` shows ' +
                'the session + backend listener state; `deleteBreakpoint` removes one by id; ALWAYS end with `detach` — one debug ' +
                'session per destination, and after detach you cannot re-attach (a fresh listen gets fresh state). Gated by the ' +
                'allowDebugger policy (off by default — the debugger stops live processes).',
            parameters: {
                action: {
                    type: 'string',
                    enum: [...ACTIONS],
                    required: true,
                    description: 'listen = wait for a breakpoint hit (long-poll); status = session + listener state; detach = end the session; ' +
                        'setBreakpoint / deleteBreakpoint = manage line breakpoints; step = advance the stopped debuggee (with `step`); ' +
                        'variables / stack = inspect the stopped debuggee; setVariable = change one variable value.',
                },
                username: {
                    type: 'string',
                    description: 'SAP user whose processes to debug (external breakpoints fire for this user; default: the destination user).',
                },
                timeoutSeconds: {
                    type: 'integer',
                    description: 'listen: server-side wait window, 1–240 s (default 30). Empty answer = no hit in the window.',
                },
                objectUri: { type: 'string', description: 'setBreakpoint: ADT object URI (from search/read), e.g. /sap/bc/adt/programs/programs/zprog_demo.' },
                name: {
                    type: 'string',
                    description: 'setBreakpoint: object name (alternative to objectUri), e.g. ZPROG_DEMO; setVariable: the VARIABLE name (uppercase).',
                },
                type: { type: 'string', description: 'setBreakpoint: object type for name resolution (short form, e.g. PROG, CLAS).' },
                line: { type: 'integer', description: 'setBreakpoint: 1-based source line to break at.' },
                id: { type: 'string', description: 'deleteBreakpoint: breakpoint id returned by setBreakpoint.' },
                step: {
                    type: 'string',
                    enum: Object.keys(STEP_NAMES),
                    description: Object.entries(STEP_NAMES).map(([k, v]) => `${k} = ${v}`).join('; '),
                },
                variables: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'variables action: variable names to read (uppercase ABAP names).',
                },
                value: { type: 'string', description: 'setVariable: new value as ABAP literal text, e.g. 42 or NEWTEXT.' },
                ...DESTINATION_PARAM,
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        action: { type: 'string', required: true },
                        destination: { type: 'string', required: true },
                        hit: { type: 'boolean', description: 'listen: a debuggee was caught and is stopped.' },
                        timedOut: { type: 'boolean' },
                        conflict: { type: 'string' },
                        debuggee: { type: 'object', additionalProperties: true },
                        session: { type: 'object', additionalProperties: true },
                        backendListeners: { type: 'string', description: 'status: raw backend listener registry (XML).' },
                        detached: { type: 'boolean' },
                        breakpoints: {
                            type: 'array',
                            items: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    id: { type: 'string', required: true },
                                    uri: { type: 'string' },
                                    line: { type: 'integer' },
                                },
                            },
                        },
                        deleted: { type: 'boolean' },
                        result: { type: 'object', additionalProperties: true, description: 'step: the AdtDebugStepResult.' },
                        variables: {
                            type: 'array',
                            items: {
                                type: 'object',
                                additionalProperties: true,
                                properties: {
                                    name: { type: 'string', required: true },
                                    value: { type: 'string' },
                                    declaredTypeName: { type: 'string' },
                                    readOnly: { type: 'boolean' },
                                },
                            },
                        },
                        stack: {
                            type: 'object',
                            additionalProperties: true,
                            properties: {
                                unavailable: { type: 'boolean' },
                                note: { type: 'string' },
                            },
                        },
                        note: { type: 'string' },
                    },
                },
                render: (_args, value) => {
                    const lines = [`debug ${value.action} on ${value.destination}:`];
                    if (value.debuggee) {
                        const d = value.debuggee;
                        lines.push(`BREAKPOINT HIT — stopped in ${d.program ?? '?'}${d.line ? ` line ${d.line}` : ''}` +
                            ` (debuggee ${d.id ?? '?'}${d.user ? `, user ${d.user}` : ''}). ` +
                            'Inspect with adt_debug {action:"variables"|"stack"}, step with {action:"step"}, end with {action:"detach"}.');
                    }
                    if (value.timedOut)
                        lines.push('no breakpoint hit within the wait window (listener stays registered)');
                    if (value.conflict)
                        lines.push(`listener conflict: ${value.conflict}`);
                    if (value.session) {
                        const s = value.session;
                        lines.push(s.registered
                            ? `session registered (user ${s.user ?? '?'})${s.lastListen ? `, last listen ${s.lastListen.at}: ${s.lastListen.hit ? `hit in ${s.lastListen.program ?? '?'}` : 'no hit'}` : ''}`
                            : 'no session registered for this destination');
                    }
                    if (value.backendListeners)
                        lines.push(`backend listeners: ${value.backendListeners}`);
                    if (value.breakpoints?.length) {
                        for (const b of value.breakpoints) {
                            lines.push(`- breakpoint id ${b.id} → ${b.uri}${b.line ? ` line ${b.line}` : ''}`);
                        }
                        lines.push('next: trigger the code path, then adt_debug {action:"listen"}');
                    }
                    if (value.deleted !== undefined)
                        lines.push(value.deleted ? 'breakpoint deleted' : (value.note ?? ''));
                    if (value.detached !== undefined)
                        lines.push(value.detached ? 'listener detached — a fresh listen needs fresh state' : (value.note ?? ''));
                    if (value.result) {
                        const r = value.result;
                        lines.push(`${r.program ?? '?'}${r.line ? ` line ${r.line}` : ''}` +
                            (r.isSteppingPossible === false ? ' (stepping no longer possible — debuggee running or ended)' : ''));
                        if (r.reachedBreakpoints?.length)
                            lines.push(`reached breakpoints: ${r.reachedBreakpoints.map((b) => b.id).join(', ')}`);
                    }
                    if (value.variables) {
                        const vars = value.variables;
                        lines.push(vars.length === 0
                            ? 'no variables returned (not stopped, or names not found)'
                            : vars.map((v) => `- ${v.name}: ${v.value ?? '?'}${v.declaredTypeName ? ` (${v.declaredTypeName})` : ''}${v.readOnly ? ' [read-only]' : ''}`).join('\n'));
                    }
                    if (value.stack) {
                        const stack = value.stack;
                        if (stack.unavailable) {
                            lines.push(`stack unavailable: ${stack.note ?? 'backend lacks /debugger/stack'}`);
                        }
                        else {
                            lines.push(`call stack (cursor at frame ${stack.cursorIndex ?? 0}):\n` +
                                (stack.entries ?? [])
                                    .map((e) => `- #${e.stackPosition} ${e.programName ?? '?'}${e.includeName && e.includeName !== e.programName ? ` (include ${e.includeName})` : ''}${e.line ? ` line ${e.line}` : ''}${e.eventName ? ` [${e.eventType ?? ''} ${e.eventName}]` : ''}`)
                                    .join('\n'));
                        }
                    }
                    return text(lines.join('\n'));
                },
            },
            timeoutMs: 300_000, // listen waits up to 240 s server-side + network margin
            isConcurrencySafe: () => false,
            execute: async (args, exec) => {
                const entry = await registry.require(destinationOf(args), sessionCwd(exec));
                const action = optStr(args.action);
                const user = optStr(args.username)?.toUpperCase();
                // ---- arg pre-validation (fails fast BEFORE the policy gate so a call
                // with bad arguments reports the ARG error, not a policy error). The
                // per-branch checks below remain as defensive re-checks.
                if (!action || !ACTIONS.includes(action)) {
                    throw new Error(`adt_debug: unknown action '${action}' (${ACTIONS.join(', ')})`);
                }
                if (action === 'setBreakpoint') {
                    if (typeof args.line !== 'number' || args.line < 1) {
                        throw new Error('adt_debug: `line` (1-based) is required for setBreakpoint');
                    }
                    if (!optStr(args.objectUri) && !optStr(args.name)) {
                        throw new Error('adt_debug: provide objectUri or name(+type) for setBreakpoint');
                    }
                }
                if (action === 'deleteBreakpoint' && !optStr(args.id)) {
                    throw new Error('adt_debug: `id` (from setBreakpoint) is required for deleteBreakpoint');
                }
                if (action === 'step') {
                    const step = optStr(args.step);
                    if (!step || !(step in STEP_NAMES)) {
                        throw new Error(`adt_debug: unknown step '${step}' (${Object.keys(STEP_NAMES).join(', ')})`);
                    }
                }
                if (action === 'variables') {
                    const names = Array.isArray(args.variables) ? args.variables.map(String).filter(Boolean) : [];
                    if (names.length === 0) {
                        throw new Error('adt_debug: `variables` (non-empty name list) is required for the variables action');
                    }
                }
                if (action === 'setVariable') {
                    if (!optStr(args.name)?.toUpperCase() || optStr(args.value) === undefined) {
                        throw new Error('adt_debug: `name` and `value` are required for setVariable');
                    }
                }
                // ---- policy gates (whole tool = allowDebugger; setVariable = double
                // opt-in with allowDebugVariables) — every action, matching the
                // pre-consolidation five-tool behavior where each tool was fully gated.
                entry.policy.assertDebuggerAllowed('adt_debug');
                if (action === 'setVariable')
                    entry.policy.assertDebugVariablesAllowed('adt_debug');
                // ---- session lifecycle (listen / status / detach) --------------------
                if (action === 'listen') {
                    const timeout = typeof args.timeoutSeconds === 'number' ? args.timeoutSeconds : undefined;
                    const result = await manager.listen(entry, { timeoutSeconds: timeout, signal: exec.signal });
                    return {
                        action,
                        destination: entry.config.name,
                        hit: Boolean(result.debuggee),
                        timedOut: result.timedOut,
                        conflict: result.conflict,
                        debuggee: result.debuggee ? { ...result.debuggee } : undefined,
                        note: result.rawXml,
                    };
                }
                if (action === 'status') {
                    const session = manager.describe(entry);
                    let backendListeners;
                    try {
                        backendListeners = (await entry.client.debuggerListenerStatus({ user, signal: exec.signal })).rawXml;
                    }
                    catch (error) {
                        backendListeners = `backend listener query failed: ${error.message}`;
                    }
                    return { action, destination: entry.config.name, session, backendListeners };
                }
                if (action === 'detach') {
                    const result = await manager.detach(entry, exec.signal);
                    return { action, destination: entry.config.name, detached: result.detached, note: result.note };
                }
                // ---- breakpoints ------------------------------------------------------
                if (action === 'setBreakpoint') {
                    const line = args.line;
                    if (typeof line !== 'number' || line < 1)
                        throw new Error('adt_debug: `line` (1-based) is required for setBreakpoint');
                    let uri = optStr(args.objectUri);
                    if (!uri) {
                        const name = optStr(args.name);
                        if (!name)
                            throw new Error('adt_debug: provide objectUri or name(+type) for setBreakpoint');
                        const ref = await resolveToolObject(entry.client, args, exec.signal);
                        uri = ref.uri;
                    }
                    const sourceUri = uri.includes('/source/main') ? uri : `${uri.replace(/\/$/, '')}/source/main`;
                    const record = manager.sessionFor(entry, user);
                    const breakpoints = await entry.client.setDebugBreakpoint({
                        sourceUri,
                        line,
                        user: record.user,
                        terminalId: record.terminalId,
                        ideId: record.ideId,
                        signal: exec.signal,
                    });
                    return { action, destination: entry.config.name, breakpoints };
                }
                if (action === 'deleteBreakpoint') {
                    const id = optStr(args.id);
                    if (!id)
                        throw new Error('adt_debug: `id` (from setBreakpoint) is required for deleteBreakpoint');
                    const record = manager.sessionFor(entry, user);
                    await entry.client.deleteDebugBreakpoint({
                        id,
                        user: record.user,
                        terminalId: record.terminalId,
                        ideId: record.ideId,
                        signal: exec.signal,
                    });
                    return { action, destination: entry.config.name, deleted: true };
                }
                // ---- stepping ---------------------------------------------------------
                if (action === 'step') {
                    const step = optStr(args.step);
                    if (!step || !(step in STEP_NAMES)) {
                        throw new Error(`adt_debug: unknown step '${step}' (${Object.keys(STEP_NAMES).join(', ')})`);
                    }
                    const result = await entry.client.debuggerStep({
                        step: step,
                        signal: exec.signal,
                    });
                    return {
                        action,
                        destination: entry.config.name,
                        result: { ...result, reachedBreakpoints: result.reachedBreakpoints.map((b) => ({ ...b })) },
                    };
                }
                // ---- inspection -------------------------------------------------------
                if (action === 'variables') {
                    const names = Array.isArray(args.variables) ? args.variables.map(String).filter(Boolean) : [];
                    if (names.length === 0)
                        throw new Error('adt_debug: `variables` (non-empty name list) is required for the variables action');
                    const variables = await entry.client.debuggerVariables({ names, signal: exec.signal });
                    return { action, destination: entry.config.name, variables: variables.map((v) => ({ ...v })) };
                }
                if (action === 'stack') {
                    const stack = await entry.client.debuggerStack({ signal: exec.signal });
                    return {
                        action,
                        destination: entry.config.name,
                        stack: { ...stack, entries: (stack.entries ?? []).map((e) => ({ ...e })) },
                    };
                }
                // ---- value override (double opt-in) -----------------------------------
                if (action === 'setVariable') {
                    entry.policy.assertDebugVariablesAllowed('adt_debug');
                    const name = optStr(args.name)?.toUpperCase();
                    const value = optStr(args.value);
                    if (!name || value === undefined)
                        throw new Error('adt_debug: `name` and `value` are required for setVariable');
                    await entry.client.debuggerSetVariable({ name, value, signal: exec.signal });
                    return { action, destination: entry.config.name, note: `variable ${name} set to ${value}` };
                }
                throw new Error(`adt_debug: unknown action '${action}' (${ACTIONS.join(', ')})`);
            },
        }),
    ];
}
//# sourceMappingURL=debugger.js.map