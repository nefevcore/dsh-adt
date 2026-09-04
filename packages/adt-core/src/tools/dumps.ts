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
import { defineTool } from '../tooldef.js';
import { sessionCwd, DESTINATION_PARAM, clampWithNote, destinationOf, isAdtServiceUnavailable, optStr, showingUnknownTotal, text, type ToolDeps } from './common.js';

/** `YYYYMMDD` / `YYYYMMDDHHMMSS` sanity for the time-range filters. */
function normalizeStamp(value: string, label: string): string {
  const trimmed = value.trim();
  if (!/^\d{8}(\d{6})?$/.test(trimmed)) {
    throw new Error(`adt_list_dumps: ${label} must be YYYYMMDD or YYYYMMDDHHMMSS, got '${value}'`);
  }
  return trimmed;
}

export function dumpTools(deps: ToolDeps) {
  const { registry } = deps;

  const listDumps = defineTool({
    name: 'adt_list_dumps',
    description:
      'List ABAP runtime dumps (short dumps, ST22) from the target system. Filter by user, time range ' +
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
          // The compound dump id CONTAINS SPACES (timestamp + host + user +
          // client + sequence). Quote it so the id's boundaries are obvious
          // and the full key survives copy/paste into adt_get_dump.
          lines.push(`- [${d.title}] id="${d.id}"${d.updatedAt ? ` @ ${d.updatedAt}` : ''}${d.user ? ` by ${d.user}` : ''}`);
          if (d.category) lines.push(`    ${d.category}`);
        }
        if (value.dumps.length === 0) lines.push('(no dumps match the filters — a clean system or wrong user/range)');
        if (value.note) lines.push(`Note: ${value.note}`);
        return text(lines.join('\n'));
      },
    },
    isConcurrencySafe: () => true,
    execute: async (args, exec) => {
      const entry = await registry.require(destinationOf(args), sessionCwd(exec));
      const clamp = clampWithNote(Number(args.top ?? 20), 1, 100, 'top');
      const skip = Math.max(Number(args.skip ?? 0) || 0, 0);
      const notes: string[] = [];
      if (clamp.note) notes.push(clamp.note);
      let dumps;
      try {
        // Fetch ONE row beyond the cap: it distinguishes "exactly `top`
        // dumps" from "a full page — there are more", which the feed cannot
        // express (counting the rest would cost another request).
        dumps = await entry.client.listDumps({
          user: optStr(args.user),
          from: optStr(args.from) ? normalizeStamp(String(args.from), 'from') : undefined,
          to: optStr(args.to) ? normalizeStamp(String(args.to), 'to') : undefined,
          top: clamp.value + 1,
          skip: skip > 0 ? skip : undefined,
          signal: exec.signal,
        });
      } catch (error) {
        // Old / restricted profiles may not ship the runtime-dumps service.
        if (isAdtServiceUnavailable(error)) {
          throw new Error(
            `Runtime dumps are not available on destination '${entry.config.name}' (HTTP ${error.status}) — ` +
              'this ADT profile does not expose the /runtime/dumps service (BASIS < 7.5x). ' +
              'Analyze errors from the run output / unit test messages instead.',
          );
        }
        throw error;
      }
      const hasMore = dumps.length > clamp.value;
      if (hasMore) {
        notes.push(
          showingUnknownTotal(clamp.value, 'top', `page with skip=${skip + clamp.value} or narrow by user / from / to`),
        );
        dumps = dumps.slice(0, clamp.value);
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
    description:
      'Read one ABAP runtime dump (ST22) in full. `view`: default = structured sections (error type, ' +
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
          raw: { type: 'string', description: 'Raw body (summary/formatted views; truncated beyond 8k chars).' },
          rawTruncated: { type: 'boolean', description: 'true when the raw view was cut at the 8k-char cap.' },
          note: { type: 'string', description: 'Provenance note (e.g. formatted-view fallback).' },
        },
      },
      render: (_args, value) => {
        const lines = [`Dump ${value.id}${value.title ? ` — ${value.title}` : ''} (view: ${value.view})`];
        if (value.note) lines.push(`Note: ${value.note}`);
        if (value.raw !== undefined) {
          lines.push('', value.raw);
          if (value.rawTruncated) lines.push('… (raw view truncated)');
        } else {
          for (const s of value.sections) lines.push(`${s.name}: ${s.value}`);
        }
        return text(lines.join('\n'));
      },
    },
    isConcurrencySafe: () => true,
    execute: async (args, exec) => {
      const entry = await registry.require(destinationOf(args), sessionCwd(exec));
      const dumpId = String(args.dumpId ?? '').trim();
      if (!dumpId) throw new Error('adt_get_dump: `dumpId` is required (from adt_list_dumps)');
      const view = (optStr(args.view) ?? 'default') as 'default' | 'summary' | 'formatted';
      let detail = await entry.client.getDump(dumpId, { view, signal: exec.signal });
      let note: string | undefined;
      // Restricted ADT profiles (verified on an S/4HANA sandbox) serve the
      // default view as a METADATA-ONLY document — root attributes plus a
      // chapter index; all human-readable analysis lives in /formatted.
      // Detect that shape and transparently fall back so the caller always
      // gets the actual error analysis.
      if (view === 'default' && detail.sections.length === 0 && detail.raw === undefined) {
        const fallback = await entry.client
          .getDump(dumpId, { view: 'formatted', signal: exec.signal })
          .catch(() => undefined);
        if (fallback) {
          detail = fallback;
          note = 'default view carries only metadata on this backend — fell back to the formatted (plain-text) view';
        }
      }
      // ST22 raw views can be enormous — cap what enters the context (audit P3).
      const MAX_RAW_CHARS = 8_000;
      const raw = detail.raw;
      const truncated = raw !== undefined && raw.length > MAX_RAW_CHARS;
      return {
        id: detail.id,
        view: detail.view,
        title: detail.title,
        sections: detail.sections.map((s) => ({ name: s.name, value: s.value })),
        raw: raw === undefined ? undefined : truncated ? raw.slice(0, MAX_RAW_CHARS) : raw,
        rawTruncated: truncated || undefined,
        note,
      };
    },
  });

  return [listDumps, getDump];
}
