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
import { lintFreestyleSql, SqlLintError } from './sql-lint.js';
import { compileAndRun, collectTables, needsCompilation, parseSelect, stripSingleTableAlias, SqlCompilerError } from './sql-compiler.js';

/**
 * Client-side freestyle-SQL handling: the P1 lint (sql-lint.ts) rewrites the
 * well-known dialect traps, and the P2 compiler (sql-compiler.ts) degrades
 * multi-table / aggregate statements into single-table fetches with local
 * evaluation. What remains here is orchestration only.
 */

/** True when a backend 400 says the SQL references a column that does not
 *  exist — the error text itself is accurate but costly to iterate on, so the
 *  rewording points at the one-round self-correction path (preview the entity
 *  structure for the real column list; usage report 1.3). */
function isUnknownColumnError(message: string): boolean {
  return /unknown column name/i.test(message);
}
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
        'The sql dialect is ADAPTED automatically: DESC/ASC→DESCENDING/ASCENDING, LIMIT n→the `length` param, ' +
        'alias.col→alias~col, <>→!=, long lines wrapped (every rewrite shows in the note). JOINs, aggregates ' +
        '(COUNT/SUM/MIN/MAX/AVG), GROUP BY/HAVING and IN (SELECT …) are COMPILED client-side: each table is ' +
        'fetched single-table (predicates pushed down) and joined/aggregated locally — exact over small sets, ' +
        'approximate beyond the row cap (noted in the output). OR+LIKE and multiple LIKEs are refused (parser ' +
        'limit; run one SELECT per pattern). No mandt column in the SELECT list. To learn a ' +
        "table's real columns, preview it with name+kind and length=1 and read the `columns` list.",
      parameters: {
        name: { type: 'string', description: 'Table or CDS view name (uppercase), e.g. ZCDS_DEMO, T001.' },
        kind: {
          type: 'string',
          enum: ['TABL', 'VIEW', 'STRU', 'DDLS'],
          description: 'Entity kind (same type codes as other tools; aligned with the ADT URI namespaces). Default TABL.',
        },
        associations: {
          type: 'boolean',
          description:
            'List the CDS associations of the entity (name+kind, DDLS): name, target and cardinality of each. ' +
            'The JOIN-alternative for CDS views — follow one with the `association` parameter.',
        },
        association: {
          type: 'string',
          description:
            "Follow ONE CDS association of the entity (e.g. '_Bookings') and return the associated rows — " +
            'the backend-side join over the association. Pair with name+kind (DDLS).',
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
            client: { type: 'string', description: 'Logged-on SAP client (mandt) of the destination — client-dependent tables read differently per client.' },
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
            `Data preview of ${value.name} (${value.source})${value.client ? ` [client ${value.client}]` : ''}${value.offset > 0 ? ` [rows from offset ${value.offset}]` : ''}: ` +
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
              const msg = error.message ?? '';
              // Column-selector dialects DISAGREE per backend (IMPC-class:
              // `~` expected; kic-class: `.` expected) — a selector complaint
              // suggests the OTHER spelling.
              if (/[~.]\s*is expected|not allowed here/i.test(msg) || /~/.test(msg)) {
                const swap = /is expected/i.test(msg) && /\./.test(msg) ? 'column selector: this backend expects `.` (alias.col) — you wrote `~`' : 'column selector: this backend may expect `~` (alias~col) — you wrote `.`';
                throw new Error(
                  `SQL rejected by the backend (HTTP 400): ${msg}. Common cause: ${swap}. ` +
                    'Drop the alias in single-table SELECTs (bare column names pass everywhere).',
                );
              }
              // Association endpoints on some backends need a stateful
              // launchfreestyle session (GET action → 400 "DDL source could
              // not be read") — point at the source-reading alternative.
              if (/DDL source.*could not be read/i.test(msg)) {
                throw new Error(
                  `Association navigation is not reachable on this backend (HTTP 400): ${msg}. ` +
                    `Alternative: read the association definitions from the view's DDL source — ` +
                    `adt_read_object { name: '${name}', type: 'DDLS' } and look for the association clauses.`,
                );
              }
              // The most common freestyle-SQL 400 on on-prem backends: the
              // client column (mandt) in the SELECT list — the parser rejects
              // cross-client field access outright. Only reword when the
              // backend actually says so (audit P3: ANY sql 400 used to be
              // misattributed to mandt).
              if (/mandt|cross.?client/i.test(msg)) {
                throw new Error(
                  `SQL rejected by the backend (HTTP 400): ${msg}. Common cause: the client column ` +
                    '(mandt) in the SELECT list — remove it (and any cross-client constructs) and select the ' +
                    'business columns only.',
                );
              }
              // Unknown column (usage report 1.3): the error text is accurate
              // but column guessing costs a round trip per miss. Point at the
              // one-round self-correction: preview the entity structure with
              // length=1 and read the real column list from `columns`.
              if (isUnknownColumnError(msg)) {
                const table = extractTablesFromSql(String(optStr(args.sql) ?? '')).join(', ');
                throw new Error(
                  `SQL rejected by the backend (HTTP 400): ${msg}. ` +
                    (table
                      ? `Get ${table}'s real column list in one round: adt_data_preview { name: '${table}', kind: 'TABL', length: 1 } ` +
                        '— the returned `columns` carry the exact names; then rewrite the SELECT with those.'
                      : 'Preview the target entity with length=1 to get its real column list, then rewrite the SELECT with those names.'),
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
        ) => {
          // totalRows fidelity (usage report 1.4): some backends always report
          // 0 in the XML even when rows came back — fall back to the fetched
          // count and say so, so "are there more rows" stays answerable.
          let totalRows = result.totalRows;
          if (totalRows === 0 && rows.length > 0) {
            totalRows = rows.length;
            notes.push(
              `totalRows reported by the backend as 0 despite ${rows.length} fetched row(s); using the fetched count ` +
                '("more rows available" notes are the reliable signal for paging)',
            );
          }
          return {
            source,
            name,
            // Logged-on client (usage report 3): client-dependent tables read
            // differently per mandt and the success payload showed no client —
            // surface the destination's so wrong-client reads are diagnosable.
            client: entry.config.client,
            offset: paging.offset,
            totalRows,
            note: notes.length ? notes.join('; ') : undefined,
            queryExecutionTime: result.queryExecutionTime,
            columns: result.columns,
            rows,
            rawXml: result.rawXml,
          };
        };

        const sql = optStr(args.sql);
        if (sql) {
          // P1 dialect lint (sql-lint.ts): SELECT-only gate, well-known trap
          // rewrites, hard refusals for what the dialect cannot express.
          const linted = lintFreestyleSql(sql);
          // Read-side governance FIRST (denials outrank syntax advice): every
          // FROM/JOIN target of the ORIGINAL statement is resolved and
          // checked BEFORE any request is sent — zero traffic on denial.
          applyReadGovernance(entry.policy, extractTablesFromSql(sql), 'adt_data_preview (sql)', notes);
          // P2 compilation decision: single-table plain SELECTs go straight
          // to the endpoint (dialect-linted); anything richer (JOIN /
          // aggregate / GROUP BY / HAVING / IN-subquery) is compiled into
          // single-table fetches + local evaluation (sql-compiler.ts).
          let compiled = false;
          try {
            const ast = parseSelect(linted.sql);
            compiled = needsCompilation(ast);
          } catch (error) {
            if (error instanceof SqlCompilerError) {
              // Shape the parser cannot handle — if the backend can, let it
              // try (the lint already refused what we KNOW fails); otherwise
              // surface the compiler's remedy.
              const singleTable = !/\bjoin\b|\bgroup\s+by\b|\bhaving\b/i.test(linted.sql) && !/\bin\s*\(\s*select\b/i.test(linted.sql);
              if (!singleTable) throw error;
            } else {
              throw error;
            }
          }
          if (linted.rewrites.length > 0) {
            notes.push(`sql dialect rewrites: ${linted.rewrites.map((r) => r.detail).join('; ')}`);
          }
          const paging = resolveRowWindow(args, notes);
          if (compiled) {
            const result = await compileAndRun(linted.sql, (fetchSql, fetchOpts) =>
              run(() => entry.client.runSqlQuery(fetchSql, { top: fetchOpts.top, signal: fetchOpts.signal ?? exec.signal })),
            { length: paging.length, offset: paging.offset, signal: exec.signal });
            for (const n of result.notes) notes.push(n);
            notes.push(`compiled client-side — statements executed: ${result.executedSqls.join(' ; ')}`);
            return {
              source: 'sql (compiled)',
              name: 'QUERY',
              client: entry.config.client,
              offset: paging.offset,
              totalRows: result.rows.length,
              note: notes.length ? notes.join('; ') : undefined,
              columns: result.columns,
              rows: result.rows,
            };
          }
          // Single-table path: normalize to the bare (alias-free) spelling —
          // backends disagree on selector grammar (a~col vs a.col) and some
          // reject bare FROM aliases with a MISLEADING "only one SELECT"
          // error; bare names pass everywhere. Then fetch offset+length rows
          // (within the cap) and slice, honoring the entity-preview window.
          const bare = stripSingleTableAlias(linted.sql);
          if (bare && bare !== linted.sql) {
            notes.push('single-table statement normalized: alias dropped, column prefixes stripped (selector grammar varies by backend)');
            linted.sql = bare;
          }
          const result = await run(() => entry.client.runSqlQuery(linted.sql, { top: paging.fetchTop, signal: exec.signal }));
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

        // CDS association navigation (P3): `associations` lists them,
        // `association` follows one — the backend-side join for CDS views.
        const wantAssociations = args.associations === true;
        const followAssociation = optStr(args.association);
        if (wantAssociations || followAssociation) {
          if (mode !== 'cds') {
            throw new Error('adt_data_preview: `associations`/`association` apply to CDS views (kind=DDLS) only');
          }
          if (wantAssociations && !followAssociation) {
            const list = await run(() => entry.client.listCdsAssociations(name, { signal: exec.signal }));
            return {
              source: 'associations',
              name,
              client: entry.config.client,
              offset: 0,
              totalRows: list.associations.length,
              note: notes.length ? notes.join('; ') : undefined,
              columns: [
                { name: 'NAME', type: 'CHAR' },
                { name: 'TARGET', type: 'CHAR' },
                { name: 'CARDINALITY', type: 'CHAR' },
              ],
              rows: list.associations.map((a) => ({
                NAME: a.name,
                TARGET: a.target ?? '',
                CARDINALITY: a.cardinality ?? '',
              })),
            };
          }
          if (followAssociation) {
            const paging = resolveRowWindow(args, notes);
            const result = await run(() =>
              entry.client.followCdsAssociation(name, followAssociation, { top: paging.fetchTop, signal: exec.signal }),
            );
            const rows = pageRows(result.rows, paging.offset, paging.length, notes);
            return toOutput(`association ${followAssociation}`, result.name, result, paging, rows);
          }
        }

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
