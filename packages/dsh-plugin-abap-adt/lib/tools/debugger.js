/**
 * adt_debug_* — the ABAP debugger over the STANDARD ADT REST API
 * (`/sap/bc/adt/debugger/*`), zero server-side installation. Ported from
 * abap-mcp's 7-tool set (itself ported from abap-config-mcp), merged into 5
 * action-routed tools, with the vsp field pitfalls handled:
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
 * Policy: the whole family is gated by `allowDebugger` (default false — a
 * debugger holds a live session and can stop production processes), and
 * writing variable values additionally needs `allowDebugVariables`
 * (double opt-in). prd-profile destinations hard-deny the family.
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
export function debuggerTools(deps) {
    const { registry, debugger: manager } = deps;
    if (!manager) {
        // ToolDeps keeps the manager optional for lightweight harnesses; the
        // adt_debug_* family is useless without plugin-level session state.
        throw new Error('adt_debug_*: the debugger session manager is not wired (deps.debugger missing)');
    }
    return [
        defineTool({
            name: 'adt_debug_session',
            description: 'Debug ABAP code live over the standard ADT debugger (SE37-style new debugger, /sap/bc/adt/debugger): ' +
                'register a listener and WAIT for a breakpoint hit (`listen`, long-poll — set breakpoints with ' +
                'adt_debug_breakpoint first), show the session state (`status`), or end it (`detach`). One destination ' +
                'holds ONE debug session; after detach a fresh listen is required. Gated by the allowDebugger policy ' +
                '(off by default — the debugger stops live processes).',
            parameters: {
                action: {
                    type: 'string',
                    enum: ['listen', 'status', 'detach'],
                    required: true,
                    description: 'listen = wait for a breakpoint hit; status = session + backend listener state; detach = end.',
                },
                username: {
                    type: 'string',
                    description: 'SAP user whose processes to debug (external breakpoints fire for this user; default: the destination user).',
                },
                timeoutSeconds: {
                    type: 'integer',
                    description: 'Server-side wait window for listen, 1–240 s (default 30). Empty answer = no hit in the window.',
                },
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
                        note: { type: 'string' },
                    },
                },
                render: (_args, value) => {
                    const lines = [`debug ${value.action} on ${value.destination}:`];
                    if (value.debuggee) {
                        const d = value.debuggee;
                        lines.push(`BREAKPOINT HIT — stopped in ${d.program ?? '?'}${d.line ? ` line ${d.line}` : ''}` +
                            ` (debuggee ${d.id ?? '?'}${d.user ? `, user ${d.user}` : ''}). ` +
                            'Inspect with adt_debug_inspect, step with adt_debug_step, end with adt_debug_session {action:"detach"}.');
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
                    if (value.detached !== undefined)
                        lines.push(value.detached ? 'listener detached — a fresh listen needs fresh state' : (value.note ?? ''));
                    return text(lines.join('\n'));
                },
            },
            execute: async (args, exec) => {
                const entry = await registry.require(destinationOf(args), sessionCwd(exec));
                entry.policy.assertDebuggerAllowed('adt_debug_session');
                const action = optStr(args.action);
                const user = optStr(args.username)?.toUpperCase();
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
                throw new Error(`adt_debug_session: unknown action '${action}' (listen, status or detach)`);
            },
        }),
        defineTool({
            name: 'adt_debug_breakpoint',
            description: 'Set or delete a debugger LINE breakpoint in ABAP code (external scope — it fires for the target user when ' +
                'that code runs; standard-code breakpoints often do NOT trigger because SAP defaults to customer-code-only ' +
                'debugging). `set` takes objectUri or name+type (CLAS/INTF/PROG/…) plus the 1-based line, and returns the ' +
                'breakpoint id for `delete`. Breakpoints are IDE state — list what you set and clean up with delete, or ' +
                'detach removes them with the session.',
            parameters: {
                action: { type: 'string', enum: ['set', 'delete'], required: true },
                objectUri: { type: 'string', description: 'ADT object URI (from search/read), e.g. /sap/bc/adt/programs/programs/zprog_demo.' },
                name: { type: 'string', description: 'Object name (alternative to objectUri), e.g. ZPROG_DEMO.' },
                type: { type: 'string', description: 'Object type for name resolution (short form, e.g. PROG, CLAS).' },
                line: { type: 'integer', description: 'set: 1-based source line to break at.' },
                id: { type: 'string', description: 'delete: breakpoint id returned by set.' },
                username: { type: 'string', description: 'SAP user the breakpoint fires for (default: the destination user).' },
                ...DESTINATION_PARAM,
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        action: { type: 'string', required: true },
                        destination: { type: 'string', required: true },
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
                        note: { type: 'string' },
                    },
                },
                render: (_args, value) => {
                    if (value.action === 'set') {
                        const bps = (value.breakpoints ?? []);
                        return text(`breakpoint(s) set on ${value.destination}:\n` +
                            bps.map((b) => `- id ${b.id} → ${b.uri}${b.line ? ` line ${b.line}` : ''}`).join('\n') +
                            '\nnext: trigger the code path, then adt_debug_session {action:"listen"}');
                    }
                    return text(`breakpoint ${value.deleted ? 'deleted' : 'not deleted'} on ${value.destination}${value.note ? ` — ${value.note}` : ''}`);
                },
            },
            execute: async (args, exec) => {
                const entry = await registry.require(destinationOf(args), sessionCwd(exec));
                entry.policy.assertDebuggerAllowed('adt_debug_breakpoint');
                const action = optStr(args.action);
                const user = optStr(args.username)?.toUpperCase();
                if (action === 'set') {
                    const line = args.line;
                    if (typeof line !== 'number' || line < 1)
                        throw new Error('adt_debug_breakpoint: `line` (1-based) is required for set');
                    let uri = optStr(args.objectUri);
                    if (!uri) {
                        const name = optStr(args.name);
                        if (!name)
                            throw new Error('adt_debug_breakpoint: provide objectUri or name(+type) for set');
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
                if (action === 'delete') {
                    const id = optStr(args.id);
                    if (!id)
                        throw new Error('adt_debug_breakpoint: `id` (from set) is required for delete');
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
                throw new Error(`adt_debug_breakpoint: unknown action '${action}' (set or delete)`);
            },
        }),
        defineTool({
            name: 'adt_debug_step',
            description: 'Step the stopped ABAP debuggee: stepInto (F5), stepOver (F6), stepReturn (F7), stepContinue (F8 — run free ' +
                'until the next breakpoint), or terminateDebuggee (end the debugged process). Only valid while a breakpoint ' +
                'hit is stopped (see adt_debug_session listen).',
            parameters: {
                step: {
                    type: 'string',
                    enum: ['stepInto', 'stepOver', 'stepReturn', 'stepContinue', 'terminateDebuggee'],
                    required: true,
                    description: Object.entries(STEP_NAMES).map(([k, v]) => `${k} = ${v}`).join('; '),
                },
                ...DESTINATION_PARAM,
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        step: { type: 'string', required: true },
                        destination: { type: 'string', required: true },
                        result: { type: 'object', additionalProperties: true },
                    },
                },
                render: (_args, value) => {
                    const r = (value.result ?? {});
                    const lines = [
                        `${value.step} on ${value.destination}: ` +
                            `${r.program ?? '?'}${r.line ? ` line ${r.line}` : ''}` +
                            (r.isSteppingPossible === false ? ' (stepping no longer possible — debuggee running or ended)' : ''),
                    ];
                    if (r.reachedBreakpoints?.length)
                        lines.push(`reached breakpoints: ${r.reachedBreakpoints.map((b) => b.id).join(', ')}`);
                    return text(lines.join('\n'));
                },
            },
            execute: async (args, exec) => {
                const entry = await registry.require(destinationOf(args), sessionCwd(exec));
                entry.policy.assertDebuggerAllowed('adt_debug_step');
                const step = optStr(args.step);
                if (!step || !(step in STEP_NAMES)) {
                    throw new Error(`adt_debug_step: unknown step '${step}' (${Object.keys(STEP_NAMES).join(', ')})`);
                }
                const result = await entry.client.debuggerStep({
                    step: step,
                    signal: exec.signal,
                });
                return {
                    step,
                    destination: entry.config.name,
                    result: { ...result, reachedBreakpoints: result.reachedBreakpoints.map((b) => ({ ...b })) },
                };
            },
        }),
        defineTool({
            name: 'adt_debug_inspect',
            description: 'Inspect the stopped ABAP debuggee: `variables` reads the values of named variables (LV_COUNT, WA_MARA, ' +
                'IT_TABLE…), `stack` returns the call stack with program/include/line per frame (absent on BASIS < ~7.51 — ' +
                'reported as unavailable). Read-only; only valid while stopped at a breakpoint hit.',
            parameters: {
                action: { type: 'string', enum: ['variables', 'stack'], required: true },
                variables: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'action=variables: variable names to read (uppercase ABAP names).',
                },
                ...DESTINATION_PARAM,
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        action: { type: 'string', required: true },
                        destination: { type: 'string', required: true },
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
                    },
                },
                render: (_args, value) => {
                    if (value.action === 'variables') {
                        const vars = (value.variables ?? []);
                        if (vars.length === 0)
                            return text('no variables returned (not stopped, or names not found)');
                        return text(vars
                            .map((v) => `- ${v.name}: ${v.value ?? '?'}${v.declaredTypeName ? ` (${v.declaredTypeName})` : ''}${v.readOnly ? ' [read-only]' : ''}`)
                            .join('\n'));
                    }
                    const stack = (value.stack ?? {});
                    if (stack.unavailable)
                        return text(`stack unavailable: ${stack.note ?? 'backend lacks /debugger/stack'}`);
                    return text(`call stack (cursor at frame ${stack.cursorIndex ?? 0}):\n` +
                        (stack.entries ?? [])
                            .map((e) => `- #${e.stackPosition} ${e.programName ?? '?'}${e.includeName && e.includeName !== e.programName ? ` (include ${e.includeName})` : ''}${e.line ? ` line ${e.line}` : ''}${e.eventName ? ` [${e.eventType ?? ''} ${e.eventName}]` : ''}`)
                            .join('\n'));
                },
            },
            execute: async (args, exec) => {
                const entry = await registry.require(destinationOf(args), sessionCwd(exec));
                entry.policy.assertDebuggerAllowed('adt_debug_inspect');
                const action = optStr(args.action);
                if (action === 'variables') {
                    const names = Array.isArray(args.variables) ? args.variables.map(String).filter(Boolean) : [];
                    if (names.length === 0)
                        throw new Error('adt_debug_inspect: `variables` (non-empty name list) is required');
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
                throw new Error(`adt_debug_inspect: unknown action '${action}' (variables or stack)`);
            },
        }),
        defineTool({
            name: 'adt_debug_set_variable',
            description: 'Change the VALUE of one variable in the stopped ABAP debuggee (watchpoint-style value override). ' +
                'DANGEROUS: the altered value steers live program behavior. Double opt-in policy: allowDebugger AND ' +
                'allowDebugVariables must both be true (both default false); read-only variables are refused by the backend.',
            parameters: {
                name: { type: 'string', required: true, description: 'Variable name (uppercase), must exist in the current frame.' },
                value: { type: 'string', required: true, description: 'New value as ABAP literal text, e.g. 42 or NEWTEXT.' },
                ...DESTINATION_PARAM,
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        name: { type: 'string', required: true },
                        value: { type: 'string', required: true },
                        destination: { type: 'string', required: true },
                    },
                },
                render: (_args, value) => text(`variable ${value.name} set to ${value.value} on ${value.destination}`),
            },
            execute: async (args, exec) => {
                const entry = await registry.require(destinationOf(args), sessionCwd(exec));
                entry.policy.assertDebuggerAllowed('adt_debug_set_variable');
                entry.policy.assertDebugVariablesAllowed('adt_debug_set_variable');
                const name = optStr(args.name)?.toUpperCase();
                const value = optStr(args.value);
                if (!name || value === undefined)
                    throw new Error('adt_debug_set_variable: `name` and `value` are required');
                await entry.client.debuggerSetVariable({ name, value, signal: exec.signal });
                return { name, value, destination: entry.config.name };
            },
        }),
    ];
}
//# sourceMappingURL=debugger.js.map