import { defineTool } from '@deepseek-ai/dsh-tools';
import { DESTINATION_PARAM, OBJECTS_PARAM, assertObjectEditable, destinationOf, text, } from './common.js';
import { resolveObjects, typeLabel } from '../resolve.js';
export function lifecycleTools(deps) {
    const { registry } = deps;
    const activationOutput = {
        schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
                success: { type: 'boolean', required: true },
                items: {
                    type: 'array',
                    required: true,
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            name: { type: 'string', required: true },
                            type: { type: 'string', required: true },
                            status: { type: 'string', required: true },
                            message: { type: 'string' },
                            errors: {
                                type: 'array',
                                required: true,
                                items: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        text: { type: 'string', required: true },
                                        line: { type: 'integer' },
                                        code: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                },
                hints: {
                    type: 'array',
                    required: true,
                    items: { type: 'string' },
                    description: 'Actionable follow-up hints (include cascading, check-vs-activate scope).',
                },
            },
        },
        render: (_args, value) => text([
            value.success ? 'ACTIVATION SUCCESSFUL' : 'ACTIVATION FAILED',
            ...value.items.map((item) => {
                const lines = [`- ${item.name} [${typeLabel(item.type)}]: ${item.status}`];
                if (item.message)
                    lines.push(`  ${item.message}`);
                for (const e of item.errors) {
                    lines.push(`  ERROR${e.line ? ` at line ${e.line}` : ''}${e.code ? ` (${e.code})` : ''}: ${e.text}`);
                }
                return lines.join('\n');
            }),
            ...(value.hints ?? []).map((h) => `HINT: ${h}`),
        ].join('\n')),
    };
    const activate = defineTool({
        name: 'adt_activate',
        description: 'Activate ABAP development objects on the system. Returns per-object status; syntax errors block activation. ' +
            'IMPORTANT: activate ALL related objects in ONE call — `objects` accepts a list. Most backends do NOT cascade ' +
            'activation from a PROG main program (or FUGR) to its includes (TOP/SCR/...): a successful result for the main ' +
            'object alone does NOT mean the program is fully active. Pass the main object AND its includes together, and ' +
            'verify leftovers with adt_version_diff (saved vs active). Also note adt_check passing does NOT guarantee ' +
            'activation succeeds — the activation preaudit has a wider scope (cross-object consistency, main program + ' +
            'includes joint check, duplicate declarations). ' +
            'Pass `transport` when the objects\' package requires a transport request (see adt_list_transports).',
        parameters: {
            ...OBJECTS_PARAM,
            transport: { type: 'string', description: 'Transport request number, e.g. S4HK900001.' },
            checkOnly: { type: 'boolean', description: 'Syntax-check without activating (default false).' },
            ...DESTINATION_PARAM,
        },
        output: activationOutput,
        execute: async (args, exec) => {
            const entry = registry.require(destinationOf(args));
            const checkOnly = args.checkOnly === true;
            const inputs = args.objects;
            const refs = await resolveObjects(entry.client, inputs, exec.signal);
            // Permission checks. checkOnly (syntax pre-audit) changes nothing and is
            // always allowed; a real activation is an edit and must satisfy the
            // policy for every object.
            const transport = typeof args.transport === 'string' && args.transport.trim().length > 0 ? args.transport.trim() : undefined;
            if (transport) {
                entry.policy.assertTransportsEnabled('adt_activate');
                entry.policy.assertTransportAllowed(transport, 'adt_activate');
            }
            if (!checkOnly) {
                for (let i = 0; i < refs.length; i++) {
                    await assertObjectEditable(entry, refs[i], {
                        toolName: `adt_activate (${refs[i].name})`,
                        packageHint: inputs[i]?.packageName,
                        signal: exec.signal,
                    });
                }
            }
            const result = await entry.client.activate(refs, {
                transport,
                checkOnly,
                signal: exec.signal,
            });
            // Actionable follow-up hints (also part of the structured output):
            //  - a real (non-checkOnly) activation that succeeds for PROG/FUGR
            //    mains: most backends do NOT cascade to includes — say so before
            //    the agent mistakes "main activated" for "program fully active".
            //  - a failed activation: adt_check passing is NOT evidence it should
            //    have worked — the preaudit has a wider scope.
            const hints = [];
            const mains = refs.filter((r) => r.category === 'PROG' || r.category === 'FUGR');
            if (!checkOnly && result.success && mains.length > 0) {
                hints.push(`${mains.map((r) => r.name).join(', ')}: activation of a main program / function group does NOT cascade to its includes (TOP/SCR/...) on some backends — pass the main object AND its includes together in \`objects\` (one call), and verify leftovers with adt_version_diff (saved version vs active)`);
            }
            if (!result.success) {
                hints.push('activation failed — note that adt_check PASSING does not guarantee activation succeeds: the activation ' +
                    'preaudit has a wider scope (cross-object consistency, main program + includes joint check, duplicate ' +
                    'declarations). Fix the per-object errors above (line numbers refer to the current source) and ' +
                    're-activate with ALL related objects in one call');
            }
            return {
                success: result.success,
                items: result.items.map((i) => ({
                    name: i.name,
                    type: i.type,
                    status: i.status,
                    message: i.message,
                    errors: i.syntaxErrors.map((e) => ({
                        text: e.text,
                        line: e.line,
                        code: e.code,
                    })),
                })),
                hints,
            };
        },
    });
    const check = defineTool({
        name: 'adt_check',
        description: 'Run a syntax check (without activating) on ABAP objects. Reports per-object errors/warnings ' +
            '(each message carries the object it belongs to). ' +
            'SCOPE WARNING: this checkrun is narrower than the activation preaudit — PASSING here does NOT guarantee ' +
            'adt_activate will succeed (cross-object consistency, main program + includes joint checks and duplicate ' +
            'declarations are only caught at activation). Treat a pass as "no local syntax errors", not "ready".',
        parameters: {
            ...OBJECTS_PARAM,
            ...DESTINATION_PARAM,
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    success: { type: 'boolean', required: true },
                    messages: {
                        type: 'array',
                        required: true,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                objectName: { type: 'string', required: true },
                                severity: { type: 'string', required: true },
                                text: { type: 'string', required: true },
                                line: { type: 'integer' },
                                code: { type: 'string' },
                            },
                        },
                    },
                    hints: {
                        type: 'array',
                        required: true,
                        items: { type: 'string' },
                        description: 'Scope caveats of the check vs the activation preaudit.',
                    },
                },
            },
            render: (_args, value) => text([
                value.success ? 'CHECK PASSED' : 'CHECK FAILED',
                ...value.messages.map((m) => `  ${m.objectName} ${m.severity}${m.line ? `:${m.line}` : ''}: ${m.text}`),
                ...(value.hints ?? []).map((h) => `HINT: ${h}`),
            ].join('\n')),
        },
        isConcurrencySafe: () => true,
        execute: async (args, exec) => {
            const entry = registry.require(destinationOf(args));
            const inputs = args.objects;
            const refs = await resolveObjects(entry.client, inputs, exec.signal);
            // The checkrun response carries no per-object attribution, so multi-
            // object checks run one checkrun per object and tag every message.
            // Syntax checks are cheap; correctness of attribution is worth the N
            // round-trips.
            const messages = [];
            for (const ref of refs) {
                const result = await entry.client.check([ref], { signal: exec.signal });
                for (const m of result.messages) {
                    messages.push({
                        objectName: ref.name,
                        severity: m.severity,
                        text: m.text,
                        line: m.line,
                        code: m.code,
                    });
                }
            }
            const success = messages.every((m) => m.severity !== 'E' && m.severity !== 'A');
            return {
                success,
                messages,
                hints: success
                    ? [
                        'syntax check passed — this does NOT guarantee activation will succeed: the activation preaudit has a wider scope (cross-object consistency, main program + includes joint check, duplicate declarations). When activation matters, run adt_activate (checkOnly for the preaudit-grade check) with ALL related objects in one call',
                    ]
                    : ['fix the errors above (line numbers refer to the current source); note activation can still surface additional cross-object errors adt_check does not see'],
            };
        },
    });
    return [activate, check];
}
//# sourceMappingURL=lifecycle.js.map