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
import { defineTool, type ToolHost } from '../tooldef.js';
import { AdtError, type AdtDataPreview } from '@nefevcore/abap-adt-protocol';
import { extractTablesFromSql } from '../tableblocklist.js';
import type { AdtPolicy } from '../policy.js';
import { sessionCwd, DESTINATION_PARAM, clampWithNote, destinationOf, isAdtServiceUnavailable, optStr, text, type ToolDeps } from './common.js';

/** Map the shared type-code namespace onto the two preview API modes. */
const KIND_TO_MODE: Record<string, 'ddic' | 'cds'> = {
  TABL: 'ddic',
  VIEW: 'ddic',
  STRU: 'ddic',
  DDLS: 'cds',
};

/**
 * Shared row-window resolution of the entity and sql paths: clamp `length`
 * (1–500, `top` as the deprecated alias), resolve the client-side `offset`,
 * compute the fetch top, and record the clamp/offset notes in order.
 */
function resolveRowWindow(
  args: Record<string, unknown>,
  notes: string[],
): { offset: number; fetchTop: number; length: number } {
  const requested = typeof args.length === 'number' ? args.length : typeof args.top === 'number' ? args.top : 100;
  const clamp = clampWithNote(requested, 1, 500, 'length');
  const offset = Math.max(Number(args.offset ?? 0) || 0, 0);
  const fetchTop = Math.min(offset + clamp.value, 500);
  if (clamp.note) notes.push(clamp.note);
  if (offset > 0) notes.push(`offset ${offset} applied (client-side paging within the ${fetchTop}-row cap)`);
  return { offset, fetchTop, length: clamp.value };
}

/** Slice the fetched rows to the window and note whether more are available. */
function pageRows<T>(rows: T[], offset: number, length: number, notes: string[]): T[] {
  const window = rows.slice(offset, offset + length);
  if (offset + length < rows.length) notes.push(`more rows available: raise offset to ${offset + length}`);
  return window;
}

