/**
 * adt_selfcheck — a capability sweep in the spirit of vsp's internal/mcp/
 * sweep.go: advertised tools can be registered, routed, user-reachable — and
 * still never have returned a correct answer. The cheap half of the check
 * needs no system at all (tests pin the catalog); the expensive half asks a
 * live destination: "called with an input that HAS an answer, does each
 * read-only capability produce one?"
 *
 * Two design rules copied from vsp, both learned by breaking them:
 *  1. a sweep that cannot cover everything must say what it did not cover —
 *     capabilities that write or execute code are never probed and are
 *     LISTED as unprobed, never quietly omitted;
 *  2. the sweep never writes (or runs) anything.
 *
 * "Dead" (the verdict this exists for) needs an ORACLE: a second,
 * independent path that says there is something to find. search↔read,
 * search(package)↔package_content, read↔$batch, ping↔system_info — when the
 * oracle says content exists and the capability returns nothing, that is a
 * dead feature, not an empty answer.
 */
import { defineTool } from '../tooldef.js';
import { AdtError } from '@nefevcore/abap-adt-protocol';
import { AdtPolicyError } from '../policy.js';
import { sessionCwd, DESTINATION_PARAM, destinationOf, optStr, text } from './common.js';
/** Read-only adt_* tools this sweep exercises, by capability. */
const COVERED_TOOLS = new Set([
    'adt_search',
    'adt_read_object',
    'adt_package_content',
    'adt_where_used',
    'adt_object_versions',
    'adt_list_dumps',
    'adt_get_dump',
    'adt_list_transports',
    'adt_system_info',
    'adt_ping',
    'adt_batch',
]);
/**
 * Every registered adt_* tool the sweep does NOT probe, so the report's
 * coverage statement is a list, never a gap. Mutating/executing tools are
 * out by principle (rule 2); the rest need inputs the sweep cannot invent.
 */
