/**
 * adt_version_diff — compare versions of an object and return ONLY the
 * unified diff plus the labels and history (full sources are deliberately
 * NOT part of the output — the diff is what matters and double sources only
 * burn context). Read-only.
 *
 * Default comparison: `saved` (the current source — the inactive version
 * when one exists) vs `active` (the last activated version,
 * `?version=active`) — i.e. "what is saved but NOT yet activated". This is
 * the residual-non-activation check the adt_activate hints point at.
 * Historical versions can be compared explicitly via versionFrom/versionTo
 * (ids from adt_object_versions / the `versions` array of this output).
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { AdtError } from '@nefevcore/abap-adt-protocol';
import { DESTINATION_PARAM, OBJECT_REF_PARAMS, destinationOf, optStr, resolveToolObject, text, type ToolDeps } from './common.js';

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

export function versionTools(deps: ToolDeps) {
  const { registry } = deps;
  return [
    defineTool({
      name: 'adt_version_diff',
      description:
        'Compare two versions of an object and return a unified diff. DEFAULT: saved (current source, inactive ' +
        'when one exists) vs active (last activated version) — i.e. exactly the changes that are NOT yet ' +
        'activated; use it to verify activation leftovers after writing/activating (includes of a program too). ' +
        'Pass versionFrom/versionTo (ids from adt_object_versions or this tool\'s `versions` output; keywords ' +
        '"saved" and "active") to compare historical versions. Read-only.',
      parameters: {
        ...OBJECT_REF_PARAMS,
        versionFrom: {
          type: 'string',
          description: 'Base (old) side: a version id, or "saved" for the current source. Default "saved".',
        },
        versionTo: {
          type: 'string',
          description: 'Compare (new) side: a version id, "active" for the last activated version, or "saved". Default "active".',
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
            pendingChanges: {
              type: 'boolean',
              description: 'Only for the default saved-vs-active comparison: true = saved changes are NOT yet activated.',
            },
            fromLabel: { type: 'string', required: true },
            toLabel: { type: 'string', required: true },
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
            const detail =
              value.fromLabel === 'saved' && value.toLabel === 'active'
                ? ' — the current source is fully activated (nothing pending)'
                : '';
            return text(`${value.objectUri}: ${value.fromLabel} and ${value.toLabel} are identical${detail}`);
          }
          const hint =
            value.fromLabel === 'saved' && value.toLabel === 'active'
              ? '\n(saved differs from active — these changes are NOT yet activated; call adt_activate with ALL related objects)'
              : '';
          return text(
            `Diff of ${value.objectUri} (${value.fromLabel} -> ${value.toLabel}):\n${value.diff}${hint}`,
          );
        },
      },
      isConcurrencySafe: () => true,
      execute: async (args, exec) => {
        const entry = registry.require(destinationOf(args));
        const ref = await resolveToolObject(entry.client, args, exec.signal);

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
              v.versionId.endsWith(`/${id}`) ||
              v.contentUri?.includes(`version=${id}`) ||
              v.contentUri?.endsWith(id),
          );

        // One side of the comparison: a keyword ("saved" = current source,
        // "active" = last activated) or a historical version id.
        const resolveSide = async (raw: string | undefined, fallback: 'saved' | 'active'): Promise<{ label: string; source: string }> => {
          const side = raw && raw.length > 0 ? raw : fallback;
          if (side === 'saved') {
            return { label: 'saved', source: (await entry.client.readSource(ref.uri, { signal: exec.signal })).source };
          }
          if (side === 'active') {
            return {
              label: 'active',
              source: (await entry.client.readSource(ref.uri, { version: 'active', signal: exec.signal })).source,
            };
          }
          const v = byId(side);
          if (!v?.contentUri) {
            throw new Error(
              `adt_version_diff: version '${side}' not found in history (known: ${versions
                .map((x) => x.versionId.split('/').pop())
                .join(', ')}; keywords "saved"/"active")`,
            );
          }
          return { label: v.versionId.split('/').pop() ?? v.versionId, source: await entry.client.getVersionSource(v.contentUri, { signal: exec.signal }) };
        };

        const from = await resolveSide(optStr(args.versionFrom), 'saved');
        const to = await resolveSide(optStr(args.versionTo), 'active');

        const identical = from.source === to.source;
        const pendingCheck = from.label === 'saved' && to.label === 'active';
        return {
          objectUri: ref.uri,
          identical,
          pendingChanges: pendingCheck ? !identical : undefined,
          fromLabel: from.label,
          toLabel: to.label,
          diff: unifiedDiff(from.source, to.source),
          versions: versions.map((v) => ({
            versionId: v.versionId.split('/').pop() ?? v.versionId,
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