export function dataPreviewTools(deps: ToolDeps, ctx?: ToolHost) {
  const { registry } = deps;
  const audit = (message: string): void => {
    // Read-governance audit trail: tool output note AND the plugin logger
    // (abap-mcp logs to stderr; we own both surfaces here).
    (ctx?.logger?.('abap-adt')?.info ?? console.info)(`abap-adt: ${message}`);
  };
  /** Read-side governance, shared by the entity and sql paths: refuse blocked
   *  tables BEFORE any request is sent (deny = zero traffic to SAP) and
   *  surface allowedTables exemptions as audited notes. */
  const applyReadGovernance = (
    policy: AdtPolicy,
    tables: readonly string[],
    context: string,
    notes: string[],
  ): void => {
    const { exempted } = policy.assertTableReadsAllowed(tables, context);
    if (exempted.length > 0) {
      const note = `allowedTables exemption (audited): ${exempted.join(', ')}`;
      notes.push(note);
      audit(note);
    }
  };
  return [
    defineTool({
      name: 'adt_data_preview',
      description:
        'Read rows from a database table / CDS view (SE16/SE16N-style data browser) or run a freestyle SELECT ' +
        'via the ADT Data Preview API. Provide `name` + `kind` (same type codes as everywhere: TABL, VIEW, STRU ' +
        'for DDIC entities, DDLS for CDS views; default TABL) or `sql` (freestyle — SELECT statements only; ' +
        'anything else is rejected). `top`/`offset` page the rows. Read-only. Read governance: destinations may ' +
        'set blockedTablesProfile — reads of sensitive tables (e.g. customer/bank/HR data like KNA1, LFA1, ' +
        'BUT000, USR02) are then refused with the reason BEFORE any request is sent. ' +
        'Note: ABAP Cloud (BTP) blocks direct database-table preview; CDS views and freestyle SQL work there. ' +
        'Freestyle SQL restriction: the SELECT list must NOT include the client column (mandt) — the backend ' +
        'SQL parser rejects cross-client field access with HTTP 400; select the business columns only.',
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
            '(default 100, clamped to 1–500; alias of the deprecated `top`).',
        },
        top: { type: 'integer', description: 'Deprecated alias of `length`.' },
        offset: { type: 'integer', description: 'Skip the first N rows (client-side, within the 500-row cap; default 0).' },
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
        const entry = await registry.require(destinationOf(args), sessionCwd(exec));
        const notes: string[] = [];

        const run = async <T>(fn: () => Promise<T>): Promise<T> => {
          try {
            return await fn();
          } catch (error) {
            if (isAdtServiceUnavailable(error)) {
              throw new Error(
                `Data Preview is not available on destination '${entry.config.name}' — ` +
                  'the ADT profile does not expose the datapreview service (HTTP ' +
                  `${error.status}). Read data another way: export/analyze sources locally, ` +
                  'or query the table through a program/function module that reads it.',
              );
            }
            if (error instanceof AdtError && error.status === 400) {
              // The most common freestyle-SQL 400 on on-prem backends: the
              // client column (mandt) in the SELECT list — the parser rejects
              // cross-client field access outright. Only reword when the
              // backend actually says so (audit P3: ANY sql 400 used to be
              // misattributed to mandt).
              const msg = error.message ?? '';
              if (/mandt|cross.?client/i.test(msg)) {
                throw new Error(
                  `SQL rejected by the backend (HTTP 400): ${msg}. Common cause: the client column ` +
                    '(mandt) in the SELECT list — remove it (and any cross-client constructs) and select the ' +
                    'business columns only.',
                );
              }
            }
            throw error;
          }
        };

        // Shared output mapping of the sql and entity paths (only the
        // source/name pair differs between them).
        const toOutput = (
          source: string,
          name: string,
          result: AdtDataPreview,
          paging: { offset: number },
          rows: AdtDataPreview['rows'],
        ) => ({
          source,
          name,
          offset: paging.offset,
          totalRows: result.totalRows,
          note: notes.length ? notes.join('; ') : undefined,
          queryExecutionTime: result.queryExecutionTime,
          columns: result.columns,
          rows,
          rawXml: result.rawXml,
        });

        const sql = optStr(args.sql);
        if (sql) {
          // Light SELECT-only lint (audit M3): the freestyle endpoint is a
          // read-only data-preview API — refuse anything that does not lead
          // with SELECT instead of relying on the backend parser alone.
          if (!/^\s*select[\s(]/i.test(sql)) {
            throw new Error(
              'adt_data_preview: `sql` accepts a SELECT statement only (the data-preview API is read-only). ' +
                `Got: ${sql.trim().slice(0, 60)}${sql.trim().length > 60 ? '…' : ''}`,
            );
          }
          // Read-side governance: every FROM/JOIN target is resolved and
          // checked BEFORE the request is sent — a blocked table answers
          // [POLICY] with zero traffic to SAP.
          applyReadGovernance(entry.policy, extractTablesFromSql(sql), 'adt_data_preview (sql)', notes);
          // Fetch offset+length rows (within the cap) and slice, so the SQL
          // path honors the same offset/length row-range as entity previews.
          const paging = resolveRowWindow(args, notes);
          const result = await run(() => entry.client.runSqlQuery(sql, { top: paging.fetchTop, signal: exec.signal }));
          const rows = pageRows(result.rows, paging.offset, paging.length, notes);
          return toOutput('sql', result.name, result, paging, rows);
        }

        const name = String(args.name ?? '').toUpperCase().trim();
        if (!name) throw new Error('adt_data_preview: provide either `name`+`kind` or `sql`');
        const kindCode = (optStr(args.kind) ?? 'TABL').toUpperCase();
        const mode = KIND_TO_MODE[kindCode];
        if (!mode) {
          throw new Error(`adt_data_preview: unsupported kind '${kindCode}' (expected TABL, VIEW, STRU or DDLS)`);
        }
        // Read-side governance, entity path: the previewed entity name is the
        // read target (for a CDS view this checks the VIEW name — its base
        // tables cannot be resolved client-side; exempt or mask at view level).
        applyReadGovernance(entry.policy, [name], 'adt_data_preview', notes);
        if (typeof args.length === 'number' && typeof args.top === 'number' && args.length !== args.top) {
          notes.push('both `length` and `top` given; `length` wins (`top` is a deprecated alias)');
        }
        // offset is client-side paging: fetch offset+top rows (within the cap)
        // and slice, mirroring adt_search.
        const paging = resolveRowWindow(args, notes);
        const result = await run(() => entry.client.dataPreview(name, mode, { top: paging.fetchTop, signal: exec.signal }));
        const rows = pageRows(result.rows, paging.offset, paging.length, notes);
        return toOutput(mode === 'cds' ? 'DDLS' : kindCode, name, result, paging, rows);
      },
    }),
  ];
}
