/**
 * adt_data_preview — read rows from tables / CDS views (or freestyle SQL)
 * via the ADT Data Preview API. Read-only; verifies data after changes.
 *
 * `kind` uses the same type codes as every other adt_* tool (TABL / VIEW /
 * STRU / DDLS), aligned with the ADT URI namespaces (/ddic/tables, /ddic/
 * views, /ddic/structures, /ddls), so the model never has to switch naming
 * schemes mid-session. Note: on ABAP Cloud (BTP) direct preview of database
 * tables is blocked by SAP backend policy — only CDS views / freestyle SQL
 * work there; minimal ADT profiles may not expose the datapreview service at
 * all — the tool then fails with a clear message instead of a raw 404/405.
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { AdtError } from '@nefevcore/abap-adt-protocol';
import { DESTINATION_PARAM, clampWithNote, destinationOf, optStr, text, type ToolDeps } from './common.js';

/** Map the shared type-code namespace onto the two preview API modes. */
const KIND_TO_MODE: Record<string, 'ddic' | 'cds'> = {
  TABL: 'ddic',
  VIEW: 'ddic',
  STRU: 'ddic',
  DDLS: 'cds',
};

export function dataPreviewTools(deps: ToolDeps) {
  const { registry } = deps;
  return [
    defineTool({
      name: 'adt_data_preview',
      description:
        'Read rows from a table / CDS view (or run a freestyle SELECT) via the ADT Data Preview API. ' +
        'Provide `name` + `kind` (same type codes as everywhere: TABL, VIEW, STRU for DDIC entities, ' +
        'DDLS for CDS views; default TABL) or `sql` (freestyle). `top`/`offset` page the rows. Read-only. ' +
        'Note: ABAP Cloud (BTP) blocks direct database-table preview; CDS views and freestyle SQL work there.',
      parameters: {
        name: { type: 'string', description: 'Table or CDS view name (uppercase), e.g. ZCDS_DEMO, T001.' },
        kind: {
          type: 'string',
          enum: ['TABL', 'VIEW', 'STRU', 'DDLS'],
          description: 'Entity kind (same type codes as other tools; aligned with the ADT URI namespaces). Default TABL.',
        },
        sql: { type: 'string', description: 'Freestyle SQL SELECT to run (alternative to name+kind).' },
        length: {
          type: 'integer',
          description: 'Number of rows to return — the row-range window is offset..offset+length ' +
            '(default 100, clamped to 1–5000; alias of the deprecated `top`).',
        },
        top: { type: 'integer', description: 'Deprecated alias of `length`.' },
        offset: { type: 'integer', description: 'Skip the first N rows (client-side, within the 5000-row cap; default 0).' },
        ...DESTINATION_PARAM,
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,

          properties: {
            source: { type: 'string', required: true },
            name: { type: 'string', required: true },
            offset: { type: 'integer', required: true },
            totalRows: { type: 'integer', required: true },
            note: { type: 'string' },
            queryExecutionTime: { type: 'number' },
            columns: {
              type: 'array',
              required: true,
              items: {
                type: 'object',
                additionalProperties: false,

                properties: {
                  name: { type: 'string', required: true },
                  type: { type: 'string', required: true },
                  description: { type: 'string' },
                  length: { type: 'integer' },
                },
              },
            },
            rows: {
              type: 'array',
              required: true,
              items: { type: 'object', additionalProperties: true },
            },
            rawXml: { type: 'string' },
          },
        },
        render: (_args, value) => {
          const lines = [
            `Data preview of ${value.name} (${value.source})${value.offset > 0 ? ` [rows from offset ${value.offset}]` : ''}: ` +
              `${value.rows.length}/${value.totalRows} row(s)` +
              `${value.queryExecutionTime !== undefined ? `, ${value.queryExecutionTime}ms` : ''}`,
            ...(value.note ? [`Note: ${value.note}`] : []),
            `columns: ${value.columns.map((c) => `${c.name}:${c.type}`).join(', ')}`,
            ...value.rows.map((row, i) => `  ${i + 1}. ${value.columns.map((c) => `${c.name}=${row[c.name] ?? ''}`).join(' | ')}`),
          ];
          if (value.rawXml) lines.push(`(partial parse — raw XML: ${value.rawXml.slice(0, 200)}…)`);
          return text(lines.join('\n'));
        },
      },
      isConcurrencySafe: () => true,
      execute: async (args, exec) => {
        const entry = registry.require(destinationOf(args));
        const notes: string[] = [];

        const run = async <T>(fn: () => Promise<T>): Promise<T> => {
          try {
            return await fn();
          } catch (error) {
            if (error instanceof AdtError && (error.status === 404 || error.status === 405)) {
              throw new Error(
                `Data Preview is not available on destination '${entry.config.name}' — ` +
                  'the ADT profile does not expose the datapreview service (HTTP ' +
                  `${error.status}). Read data another way: export/analyze sources locally, ` +
                  'or query the table through a program/function module that reads it.',
              );
            }
            throw error;
          }
        };

        const sql = optStr(args.sql);
        if (sql) {
          const length = typeof args.length === 'number' ? args.length : typeof args.top === 'number' ? args.top : 100;
          const clamp = clampWithNote(length, 1, 5000, 'length');
          const offset = Math.max(Number(args.offset ?? 0) || 0, 0);
          // Fetch offset+length rows (within the cap) and slice, so the SQL
          // path honors the same offset/length row-range as entity previews.
          const fetchTop = Math.min(offset + clamp.value, 5000);
          if (clamp.note) notes.push(clamp.note);
          if (offset > 0) notes.push(`offset ${offset} applied (client-side paging within the ${fetchTop}-row cap)`);
          const result = await run(() => entry.client.runSqlQuery(sql, { top: fetchTop, signal: exec.signal }));
          const rows = result.rows.slice(offset, offset + clamp.value);
          if (offset + clamp.value < result.rows.length) {
            notes.push(`more rows available: raise offset to ${offset + clamp.value}`);
          }
          return {
            source: 'sql',
            name: result.name,
            offset,
            totalRows: result.totalRows,
            note: notes.length ? notes.join('; ') : undefined,
            queryExecutionTime: result.queryExecutionTime,
            columns: result.columns,
            rows,
            rawXml: result.rawXml,
          };
        }

        const name = String(args.name ?? '').toUpperCase().trim();
        if (!name) throw new Error('adt_data_preview: provide either `name`+`kind` or `sql`');
        const kindCode = (optStr(args.kind) ?? 'TABL').toUpperCase();
        const mode = KIND_TO_MODE[kindCode];
        if (!mode) {
          throw new Error(`adt_data_preview: unsupported kind '${kindCode}' (expected TABL, VIEW, STRU or DDLS)`);
        }
        const requestedLength = typeof args.length === 'number' ? args.length : typeof args.top === 'number' ? args.top : 100;
        const clamp = clampWithNote(requestedLength, 1, 5000, 'length');
        const offset = Math.max(Number(args.offset ?? 0) || 0, 0);
        if (typeof args.length === 'number' && typeof args.top === 'number' && args.length !== args.top) {
          notes.push('both `length` and `top` given; `length` wins (`top` is a deprecated alias)');
        }
        // offset is client-side paging: fetch offset+top rows (within the cap)
        // and slice, mirroring adt_search.
        const fetchTop = Math.min(offset + clamp.value, 5000);
        if (clamp.note) notes.push(clamp.note);
        if (offset > 0) notes.push(`offset ${offset} applied (client-side paging within the ${fetchTop}-row cap)`);

        const result = await run(() => entry.client.dataPreview(name, mode, { top: fetchTop, signal: exec.signal }));
        const rows = result.rows.slice(offset, offset + clamp.value);
        if (offset + clamp.value < result.rows.length) {
          notes.push(`more rows available: raise offset to ${offset + clamp.value}`);
        }
        return {
          source: mode === 'cds' ? 'DDLS' : kindCode,
          name,
          offset,
          totalRows: result.totalRows,
          note: notes.length ? notes.join('; ') : undefined,
          queryExecutionTime: result.queryExecutionTime,
          columns: result.columns,
          rows,
          rawXml: result.rawXml,
        };
      },
    }),
  ];
}
