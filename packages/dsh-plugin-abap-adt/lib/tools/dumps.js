/**
 * Error-analysis tools — ABAP runtime dumps (the ST22 short-dump analysis).
 *
 * `adt_list_dumps` walks the runtime-dumps Atom feed (time/user filtered,
 * server-side paging); `adt_get_dump` reads one dump in three views: the
 * structured XML (parsed to sections), the HTML summary and the plain-text
 * analysis view. Read-only, no policy.
 *
 * This closes the "error analysis" loop: after a run/test fails with a
 * runtime error the agent can pull the actual dump — exception type, program,
 * user, error analysis text — without leaving the tool family.
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { AdtError } from '@nefevcore/abap-adt-protocol';
import { DESTINATION_PARAM, clampWithNote, destinationOf, optStr, text } from './common.js';
/** `YYYYMMDD` / `YYYYMMDDHHMMSS` sanity for the time-range filters. */
function normalizeStamp(value, label) {
    const trimmed = value.trim();
    if (!/^\d{8}(\d{6})?$/.test(trimmed)) {
        throw new Error(`adt_list_dumps: ${label} must be YYYYMMDD or YYYYMMDDHHMMSS, got '${value}'`);
    }
    return trimmed;
}
export function dumpTools(deps) {
    const { registry } = deps;
    const listDumps = defineTool({
        name: 'adt_list_dumps',
        description: 'List ABAP runtime dumps (short dumps, ST22) from the target system. Filter by user, time range ' +
            '(from/to, YYYYMMDD or YYYYMMDDHHMMSS) and page with top/skip. Use after a program/class/unit run ' +
            'failed with a runtime error to find the exact dump, then adt_get_dump for the analysis. Read-only.',
        parameters: {
            user: { type: 'string', description: 'Only dumps of this session user (default: all users).' },
            from: { type: 'string', description: 'Time-range start, YYYYMMDD or YYYYMMDDHHMMSS (server-side).' },
            to: { type: 'string', description: 'Time-range end, YYYYMMDD or YYYYMMDDHHMMSS (server-side).' },
            top: { type: 'integer', description: 'Max dumps to return (default 20, clamped to 1–100).' },
            skip: { type: 'integer', description: 'Skip the first N feed entries (server-side paging).' },
            ...DESTINATION_PARAM,
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    count: { type: 'integer', required: true },
                    note: { type: 'string' },
                    dumps: {
                        type: 'array',
                        required: true,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                id: { type: 'string', required: true },
                                title: { type: 'string', required: true },
                                category: { type: 'string' },
                                user: { type: 'string' },
                                updatedAt: { type: 'string' },
                            },
                        },
                    },
                },
            },
            render: (_args, value) => {
                const lines = [`Runtime dumps (${value.count}):`];
                for (const d of value.dumps) {
                    lines.push(`- [${d.title}] ${d.id}${d.updatedAt ? ` @ ${d.updatedAt}` : ''}${d.user ? ` by ${d.user}` : ''}`);
                    if (d.category)
                        lines.push(`    ${d.category}`);
                }
                if (value.dumps.length === 0)
                    lines.push('(no dumps match the filters — a clean system or wrong user/range)');
                if (value.note)
                    lines.push(`Note: ${value.note}`);
                return text(lines.join('\n'));
            },
        },
        isConcurrencySafe: () => true,
        execute: async (args, exec) => {
            const entry = registry.require(destinationOf(args));
            const clamp = clampWithNote(Number(args.top ?? 20), 1, 100, 'top');
            const skip = Math.max(Number(args.skip ?? 0) || 0, 0);
            const notes = [];
            if (clamp.note)
                notes.push(clamp.note);
            let dumps;
            try {
                dumps = await entry.client.listDumps({
                    user: optStr(args.user),
                    from: optStr(args.from) ? normalizeStamp(String(args.from), 'from') : undefined,
                    to: optStr(args.to) ? normalizeStamp(String(args.to), 'to') : undefined,
                    top: clamp.value,
                    skip: skip > 0 ? skip : undefined,
                    signal: exec.signal,
                });
            }
            catch (error) {
                // Old / restricted profiles may not ship the runtime-dumps service.
                if (error instanceof AdtError && (error.status === 404 || error.status === 405)) {
                    throw new Error(`Runtime dumps are not available on destination '${entry.config.name}' (HTTP ${error.status}) — ` +
                        'this ADT profile does not expose the /runtime/dumps service (BASIS < 7.5x). ' +
                        'Analyze errors from the run output / unit test messages instead.');
                }
                throw error;
            }
            return {
                count: dumps.length,
                note: notes.length ? notes.join('; ') : undefined,
                dumps: dumps.map((d) => ({
                    id: d.id,
                    title: d.title,
                    category: d.category,
                    user: d.user,
                    updatedAt: d.updatedAt,
                })),
            };
        },
    });
    const getDump = defineTool({
        name: 'adt_get_dump',
        description: 'Read one ABAP runtime dump (ST22) in full. `view`: default = structured sections (error type, ' +
            'program, user, error analysis); summary = HTML overview; formatted = plain-text analysis view. ' +
            'Get the dump id from adt_list_dumps. Read-only.',
        parameters: {
            dumpId: { type: 'string', required: true, description: 'Dump id from adt_list_dumps (compound key, no slashes).' },
            view: {
                type: 'string',
                enum: ['default', 'summary', 'formatted'],
                description: 'Representation (default: structured sections).',
            },
            ...DESTINATION_PARAM,
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    id: { type: 'string', required: true },
                    view: { type: 'string', required: true },
                    title: { type: 'string' },
                    sections: {
                        type: 'array',
                        required: true,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                name: { type: 'string', required: true },
                                value: { type: 'string', required: true },
                            },
                        },
                    },
                    raw: { type: 'string', description: 'Raw body (summary/formatted views).' },
                },
            },
            render: (_args, value) => {
                const lines = [`Dump ${value.id}${value.title ? ` — ${value.title}` : ''} (view: ${value.view})`];
                if (value.raw !== undefined) {
                    lines.push('', value.raw);
                }
                else {
                    for (const s of value.sections)
                        lines.push(`${s.name}: ${s.value}`);
                }
                return text(lines.join('\n'));
            },
        },
        isConcurrencySafe: () => true,
        execute: async (args, exec) => {
            const entry = registry.require(destinationOf(args));
            const dumpId = String(args.dumpId ?? '').trim();
            if (!dumpId)
                throw new Error('adt_get_dump: `dumpId` is required (from adt_list_dumps)');
            const view = (optStr(args.view) ?? 'default');
            const detail = await entry.client.getDump(dumpId, { view, signal: exec.signal });
            return {
                id: detail.id,
                view: detail.view,
                title: detail.title,
                sections: detail.sections.map((s) => ({ name: s.name, value: s.value })),
                raw: detail.raw,
            };
        },
    });
    return [listDumps, getDump];
}
//# sourceMappingURL=dumps.js.map