import { defineTool } from '@deepseek-ai/dsh-tools';
import type { JsonValue, ToolResultView } from '@deepseek-ai/dsh-tools';
import { DESTINATION_PARAM, clampWithNote, destinationOf, optStr, text, type ToolDeps } from './common.js';

/** Upper bound for presentation metadata: past this the UI falls back to the
 * generic card rather than persisting a huge copy of the search result. */
const SEARCH_META_MAX_ENTRIES = 500;

/** Project an adt_search value into search-card metadata (see presentation.d.ts). */
export function searchPresentationMeta(value: {
  query: string;
  count: number;
  objects: Array<{ objectName: string; type: string; uri: string }>;
  sources: Array<{ objectName: string; type: string; uri: string; line: string; lineNumber?: number }>;
}): ToolResultView | undefined {
  // (returned as JsonValue at the presentationMeta seam below)
  const total = Math.max(value.count, value.objects.length + value.sources.length);
  const retained = value.objects.length + value.sources.length;
  if (retained > SEARCH_META_MAX_ENTRIES) return undefined;
  // Source-text hits render as grouped line matches; object-name hits render as
  // a flat path list. Both keep the capped/total signal honest for the UI.
  if (value.sources.length > 0) {
    const byObject = new Map<string, Array<{ lineNumber: number; line: string }>>();
    for (const s of value.sources) {
      const key = `${s.objectName} (${s.type})`;
      const matches = byObject.get(key) ?? [];
      matches.push({ lineNumber: s.lineNumber ?? 0, line: s.line });
      byObject.set(key, matches);
    }
    return {
      card: 'search',
      shape: 'matches',
      title: `ABAP search "${value.query}"`,
      files: [...byObject.entries()].map(([path, matches]) => ({ path, matches })),
      truncated: value.count > retained,
      total,
    };
  }
  if (value.objects.length > 0) {
    return {
      card: 'search',
      shape: 'paths',
      title: `ABAP search "${value.query}"`,
      paths: value.objects.map((o) => `${o.objectName} (${o.type})`),
      truncated: value.count > retained,
      total,
    };
  }
  return undefined;
}

