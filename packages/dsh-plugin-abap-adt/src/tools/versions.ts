/**
 * adt_version_diff — compare the current source of an object with a past
 * version (or two past versions), returning a unified diff. Read-only.
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import type { JsonValue } from '@deepseek-ai/dsh-tools';
import { AdtError } from '@nefevcore/abap-adt-protocol';
import { DESTINATION_PARAM, destinationOf, text, type ToolDeps } from './common.js';
import { resolveObject } from '../resolve.js';

/** One line-diff operation. */
export interface DiffOp {
  kind: '=' | '-' | '+';
  line: string;
}

/**
 * Line diff. Uses common prefix/suffix trimming with the middle emitted as a
 * remove block then an add block — no DP table, so it is O(n) memory and time.
 * (A full LCS backtrack was dropped: on this Node build a table-based diff
 * inside a plugin module triggered pathological V8 GC under the test runner.)
 */
export function diffLines(from: string, to: string): DiffOp[] {
  const a = from.split('\n');
  const b = to.split('\n');
  const n = a.length;
  const m = b.length;

  const ops: DiffOp[] = [];
  let prefix = 0;
  while (prefix < n && prefix < m && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (suffix < n - prefix && suffix < m - prefix && a[n - 1 - suffix] === b[m - 1 - suffix]) suffix++;
  for (let k = 0; k < prefix; k++) ops.push({ kind: '=', line: a[k]! });
  for (let k = prefix; k < n - suffix; k++) ops.push({ kind: '-', line: a[k]! });
  for (let k = prefix; k < m - suffix; k++) ops.push({ kind: '+', line: b[k]! });
  for (let k = n - suffix; k < n; k++) ops.push({ kind: '=', line: a[k]! });
  return ops;
}

/** Render a line diff as unified diff with hunk headers and context. */
export function unifiedDiff(from: string, to: string, context = 3): string {
  const ops = diffLines(from, to);
  if (!ops.some((op) => op.kind !== '=')) return '';

  const blocks: Array<[number, number]> = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i]!.kind !== '=') {
      let j = i;
      while (j < ops.length && ops[j]!.kind !== '=') j++;
      blocks.push([i, j]);
      i = j;
    } else {
      i++;
    }
  }

  const out: string[] = [];
  for (const [start0, end0] of blocks) {
    const start = Math.max(0, start0 - context);
    const end = Math.min(ops.length, end0 + context);
    let aLine = 1;
    let bLine = 1;
    for (let k = 0; k < start; k++) {
      const op = ops[k]!;
      if (op.kind !== '+') aLine++;
      if (op.kind !== '-') bLine++;
    }
    let aCount = 0;
    let bCount = 0;
    for (let k = start; k < end; k++) {
      const op = ops[k]!;
      if (op.kind !== '+') aCount++;
      if (op.kind !== '-') bCount++;
    }
    out.push(`@@ -${aLine},${aCount} +${bLine},${bCount} @@`);
    for (let k = start; k < end; k++) {
      const op = ops[k]!;
      out.push(`${op.kind === '=' ? ' ' : op.kind}${op.line}`);
    }
  }
  return out.join('\n') + '\n';
}


/** Char budget per side for diff-card metadata; larger sources fall back to the
 * generic card (the unified-diff text stays model-visible either way). */
const DIFF_META_MAX_CHARS = 100_000;

interface DiffMeta {
  kind: 'diff';
  path: string;
  oldText: string | null;
  newText: string;
}

function diffPresentationMeta(value: {
  objectUri: string;
  identical: boolean;
  from: { label: string; source: string };
  to: { label: string; source: string };
}): DiffMeta | null {
  if (value.identical) return null; // nothing to render as a change
  if (value.from.source.length > DIFF_META_MAX_CHARS || value.to.source.length > DIFF_META_MAX_CHARS) {
    return null;
  }
  const name = value.objectUri.split('/').pop() ?? value.objectUri;
  const short = (label: string) => label.split('/').pop() ?? label;
  return {
    kind: 'diff',
    path: `${name.toLowerCase()} (${short(value.from.label)} -> ${short(value.to.label)})`,
    oldText: value.from.source,
    newText: value.to.source,
  };
}

export function versionTools(deps: ToolDeps) {
  const { registry } = deps;
  return [
    defineTool({
      name: 'adt_version_diff',
      description:
        'Compare two versions of an object (default: current active source vs its latest saved version) ' +
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
          return text(
            `Diff of ${value.objectUri} (${value.from.label} -> ${value.to.label}):\n${value.diff}`,
          );
        },
        presentationMeta: (_args, value) =>
          (diffPresentationMeta(value) as DiffMeta | null) as unknown as JsonValue,
      },
      presentResult: (_args, result) => {
        // Replay the diff card from persisted metadata; identical/oversized
        // results have no meta and fall back to the generic presentation.
        const meta = result.meta as DiffMeta | undefined;
        if (!meta || meta.kind !== 'diff' || typeof meta.oldText !== 'string') return undefined;
        return {
          card: 'diff',
          diffs: [{ path: meta.path, oldText: meta.oldText, newText: meta.newText }],
        };
      },
      isConcurrencySafe: () => true,
      execute: async (args, exec) => {
        const entry = registry.require(destinationOf(args));
        const ref = await resolveObject(entry.client, {
          objectUri: typeof args.objectUri === 'string' ? args.objectUri : undefined,
          name: typeof args.name === 'string' ? args.name : undefined,
          type: typeof args.type === 'string' ? args.type : undefined,
        }, 10, exec.signal);

        let versions;
        try {
          versions = await entry.client.getVersions(ref.uri, { signal: exec.signal });
        } catch (error) {
          if (error instanceof AdtError && (error.status === 404 || error.status === 405)) {
            throw new Error(
              `Version history is not available for ${ref.name} on this backend (HTTP ${error.status}); ` +
                'cannot compute a version diff. Export the source (adt_export_objects) and diff locally instead.',
            );
          }
          throw error;
        }
        const byId = (id: string) =>
          versions.find(
            (v) =>
              v.versionId === id ||
              v.contentUri?.includes(`version=${id}`) ||
              v.contentUri?.endsWith(id),
          );

        // Base side: explicit version or the latest saved version.
        let from: { label: string; source: string };
        if (typeof args.versionFrom === 'string' && args.versionFrom) {
          const v = byId(args.versionFrom);
          if (!v?.contentUri) throw new Error(`adt_version_diff: version '${args.versionFrom}' not found in history`);
          from = { label: v.versionId, source: await entry.client.getVersionSource(v.contentUri, { signal: exec.signal }) };
        } else {
          const latest = versions[0];
          if (!latest?.contentUri) throw new Error('adt_version_diff: no version history available for this object');
          from = { label: latest.versionId, source: await entry.client.getVersionSource(latest.contentUri, { signal: exec.signal }) };
        }

        // Compare side: explicit version or the active source.
        let to: { label: string; source: string };
        if (typeof args.versionTo === 'string' && args.versionTo && args.versionTo !== 'active') {
          const v = byId(args.versionTo);
          if (!v?.contentUri) throw new Error(`adt_version_diff: version '${args.versionTo}' not found in history`);
          to = { label: v.versionId, source: await entry.client.getVersionSource(v.contentUri, { signal: exec.signal }) };
        } else {
          to = { label: 'active', source: (await entry.client.readSource(ref.uri, { signal: exec.signal })).source };
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
