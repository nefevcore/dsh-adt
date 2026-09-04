/**
 * Read-side sensitive-table blocklist — the READ complement to the write-side
 * policy knobs (see policy.ts). Row-returning reads (`adt_data_preview`
 * entity + freestyle SQL paths) resolve the target table names BEFORE any
 * request is sent and refuse blocked tables with the category and reason,
 * so both the agent and the human learn WHY a table is off limits.
 *
 * Semantics adopted from abap-mcp's tableBlocklist (deny is never bypassable)
 * with one deliberate simplification: every built-in entry is a hard DENY —
 * there is no `acknowledge_risk` per-call escape. The sanctioned bypass is
 * the config-level `allowedTables` exemption, which is applied per
 * destination and surfaces an audit note in the tool output (and the plugin
 * logger) on every use.
 *
 * Profiles (tiers are inclusive: each tier adds the previous ones):
 *   - `minimal`  — direct PII: banking, customer/vendor/BP master, addresses,
 *                  authentication/authorization, HR/payroll, tax IDs
 *   - `standard` — minimal + transactional data with linked PII (SD/MM/FI
 *                  documents, change documents, long texts)
 *   - `strict`   — standard + audit/security logs, communication & workflow
 *                  payloads, and the customer namespace pattern `Z*`
 *   - `off`      — no read-side governance (the default; opt-in)
 *
 * Patterns use `*` as a SAP-name wildcard (`[A-Z0-9_]*`), matched
 * case-insensitively — the same alphabet real table names are built from.
 *
 * This module is intentionally dependency-free (pure catalog + logic) so it
 * can be unit-tested without any SAP system.
 */
/** The four read-side profiles (`off` disables the whole mechanism). */
export type BlockedTableProfile = 'off' | 'minimal' | 'standard' | 'strict';
/** One catalog entry: what the category protects and since which tier. */
export interface BlockedTableEntry {
    category: string;
    tier: Exclude<BlockedTableProfile, 'off'>;
    why: string;
    /** Exact names and `*` patterns (compiled below). */
    names: string[];
}
/** A matched block: table plus the educational entry that matched it. */
export interface BlockedTableHit {
    table: string;
    category: string;
    tier: Exclude<BlockedTableProfile, 'off'>;
    why: string;
}
/** Compile a SAP-name glob: `*` → `[A-Z0-9_]*`, case-insensitive full match. */
export declare function tableGlobToRegExp(pattern: string): RegExp;
/**
 * Find the catalog entry that blocks `table` under the given profile
 * (custom `extra` patterns are checked FIRST — user additions outrank the
 * built-in catalog and always report the user-extended category).
 */
export declare function findBlockedTable(table: string, profile: BlockedTableProfile, extra?: readonly string[]): BlockedTableHit | null;
/**
 * Extract candidate table names from a freestyle SQL SELECT: every
 * `FROM <t>` / `JOIN <t>` operand without a schema qualifier. Over-approximates
 * on purpose (subqueries included) — a read-governance extractor must never
 * miss a table, a false positive only costs a lookup in the catalog.
 */
export declare function extractTablesFromSql(sql: string): string[];
//# sourceMappingURL=tableblocklist.d.ts.map