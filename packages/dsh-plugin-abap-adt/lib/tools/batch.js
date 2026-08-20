import { defineTool } from '@deepseek-ai/dsh-tools';
import { DESTINATION_PARAM, clampWithNote, destinationOf, optStr, text } from './common.js';
import { resolveObject } from '../resolve.js';
/**
 * Batch & pipeline tools — capabilities that go beyond the interactive VS Code
 * ADT workflow:
 *
 *  - `adt_batch`          — protocol-level `$batch`: several ADT requests in
 *    ONE HTTP round-trip (fan-out reads without N sequential calls; optional
 *    write parts behind an explicit policy knob). Supersedes the former
 *    adt_batch_checks — package-wide ATC+Unit quality runs are covered by
 *    adt_release_gate, and arbitrary composition now happens here.
 *  - `adt_export_objects` — pull an object set's sources into a local folder
 *    (git-style versioning, offline review, backups).
 */
/** Hard cap per $batch call (protocol + context hygiene). */
const MAX_BATCH_PARTS = 50;
/** Response bodies beyond this are truncated in the tool output. */
const MAX_PART_BODY_CHARS = 4000;
/** Paths that dedicated, policy-checked tools own — never batchable. */
const FORBIDDEN_BATCH_PATHS = [
    { pattern: /\/cts\/transportrequests\/[^/]+\/release/i, reason: 'transport release is a human decision — no tool exposes it' },
    { pattern: /\/deletion\//i, reason: 'use adt_delete_object (policy-checked, lock-aware)' },
];
function validateBatchPart(part, index, allowWrites, toolName) {
    const method = part.method ?? 'GET';
    if (method !== 'GET' && method !== 'POST' && method !== 'PUT') {
        throw new Error(`${toolName}: requests[${index}] method must be GET, POST or PUT (got '${method}')`);
    }
    const path = part.path ?? '';
    if (!path.startsWith('/sap/bc/adt/') || path.includes('..')) {
        throw new Error(`${toolName}: requests[${index}] path must be an absolute ADT path starting with /sap/bc/adt/ (got '${path}')`);
    }
    for (const forbidden of FORBIDDEN_BATCH_PATHS) {
        if (forbidden.pattern.test(path)) {
            throw new Error(`${toolName}: requests[${index}] path is blocked in $batch — ${forbidden.reason}`);
        }
    }
    if (method !== 'GET' && !allowWrites) {
        throw new Error(`${toolName}: requests[${index}] uses ${method} but write parts are disabled (read-only GET fan-out is ` +
            'the default). Set allowWrites: true AND enable the destination policy knob allowBatchWrites ' +
            '(SAP_ALLOW_BATCH_WRITES) — generic write parts bypass per-object policy checks');
    }
}
export function batchTools(deps, ctx) {
    const { registry } = deps;
    /**
     * abaplint-compatible export file name (type-suffixed, e.g. `zcl_demo.clas.abap`),
     * so exported sources can be fed straight into adt_local_check / abaplint.
     * Falls back to the plain `<NAME>.abap` for types abaplint does not parse.
     */
    function exportFileName(ref) {
        const short = (ref.type.split('/')[0] ?? '').toLowerCase();
        const suffix = {
            prog: 'prog.abap', clas: 'clas.abap', intf: 'intf.abap',
            func: 'funcs.abap', fugr: 'fugr.abap', ddls: 'ddls.abap',
            tabl: 'tabl.abap', stru: 'stru.abap', msag: 'msag.abap',
            doma: 'doma.abap', dtel: 'dtel.abap', ttyp: 'ttyp.abap',
        };
        const named = suffix[short];
        return named ? `${ref.name}.${named}` : `${ref.name}.abap`;
    }
    const batch = defineTool({
        name: 'adt_batch',
        description: 'Protocol-level $batch: execute several ADT requests in ONE HTTP round-trip (multipart embedded ' +
            'HTTP, POST /sap/bc/adt/$batch). The agent-scale way to fan out reads — e.g. pull the sources of 20 ' +
            'objects, or object metadata + versions + lock state together — without N sequential calls. ' +
            'Read-only by design: GET parts always work; POST/PUT parts additionally need allowWrites:true AND ' +
            'the destination policy knob allowBatchWrites (generic embedded writes bypass per-object policy ' +
            'checks — prefer the dedicated write tools). Transport release / deletion paths are always blocked. ' +
            'Each request: {method, path, body?, contentType?, accept?}.',
        parameters: {
            requests: {
                type: 'array',
                required: true,
                description: `Embedded ADT requests (max ${MAX_BATCH_PARTS}). Each: {method: GET|POST|PUT, path: /sap/bc/adt/…, body?, contentType?, accept?}.`,
                items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        method: { type: 'string', enum: ['GET', 'POST', 'PUT'], description: 'HTTP method (default GET).' },
                        path: { type: 'string', required: true, description: 'Absolute ADT path, e.g. /sap/bc/adt/oo/classes/zcl_demo/source/main.' },
                        body: { type: 'string', description: 'Request body (write parts).' },
                        contentType: { type: 'string', description: 'Content-Type of the body (write parts).' },
                        accept: { type: 'string', description: 'Accept header for the embedded response (default application/xml).' },
                    },
                },
            },
            allowWrites: {
                type: 'boolean',
                description: 'Opt in to POST/PUT parts (also requires the destination policy knob allowBatchWrites).',
            },
            ...DESTINATION_PARAM,
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    requested: { type: 'integer', required: true },
                    ok: { type: 'integer', required: true, description: 'Parts with status < 400.' },
                    failed: { type: 'integer', required: true, description: 'Parts with status >= 400.' },
                    note: { type: 'string' },
                    parts: {
                        type: 'array',
                        required: true,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                index: { type: 'integer', required: true },
                                status: { type: 'integer', required: true },
                                statusText: { type: 'string' },
                                contentType: { type: 'string' },
                                chars: { type: 'integer', required: true, description: 'Full body length.' },
                                truncated: { type: 'boolean' },
                                body: { type: 'string', description: 'Response body (truncated beyond 4000 chars).' },
                            },
                        },
                    },
                },
            },
            render: (_args, value) => {
                const lines = [
                    `$batch: ${value.ok}/${value.requested} part(s) succeeded${value.failed ? `, ${value.failed} failed` : ''}`,
                ];
                if (value.note)
                    lines.push(`Note: ${value.note}`);
                for (const p of value.parts) {
                    lines.push(`  #${p.index} → HTTP ${p.status} ${p.statusText ?? ''} (${p.chars} chars${p.truncated ? ', truncated' : ''})`);
                }
                return text(lines.join('\n'));
            },
        },
        timeoutMs: 180_000,
        execute: async (args, exec) => {
            const entry = registry.require(destinationOf(args));
            const raw = Array.isArray(args.requests) ? args.requests : [];
            if (raw.length === 0)
                throw new Error('adt_batch: `requests` must contain at least one embedded request');
            const clamp = clampWithNote(raw.length, 1, MAX_BATCH_PARTS, 'requests');
            const parts = raw.slice(0, clamp.value);
            const notes = [];
            if (clamp.note)
                notes.push(clamp.note);
            // Policy read at call time: a write part requires BOTH the explicit
            // allowWrites flag and the destination knob (default off).
            const allowWrites = args.allowWrites === true && parts.some((p) => (p.method ?? 'GET') !== 'GET');
            if (parts.some((p) => (p.method ?? 'GET') !== 'GET')) {
                entry.policy.assertBatchWritesAllowed('adt_batch');
            }
            const normalized = parts.map((part, index) => {
                const method = (part.method ?? 'GET').toUpperCase();
                const checked = { ...part, method };
                validateBatchPart(checked, index, allowWrites || method === 'GET', 'adt_batch');
                return {
                    method,
                    path: part.path,
                    body: optStr(part.body),
                    contentType: optStr(part.contentType),
                    accept: optStr(part.accept),
                };
            });
            const responses = await entry.client.batch(normalized, { signal: exec.signal });
            const rendered = responses.map((r) => {
                const truncated = r.body.length > MAX_PART_BODY_CHARS;
                if (truncated) {
                    notes.push(`part #${r.index} body truncated to ${MAX_PART_BODY_CHARS} of ${r.body.length} chars`);
                }
                return {
                    index: r.index,
                    status: r.status,
                    statusText: r.statusText,
                    contentType: r.contentType,
                    chars: r.body.length,
                    truncated: truncated || undefined,
                    body: truncated ? r.body.slice(0, MAX_PART_BODY_CHARS) : r.body,
                };
            });
            return {
                requested: responses.length,
                ok: responses.filter((r) => r.status > 0 && r.status < 400).length,
                failed: responses.filter((r) => r.status === 0 || r.status >= 400).length,
                note: notes.length ? [...new Set(notes)].join('; ') : undefined,
                parts: rendered,
            };
        },
    });
    const exportObjects = defineTool({
        name: 'adt_export_objects',
        description: 'Export the sources of ABAP objects (by package or explicit list) into a local folder as .abap files — ' +
            'enabling git-style versioning, offline review and backups. Writes through the DSH filesystem (sandbox-aware).',
        parameters: {
            objects: {
                type: 'array',
                required: true,
                description: 'Explicit objects to export. Each: {name, type}. Deliberately explicit — no whole-package export; ' +
                    'build the list with adt_package_content / adt_search first.',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        name: { type: 'string', required: true },
                        type: { type: 'string' },
                    },
                },
            },
            targetDir: {
                type: 'string',
                required: true,
                description: 'Local directory to write the exported sources into (absolute path).',
            },
            maxObjects: { type: 'integer', description: 'Cap on exported objects (default 100, clamped to 1–500).' },
            ...DESTINATION_PARAM,
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    targetDir: { type: 'string', required: true },
                    exported: { type: 'integer', required: true },
                    failed: { type: 'integer', required: true },
                    truncated: { type: 'boolean' },
                    note: { type: 'string' },
                    files: {
                        type: 'array',
                        required: true,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                name: { type: 'string', required: true },
                                path: { type: 'string', required: true },
                                chars: { type: 'integer' },
                            },
                        },
                    },
                },
            },
            render: (_args, value) => text([
                `Exported ${value.exported} object(s) to ${value.targetDir}${value.failed ? ` (${value.failed} failed)` : ''}`,
                ...value.files.map((f) => `- ${f.name} → ${f.path}${f.chars ? ` (${f.chars} chars)` : ''}`),
            ].join('\n')),
        },
        timeoutMs: 600_000,
        execute: async (args, exec) => {
            const entry = registry.require(destinationOf(args));
            const fs = ctx.fs;
            if (!fs)
                throw new Error('adt_export_objects requires the dsh filesystem service');
            // Stamp the calling session's sandbox policy onto every write, exactly
            // like DSH's own fs tools: without it the fs backend falls back to a
            // session-less policy whose writable roots deny everything.
            let sandboxPolicy;
            try {
                const service = ctx.get('sandboxPolicy');
                sandboxPolicy = service?.resolve?.(exec.agent ? { session: exec.agent.session } : {});
            }
            catch {
                sandboxPolicy = undefined;
            }
            const targetDir = String(args.targetDir);
            await fs.resolve(targetDir, { signal: exec.signal });
            if (!Array.isArray(args.objects) || args.objects.length === 0) {
                throw new Error('adt_export_objects: `objects` is required (build the list via adt_package_content / adt_search)');
            }
            const clamp = clampWithNote(Number(args.maxObjects ?? 100), 1, 500, 'maxObjects');
            const refs = [];
            for (const o of args.objects) {
                refs.push(await resolveObject(entry.client, { name: o.name, type: o.type }, 10, exec.signal));
            }
            const files = [];
            const limited = refs.slice(0, clamp.value);
            const notes = [clamp.note];
            if (limited.length < refs.length)
                notes.push(`export truncated to maxObjects=${clamp.value} of ${refs.length} requested object(s)`);
            let failed = 0;
            for (const ref of limited) {
                try {
                    const parsed = await entry.client.readSource(ref.uri, { signal: exec.signal });
                    const fileName = exportFileName(ref);
                    const fileTarget = await fs.resolve(fileName, { cwd: targetDir, signal: exec.signal });
                    await fs.writeText(fileTarget, parsed.source, undefined, exec.signal, sandboxPolicy);
                    files.push({ name: fileName, path: fileName, chars: parsed.source.length });
                }
                catch (error) {
                    failed++;
                    files.push({ name: ref.name, path: `FAILED: ${error.message}` });
                }
            }
            return {
                targetDir,
                exported: files.length - failed,
                failed,
                files,
                truncated: limited.length < refs.length || undefined,
                note: notes.filter(Boolean).join('; ') || undefined,
            };
        },
    });
    return [batch, exportObjects];
}
//# sourceMappingURL=batch.js.map