export function searchTools(deps: ToolDeps) {
  const { registry } = deps;

  return [
    defineTool({
      name: 'adt_search',
      description:
        'Search ABAP development objects and source code on the SAP system. Returns objects whose ' +
        'name/description match and (for full-text search) source excerpts. Use `operation` to narrow: ' +
        '"quickSearch" (both, default), "objectSearch" (names only), "quickSearchSource" (source text only); ' +
        'use `packageName` to restrict object hits to one package and `offset`/`maxResults` to page.',
      parameters: {
        query: {
          type: 'string',
          required: true,
          description: 'Search term (case-insensitive). Supports * wildcards on the backend.',
        },
        operation: {
          type: 'string',
          enum: ['quickSearch', 'objectSearch', 'quickSearchSource'],
          description: 'Search scope. Default: quickSearch.',
        },
        packageName: {
          type: 'string',
          description: 'Restrict object hits to this package (e.g. ZPACK_DEMO). Source-text hits carry no package and are dropped when set.',
        },
        maxResults: {
          type: 'integer',
          description: 'Maximum number of hits per page (default 25, clamped to 1–100).',
        },
        offset: {
          type: 'integer',
          description: 'Skip the first N hits (client-side paging within the 100-hit backend cap; default 0).',
        },
        objectType: {
          type: 'string',
          description: 'Optional object type filter, e.g. "CLAS", "INTF", "PROG", "DDLS".',
        },
        ...DESTINATION_PARAM,
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,

          properties: {
            query: { type: 'string', required: true },
            count: { type: 'integer', required: true },
            offset: { type: 'integer', required: true },
            note: { type: 'string' },
            objects: {
              type: 'array',
              required: true,
              items: {
                type: 'object',
                additionalProperties: false,

                properties: {
                  objectName: { type: 'string', required: true },
                  description: { type: 'string', required: true },
                  type: { type: 'string', required: true },
                  uri: { type: 'string', required: true },
                  packageName: { type: 'string' },
                  typeLabel: { type: 'string' },
                  category: { type: 'string' },
                  mainProgram: { type: 'boolean' },
                  masterLanguage: { type: 'string' },
                  responsible: { type: 'string' },
                  changedAt: { type: 'string' },
                  changedBy: { type: 'string' },
                },
              },
            },
            sources: {
              type: 'array',
              required: true,
              items: {
                type: 'object',
                additionalProperties: false,

                properties: {
                  objectName: { type: 'string', required: true },
                  type: { type: 'string', required: true },
                  uri: { type: 'string', required: true },
                  line: { type: 'string', required: true },
                  lineNumber: { type: 'integer' },
                },
              },
            },
          },
        },
        render: (_args, value) => {
          const lines: string[] = [];
          lines.push(`Search "${value.query}": ${value.count} hit(s)${value.offset > 0 ? ` (page from offset ${value.offset})` : ''}`);
          if (value.note) lines.push(`Note: ${value.note}`);
          if (value.objects.length) {
            lines.push('');
            lines.push('Objects:');
            for (const o of value.objects) {
              lines.push(`- ${o.objectName} [${o.type}] ${o.description}${o.packageName ? ` (${o.packageName})` : ''}`);
              lines.push(`  ${o.uri}`);
            }
          }
          if (value.sources.length) {
            lines.push('');
            lines.push('Source hits:');
            for (const s of value.sources) {
              lines.push(`- ${s.objectName} [${s.type}]${s.lineNumber ? ` line ${s.lineNumber}` : ''}: ${s.line}`);
            }
          }
          return text(lines.join('\n'));
        },
        presentationMeta: (_args, value) =>
          // `null` (legal JsonValue) when the result needs no search card —
          // presentResult falls back to the generic presentation for it.
          (searchPresentationMeta(value as Parameters<typeof searchPresentationMeta>[0]) ?? null) as JsonValue,
      },
      presentResult: (_args, result) => {
        // presentationMeta returned a ready search view; replay it verbatim.
        // (Soft-validated: an obsolete logged shape falls back to generic.)
        const meta = result.meta as ToolResultView | undefined;
        return meta && typeof meta === 'object' && 'card' in meta && meta.card === 'search' ? meta : undefined;
      },
      isConcurrencySafe: () => true,
      execute: async (args, exec) => {
        const entry = registry.require(destinationOf(args));
        const packageName = optStr(args.packageName)?.toUpperCase();
        const clamp = typeof args.maxResults === 'number' ? clampWithNote(args.maxResults, 1, 100, 'maxResults') : { value: 25, note: undefined as string | undefined };
        const maxResults = clamp.value;
        const offset = Math.max(Number(args.offset ?? 0) || 0, 0);

        // Offset is client-side paging: fetch offset+maxResults (within the
        // backend cap of 100) and window the combined hit list.
        const fetchCap = Math.min(offset + maxResults, 100);
        const result = await entry.client.search(String(args.query ?? ''), {
          operation: (args.operation as 'quickSearch' | 'objectSearch' | 'quickSearchSource') ?? 'quickSearch',
          maxResults: fetchCap,
          objectType: optStr(args.objectType),
          packageName,
          signal: exec.signal,
        });

        const notes: string[] = [];
        if (result.note) notes.push(result.note);
        if (clamp.note) notes.push(clamp.note);

        // Guarantee the package filter even on backends that ignore the param;
        // source hits carry no package attribution and are dropped with a note.
        let objects = result.objects;
        let sources = result.sources;
        if (packageName) {
          const before = objects.length;
          objects = objects.filter((o) => (o.packageName ?? '').toUpperCase() === packageName);
          if (before !== objects.length) {
            notes.push(`package filter kept ${objects.length} of ${before} object hit(s) for ${packageName}`);
          }
          if (sources.length > 0) {
            notes.push(`${sources.length} source-text hit(s) dropped: source hits carry no package attribution`);
            sources = [];
          }
        }

        // Client-side paging over the combined object+source list.
        const allHits: Array<{ kind: 'object' | 'source'; index: number }> = [
          ...objects.map((_, i) => ({ kind: 'object' as const, index: i })),
          ...sources.map((_, i) => ({ kind: 'source' as const, index: i })),
        ];
        const window = allHits.slice(Math.min(offset, allHits.length), Math.min(offset, allHits.length) + maxResults);
        if (offset > 0) notes.push(`offset ${offset} applied (client-side paging within the ${fetchCap}-hit backend cap)`);
        if (offset + maxResults < allHits.length) notes.push(`more hits available: raise offset to ${offset + maxResults}`);

        return {
          query: result.query,
          count: result.count,
          offset,
          note: notes.length ? notes.join('; ') : undefined,
          objects: window.filter((h) => h.kind === 'object').map((h) => objects[h.index]!),
          sources: window.filter((h) => h.kind === 'source').map((h) => sources[h.index]!),
        };
      },
    }),
  ];
}
