/**
 * sql-lint — ADT data-preview freestyle SQL dialect adapter (P1 of the
 * data-preview SQL upgrade).
 *
 * The /datapreview/freestyle endpoint does not run standard SQL — it runs a
 * stripped ABAP-SQL dialect through a parser that fails with MISLEADING
 * errors for well-known constructs. Field-proven dialect facts (usage
 * reports 1.x, IMPC D01, abap-mcp-adt, vibing-steampunk live systems):
 *
 * Rewrites (applied automatically, each recorded as a finding):
 *   - `order-by-direction`  `ORDER BY x DESC/ASC` → DESCENDING/ASCENDING.
 *   - `limit-to-length`     trailing `LIMIT n [OFFSET m]` → dropped (the row
 *                           window is the tool's `length`/`offset` params).
 *   - `ne-operator`         `<>` → `!=` (the parser rejects `<>`).
 *   - `alias-dot`           `alias.col` → `alias~col` (Open SQL selector).
 *   - `call-paren-spacing`  `COUNT(*)` → `COUNT( * )`, `IN(a,b)` → `IN ( a b )`
 *                           spacing (the parser rejects tight parens).
 *   - `long-line-wrap`      lines over 255 chars are soft-wrapped at
 *                           whitespace (the backend rejects longer lines).
 *
 * Hard rejections (cannot be expressed in this dialect / not reliably
 * fixable client-side; the compiler in sql-compiler.ts is the sanctioned
 * path for JOIN/aggregate/subquery shapes):
 *   - `select-only`     not a SELECT statement (the endpoint is read-only).
 *   - `union`           UNION / INTERSECT / EXCEPT compound SELECTs.
 *   - `or-like`         OR combined with LIKE (live-verified 400) — split
 *                       into queries and union locally instead.
 *   - `multi-like`      more than one LIKE per statement (live-verified 400).
 *   - `double-quote`    `"` outside string literals (HANA/standard-SQL paste;
 *                       Open SQL has no double-quoted identifiers here).
 *   - `multi-statement` an interior `;` (a trailing one is stripped).
 *
 * Rewrites only touch code segments — string literals ('…', `…`) are kept
 * verbatim. Pure string work, no I/O; unit-testable offline.
 */
/** One applied rewrite or refusal, surfaced to the agent as an output note. */
export interface SqlLintFinding {
    /** Short rule id (stable, greppable), e.g. `order-by-direction`. */
    rule: string;
    /** `rewrite` (applied) or `reject` (hard failure). */
    action: 'rewrite' | 'reject';
    /** Human-readable explanation for the tool-output note / error text. */
    detail: string;
}
/** Result of linting: the statement actually sent + what happened to it. */
export interface SqlLintResult {
    /** The rewritten statement (=== input, modulo trivia, when nothing applied). */
    sql: string;
    /** Every applied rewrite, in application order. */
    rewrites: SqlLintFinding[];
}
/** A lint refusal: the agent gets the reason and the sanctioned alternative. */
export declare class SqlLintError extends Error {
    readonly rule: string;
    constructor(rule: string, detail: string);
}
/** The backend parser rejects lines longer than this (255-char wire limit). */
export declare const MAX_SQL_LINE_LENGTH = 255;
/**
 * Lint (and where possible rewrite) one freestyle-SQL SELECT for the ADT
 * data-preview endpoint. Throws {@link SqlLintError} for constructs that
 * cannot be auto-fixed. Pure — no I/O.
 */
export declare function lintFreestyleSql(input: string): SqlLintResult;
//# sourceMappingURL=sql-lint.d.ts.map