export const UNPROBED_TOOLS = [
    'adt_activate',
    'adt_check',
    'adt_cochange',
    'adt_create_destination',
    'adt_create_object',
    'adt_crud',
    'adt_data_preview',
    'adt_debug_breakpoint',
    'adt_debug_inspect',
    'adt_debug_session',
    'adt_debug_set_variable',
    'adt_debug_step',
    'adt_delete_object',
    'adt_edit_object',
    'adt_execute',
    'adt_export_objects',
    'adt_get_atc_result',
    'adt_get_transport',
    'adt_list_atc_runs',
    'adt_list_destinations',
    'adt_list_gui_connections',
    'adt_local_check',
    'adt_lock_info',
    'adt_permissions',
    'adt_push_object',
    'adt_read_structure',
    'adt_read_textelements',
    'adt_release_gate',
    'adt_run_atc',
    'adt_run_unit_tests',
    'adt_selfcheck',
    'adt_unlock_all',
    'adt_version_diff',
    'adt_write_object',
    'adt_write_structure',
];
function classify(raw) {
    if (raw.kind === 'ok')
        return { verdict: 'answered', detail: raw.detail };
    if (raw.kind === 'okEmpty')
        return { verdict: 'empty', detail: raw.detail };
    const error = raw.error;
    if (error instanceof AdtPolicyError)
        return { verdict: 'refused', detail: `policy refusal (${error.rule}): ${raw.detail}` };
    if (error instanceof AdtError && (error.status === 404 || error.status === 405)) {
        return { verdict: 'absent', detail: `backend does not expose this service (HTTP ${error.status})` };
    }
    return { verdict: 'broken', detail: `${error.message}` };
}
async function attempt(label, run) {
    try {
        return await run();
    }
    catch (error) {
        return { kind: 'error', error, detail: label };
    }
}
export function selfcheckTools(deps) {
    const { registry } = deps;
    const selfcheck = defineTool({
        name: 'adt_selfcheck',
        description: 'Capability sweep of this destination (READ-ONLY — never writes, never executes code): runs every ' +
            'read-only capability against a probe object and reports a verdict per capability — answered / empty / ' +
            'absent (backend lacks the service) / refused (policy) / dead (returned nothing while an independent ' +
            'oracle says there is something to find) / broken (our error). Use it to verify a new system connection, ' +
            'a plugin upgrade, or to explain why a capability returns nothing. The probe object defaults to the first ' +
            'Z*-class the search finds; pass `name`(+`type`) to probe a specific object. The report also names every ' +
            'registered tool the sweep does NOT cover (mutating/executing tools are out by principle).',
        parameters: {
            name: { type: 'string', description: 'Probe object name (default: first class found by search "Z*").' },
            type: { type: 'string', description: 'Probe object type (short form, e.g. CLAS).' },
            packageName: { type: 'string', description: 'Restrict the probe-object search to this package.' },
            ...DESTINATION_PARAM,
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    destination: { type: 'string', required: true },
                    probeObject: { type: 'string', description: 'Object the probes ran against (empty when none was found).' },
                    checks: {
                        type: 'array',
                        required: true,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                capability: { type: 'string', required: true },
                                tool: { type: 'string', required: true },
                                verdict: { type: 'string', required: true, enum: ['answered', 'empty', 'dead', 'absent', 'refused', 'broken', 'skipped'] },
                                detail: { type: 'string', required: true },
                            },
                        },
                    },
                    summary: {
                        type: 'object',
                        required: true,
                        additionalProperties: false,
                        properties: {
                            answered: { type: 'integer', required: true },
                            empty: { type: 'integer', required: true },
                            dead: { type: 'integer', required: true },
                            absent: { type: 'integer', required: true },
                            refused: { type: 'integer', required: true },
                            broken: { type: 'integer', required: true },
                            skipped: { type: 'integer', required: true },
                        },
                    },
                    unprobedTools: { type: 'array', required: true, items: { type: 'string' } },
                    note: { type: 'string', required: true },
                },
            },
            render: (_args, value) => {
                const lines = [`Self-check on ${value.destination}${value.probeObject ? ` (probe: ${value.probeObject})` : ' (NO probe object found)'}`];
                for (const c of value.checks) {
                    lines.push(`- [${c.verdict}] ${c.tool} (${c.capability}) — ${c.detail}`);
                }
                const s = value.summary;
                lines.push('', `Summary: ${s.answered} answered, ${s.empty} empty, ${s.dead} DEAD, ${s.absent} absent, ${s.refused} refused, ${s.broken} broken, ${s.skipped} skipped`);
                lines.push(`Coverage: ${value.checks.length} capabilities probed; ${value.unprobedTools.length} registered tools intentionally not probed (mutating/executing or input-dependent): ${value.unprobedTools.join(', ')}`);
                lines.push(value.note);
                return text(lines.join('\n'));
            },
        },
        isConcurrencySafe: () => true,
        execute: async (args, exec) => {
            const entry = await registry.require(destinationOf(args), sessionCwd(exec));
            const client = entry.client;
            const rows = [];
            // ---- Probe-object selection (args > first Z*-class hit). ----
            let probe;
            const wanted = optStr(args.name)?.toUpperCase();
            if (wanted) {
                const hits = await client.searchObjects(wanted, { maxResults: 5, signal: exec.signal }).catch(() => []);
                const exact = hits.find((h) => h.objectName.toUpperCase() === wanted);
                if (exact)
                    probe = { name: exact.objectName, type: exact.type ?? '', uri: exact.uri, packageName: exact.packageName };
                else
                    rows.push({ capability: 'probe selection', tool: 'adt_search', verdict: 'skipped', detail: `no exact match for ${wanted} — pass another name` });
            }
            else {
                const hits = await client
                    .search('Z*', { maxResults: 5, packageName: optStr(args.packageName)?.toUpperCase(), signal: exec.signal })
                    .catch(() => ({ objects: [], sources: [] }));
                const hit = hits.objects.find((o) => (o.type ?? '').toUpperCase().startsWith('CLAS')) ?? hits.objects[0];
                if (hit)
                    probe = { name: hit.objectName, type: hit.type ?? '', uri: hit.uri, packageName: hit.packageName };
            }
            // ---- Capability probes (evidence collected raw; oracle verdicts after).
            const searchCap = await attempt('search', async () => {
                const hits = await client.searchObjects(probe?.name ?? 'Z*', { maxResults: 5, signal: exec.signal });
                return hits.length > 0
                    ? { kind: 'ok', detail: `${hits.length} hit(s) for "${probe?.name ?? 'Z*'}"` }
                    : { kind: 'okEmpty', detail: 'no hits' };
            });
            const searchExists = searchCap.kind === 'ok';
            const readCap = await attempt('read', async () => {
                const parsed = await client.readSource(probe.uri, { signal: exec.signal });
                return parsed.source.trim().length > 0
                    ? { kind: 'ok', detail: `${parsed.source.split('\n').length} lines` }
                    : { kind: 'okEmpty', detail: 'empty source' };
            });
            const packageCap = await attempt('package_content', async () => {
                const refs = await client.packageContent(probe.packageName ?? '$TMP', { signal: exec.signal });
                const contains = refs.some((r) => r.name.toUpperCase() === probe.name.toUpperCase());
                return contains
                    ? { kind: 'ok', detail: `${probe.packageName} lists ${refs.length} object(s) including ${probe.name}` }
                    : { kind: 'okEmpty', detail: `${probe.packageName} (${refs.length} objects) does not list ${probe.name}` };
            });
            const whereUsedCap = await attempt('where_used', async () => {
                const result = await client.getWhereUsed(probe.uri, { enableAllTypes: true, signal: exec.signal });
                return result.totalReferences > 0
                    ? { kind: 'ok', detail: `${result.totalReferences} referencing object(s)` }
                    : { kind: 'okEmpty', detail: 'no references (truthful for a fresh object)' };
            });
            const versionsCap = await attempt('object_versions', async () => {
                const versions = await client.getVersions(probe.uri, { signal: exec.signal });
                return versions.length > 0
                    ? { kind: 'ok', detail: `${versions.length} version(s)` }
                    : { kind: 'okEmpty', detail: 'no version feed' };
            });
            const activeCap = await attempt('active_version', async () => {
                const parsed = await client.readSource(probe.uri, { version: 'active', signal: exec.signal });
                return parsed.source.trim().length > 0
                    ? { kind: 'ok', detail: 'active version readable' }
                    : { kind: 'okEmpty', detail: 'empty active version' };
            });
            const dumpsCap = await attempt('dumps_list', async () => {
                const dumps = await client.listDumps({ signal: exec.signal });
                return dumps.length > 0
                    ? { kind: 'ok', detail: `${dumps.length} dump(s)` }
                    : { kind: 'okEmpty', detail: 'no dumps (truthful on a healthy system)' };
            });
            const transportsCap = await attempt('transports_list', async () => {
                const transports = await client.listTransports({ signal: exec.signal });
                return transports.length > 0
                    ? { kind: 'ok', detail: `${transports.length} transport(s)` }
                    : { kind: 'okEmpty', detail: 'no open transports (truthful)' };
            });
            const pingCap = await attempt('ping', async () => {
                const status = await client.ping({ signal: exec.signal });
                return status.ok ? { kind: 'ok', detail: 'reachable' } : { kind: 'okEmpty', detail: 'endpoint answered but not ok' };
            });
            const systemCap = await attempt('system_info', async () => {
                const info = await client.systemInfo({ signal: exec.signal });
                return { kind: 'ok', detail: `${info.systemId || '?'} ${info.release || ''}`.trim() || 'system info' };
            });
            const batchCap = await attempt('batch_get', async () => {
                const responses = await client.batch([{ method: 'GET', path: `${probe.uri}/source/main`, accept: 'text/plain' }], { signal: exec.signal });
                const body = responses[0]?.body;
                const readBack = await client.readSource(probe.uri, { signal: exec.signal });
                if (typeof body !== 'string' || body.length === 0)
                    return { kind: 'okEmpty', detail: '$batch GET returned no body' };
                if (body !== readBack.source)
                    return { kind: 'error', error: new Error('$batch body differs from a direct read'), detail: 'batch_get' };
                return { kind: 'ok', detail: '$batch GET matches a direct read' };
            });
            // Second-level probe: dump detail only when the feed has rows.
            let dumpDetailCap = { kind: 'okEmpty', detail: 'not attempted: dump feed is empty' };
            if (dumpsCap.kind === 'error')
                dumpDetailCap = { kind: 'okEmpty', detail: 'not attempted: dump feed unavailable' };
            if (dumpsCap.kind === 'ok') {
                dumpDetailCap = await attempt('get_dump', async () => {
                    const dumps = await client.listDumps({ signal: exec.signal });
                    const first = dumps[0];
                    const detail = await client.getDump(first.id, { view: 'formatted', signal: exec.signal });
                    return (detail.raw ?? '').length > 0
                        ? { kind: 'ok', detail: `dump ${first.id.slice(0, 16)}… readable` }
                        : { kind: 'okEmpty', detail: 'dump detail empty' };
                });
            }
            // ---- Assemble rows. Object-dependent probes are SKIPPED (named, with
            // the reason) when no probe object is available — never silently
            // dropped and never misreported as an empty answer.
            const push = (capability, tool, raw, oracleDead) => {
                if (oracleDead) {
                    rows.push({
                        capability,
                        tool,
                        verdict: 'dead',
                        detail: `returned nothing while an independent oracle says the content exists — ${classify(raw).detail}`,
                    });
                    return;
                }
                const c = classify(raw);
                rows.push({ capability, tool, verdict: c.verdict, detail: c.detail });
            };
            /** Object-dependent probe: without a probe object the verdict is
             *  `skipped` (the sweep's fault — see UNPROBED_TOOLS philosophy). */
            const pushObj = (capability, tool, raw, oracleDead) => {
                if (!probe) {
                    rows.push({ capability, tool, verdict: 'skipped', detail: 'no probe object available — pass name (+type)' });
                    return;
                }
                push(capability, tool, raw, oracleDead);
            };
            push('object search', 'adt_search', searchCap);
            pushObj('source read', 'adt_read_object', readCap, searchExists && readCap.kind !== 'ok');
            pushObj('package content', 'adt_package_content', packageCap, searchExists && probe?.packageName !== undefined && packageCap.kind !== 'ok');
            pushObj('where-used', 'adt_where_used', whereUsedCap);
            pushObj('version feed', 'adt_object_versions', versionsCap);
            pushObj('active version read', 'adt_read_object', activeCap);
            push('dump feed', 'adt_list_dumps', dumpsCap);
            push('dump detail', 'adt_get_dump', dumpDetailCap);
            push('transport feed', 'adt_list_transports', transportsCap);
            push('connectivity ping', 'adt_ping', pingCap);
            push('system info', 'adt_system_info', systemCap, pingCap.kind === 'ok' && systemCap.kind === 'error');
            pushObj('protocol $batch GET', 'adt_batch', batchCap);
            if (!probe && rows.every((r) => r.verdict !== 'skipped')) {
                rows.push({ capability: 'probe selection', tool: 'adt_search', verdict: 'skipped', detail: 'no object found to probe with — pass name (+type)' });
            }
            const summary = { answered: 0, empty: 0, dead: 0, absent: 0, refused: 0, broken: 0, skipped: 0 };
            for (const r of rows)
                summary[r.verdict] += 1;
            return {
                destination: entry.config.name,
                probeObject: probe ? `${probe.name} (${probe.type || '?'})` : '',
                checks: rows,
                summary,
                unprobedTools: [...UNPROBED_TOOLS],
                note: 'Read-only sweep: capabilities that write or execute code (activate/edit/execute/unit tests/ATC/gate/' +
                    'export/structure writes/lock management) are never probed — listed in unprobedTools by principle. ' +
                    'A "dead" verdict means the capability returned nothing while an independent oracle says there is ' +
                    'something to find; "empty" is a truthful answer, not a failure.',
            };
        },
    });
    return [selfcheck];
}
//# sourceMappingURL=selfcheck.js.map