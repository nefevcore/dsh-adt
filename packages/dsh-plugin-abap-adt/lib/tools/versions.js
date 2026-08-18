/**
 * adt_version_diff — compare the current source of an object with a past
 * version (or two past versions), returning a unified diff. Read-only.
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { AdtError } from '@nefevcore/abap-adt-protocol';
import { DESTINATION_PARAM, destinationOf, text } from './common.js';
import { resolveObject } from '../resolve.js';
/**
 * Line diff. Uses common prefix/suffix trimming with the middle emitted as a
 * remove block then an add block — no DP table, so it is O(n) memory and time.
 * (A full LCS backtrack was dropped: on this Node build a table-based diff
 * inside a plugin module triggered pathological V8 GC under the test runner.)
 */
export function diffLines(from, to) {
    const a = from.split('\n');
    const b = to.split('\n');
    const n = a.length;
    const m = b.length;
    const ops = [];
    let prefix = 0;
    while (prefix < n && prefix < m && a[prefix] === b[prefix])
        prefix++;
    let suffix = 0;
    while (suffix < n - prefix && suffix < m - prefix && a[n - 1 - suffix] === b[m - 1 - suffix])
        suffix++;
    for (let k = 0; k < prefix; k++)
        ops.push({ kind: '=', line: a[k] });
    for (let k = prefix; k < n - suffix; k++)
        ops.push({ kind: '-', line: a[k] });
    for (let k = prefix; k < m - suffix; k++)
        ops.push({ kind: '+', line: b[k] });
    for (let k = n - suffix; k < n; k++)
        ops.push({ kind: '=', line: a[k] });
    return ops;
}
/** Render a line diff as unified diff with hunk headers and context. */
export function unifiedDiff(from, to, context = 3) {
    const ops = diffLines(from, to);
    if (!ops.some((op) => op.kind !== '='))
        return '';
    const blocks = [];
    let i = 0;
    while (i < ops.length) {
        if (ops[i].kind !== '=') {
            let j = i;
            while (j < ops.length && ops[j].kind !== '=')
                j++;
            blocks.push([i, j]);
            i = j;
        }
        else {
            i++;
        }
    }
    const out = [];
    for (const [start0, end0] of blocks) {
        const start = Math.max(0, start0 - context);
        const end = Math.min(ops.length, end0 + context);
        let aLine = 1;
        let bLine = 1;
        for (let k = 0; k < start; k++) {
            const op = ops[k];
            if (op.kind !== '+')
                aLine++;
            if (op.kind !== '-')
                bLine++;
        }
        let aCount = 0;
        let bCount = 0;
        for (let k = start; k < end; k++) {
            const op = ops[k];
            if (op.kind !== '+')
                aCount++;
            if (op.kind !== '-')
                bCount++;
        }
        out.push(`@@ -${aLine},${aCount} +${bLine},${bCount} @@`);
        for (let k = start; k < end; k++) {
            const op = ops[k];
            out.push(`${op.kind === '=' ? ' ' : op.kind}${op.line}`);
        }
    }
    return out.join('\n') + '\n';
}
export function versionTools(deps) {
    const { registry } = deps;
    return [
        defineTool({
            name: 'adt_version_diff',
            description: 'Compare two versions of an object (default: current active source vs its latest saved version) ' +
                'and return a unified diff. Use to review what changed before releasing or rolling back. ' +
                'Read-only. Version ids come from adt_object_versions.',
            parameters: {
                objectUri: { type: 'string', description: 'Exact ADT object URI, e.g. /sap/bc/adt/oo/classes/zcl_demo.' },
                name: { type: 'string', description: 'Object name, e.g. ZCL_DEMO.' },
                type: { type: 'string', description: 'Object type (short or ADT form), e.g. CLAS, INTF, PROG.' },
                versionFrom: {
                    type: 'string',
                    description: 'Version id of the base (old) side. Default: the latest version in the history feed.',
                },
                versionTo: {
                    type: 'string',
                    description: 'Version id of the compare (new) side, or "active" for the current source. Default "active".',
                },
                ...DESTINATION_PARAM,
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        objectUri: { type: 'string', required: true },
                        identical: { type: 'boolean', required: true },
                        from: {
                            type: 'object',
                            required: true,
                            additionalProperties: false,
                            properties: {
                                label: { type: 'string', required: true },
                                source: { type: 'string', required: true },
                            },
                        },
                        to: {
                            type: 'object',
                            required: true,
                            additionalProperties: false,
                            properties: {
                                label: { type: 'string', required: true },
                                source: { type: 'string', required: true },
                            },
                        },
                        diff: { type: 'string', required: true },
                        versions: {
                            type: 'array',
                            required: true,
                            items: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    versionId: { type: 'string', required: true },
                                    author: { type: 'string' },
                                    updatedAt: { type: 'string' },
                                    title: { type: 'string' },
                                    transportRequest: { type: 'string' },
                                    contentUri: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                render: (_args, value) => {
                    if (value.identical) {
                        return text(`${value.objectUri}: ${value.from.label} and ${value.to.label} are identical`);
                    }
                    return text(`Diff of ${value.objectUri} (${value.from.label} -> ${value.to.label}):\n${value.diff}`);
                },
            },
            execute: async (args) => {
                const entry = registry.require(destinationOf(args));
                const ref = await resolveObject(entry.client, {
                    objectUri: typeof args.objectUri === 'string' ? args.objectUri : undefined,
                    name: typeof args.name === 'string' ? args.name : undefined,
                    type: typeof args.type === 'string' ? args.type : undefined,
                });
                let versions;
                try {
                    versions = await entry.client.getVersions(ref.uri);
                }
                catch (error) {
                    if (error instanceof AdtError && (error.status === 404 || error.status === 405)) {
                        throw new Error(`Version history is not available for ${ref.name} on this backend (HTTP ${error.status}); ` +
                            'cannot compute a version diff. Export the source (adt_export_objects) and diff locally instead.');
                    }
                    throw error;
                }
                const byId = (id) => versions.find((v) => v.versionId === id ||
                    v.contentUri?.includes(`version=${id}`) ||
                    v.contentUri?.endsWith(id));
                // Base side: explicit version or the latest saved version.
                let from;
                if (typeof args.versionFrom === 'string' && args.versionFrom) {
                    const v = byId(args.versionFrom);
                    if (!v?.contentUri)
                        throw new Error(`adt_version_diff: version '${args.versionFrom}' not found in history`);
                    from = { label: v.versionId, source: await entry.client.getVersionSource(v.contentUri) };
                }
                else {
                    const latest = versions[0];
                    if (!latest?.contentUri)
                        throw new Error('adt_version_diff: no version history available for this object');
                    from = { label: latest.versionId, source: await entry.client.getVersionSource(latest.contentUri) };
                }
                // Compare side: explicit version or the active source.
                let to;
                if (typeof args.versionTo === 'string' && args.versionTo && args.versionTo !== 'active') {
                    const v = byId(args.versionTo);
                    if (!v?.contentUri)
                        throw new Error(`adt_version_diff: version '${args.versionTo}' not found in history`);
                    to = { label: v.versionId, source: await entry.client.getVersionSource(v.contentUri) };
                }
                else {
                    to = { label: 'active', source: (await entry.client.readSource(ref.uri)).source };
                }
                const identical = from.source === to.source;
                return {
                    objectUri: ref.uri,
                    identical,
                    from,
                    to,
                    diff: unifiedDiff(from.source, to.source),
                    versions: versions.map((v) => ({
                        versionId: v.versionId,
                        author: v.author,
                        updatedAt: v.updatedAt,
                        title: v.title,
                        transportRequest: v.transportRequest,
                        contentUri: v.contentUri,
                    })),
                };
            },
        }),
    ];
}
//# sourceMappingURL=versions.js.map