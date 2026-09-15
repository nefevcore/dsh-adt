/**
 * sql-compiler — client-side SQL compiler for adt_data_preview (P2 of the
 * data-preview SQL upgrade).
 *
 * The ADT freestyle endpoint speaks a single-table dialect (JOIN/subquery/
 * aggregate all fail with misleading 400s). This module lets the agent write
 * natural multi-table SQL and compiles it into SINGLE-TABLE fetches plus
 * local evaluation:
 *
 *   SELECT h.bukrs, COUNT(*) AS cnt, p.menge
 *   FROM bkpf AS h JOIN bseg AS p ON h.bukrs = p.bukrs
 *   WHERE h.gjahr = 2024 AND p.menge > 10
 *   GROUP BY h.bukrs ORDER BY cnt DESC
 *
 *   → fetch bkpf (WHERE gjahr = 2024 pushed down)
 *   → fetch bseg (WHERE menge > 10 pushed down)
 *   → local hash join on bukrs, local group+count, local sort
 *
 * Fidelity is HONEST: every approximation (row caps, pushed-down-but-
 * incomplete predicates, '' as NULL) surfaces as a note in the result, and
 * every generated statement is reported in `executedSqls`.
 *
 * Scope (v1 — anything outside rejects with a pointed message):
 *   - SELECT list: `*`, `t.*`, column refs, aggregate calls (COUNT/SUM/MIN/
 *     MAX/AVG, optional DISTINCT), each with optional alias.
 *   - FROM one table (+ AS alias); INNER/LEFT [OUTER] JOIN chains.
 *   - WHERE/HAVING: AND/OR/NOT, parens, comparisons (=, !=, <>, <, <=, >,
 *     >=), LIKE (single pattern), IN (list), [NOT] IN (SELECT …), IS [NOT]
 *     NULL. BETWEEN/scalar subqueries in the SELECT list are rejected.
 *   - GROUP BY columns; ORDER BY columns/aliases/aggregate items, ASC/DESC.
 *
 * Pure orchestrator: all I/O goes through the injected `runQuery`.
 */
/** A construct the compiler does not handle — the message names the fix. */
export declare class SqlCompilerError extends Error {
    readonly rule: string;
    constructor(rule: string, detail: string);
}
/** `alias~col` / `col` — alias is the table alias or undefined. */
interface ColumnRef {
    kind: 'column';
    alias?: string;
    column: string;
}
interface AggregateRef {
    kind: 'aggregate';
    fn: 'COUNT' | 'SUM' | 'MIN' | 'MAX' | 'AVG';
    distinct: boolean;
    arg: ColumnRef;
}
type SelectItem = {
    expr: ColumnRef | AggregateRef;
    alias?: string;
};
interface TableRef {
    name: string;
    alias?: string;
}
type JoinType = 'inner' | 'left';
interface JoinClause {
    type: JoinType;
    table: TableRef;
    on: Cond;
}
type Cond = {
    kind: 'and';
    parts: Cond[];
} | {
    kind: 'or';
    parts: Cond[];
} | {
    kind: 'not';
    inner: Cond;
} | {
    kind: 'cmp';
    left: ColumnRef | Literal | AggregateRef;
    op: '=' | '!=' | '<' | '<=' | '>' | '>=' | 'LIKE';
    right: ColumnRef | Literal;
} | {
    kind: 'in';
    left: ColumnRef;
    not: boolean;
    list: Literal[];
} | {
    kind: 'in-sub';
    left: ColumnRef;
    not: boolean;
    sub: SelectAst;
} | {
    kind: 'isnull';
    left: ColumnRef;
    not: boolean;
};
type Literal = {
    kind: 'literal';
    value: string;
    numeric: boolean;
};
interface OrderItem {
    expr: ColumnRef | AggregateRef;
    dir: 'ASC' | 'DESC';
}
interface SelectAst {
    distinct: boolean;
    items: SelectItem[];
    from: TableRef;
    joins: JoinClause[];
    where?: Cond;
    groupBy: ColumnRef[];
    having?: Cond;
    orderBy: OrderItem[];
}
/** All tables a statement reads (FROM + JOINs, subqueries included). */
export declare function collectTables(ast: SelectAst): string[];
/** Does this statement need the compiler (multi-table / aggregate / …)? */
export declare function needsCompilation(ast: SelectAst): boolean;
/** Parse a full freestyle SELECT (throws SqlCompilerError on shape). */
export declare function parseSelect(sql: string): SelectAst;
/**
 * Normalize a SINGLE-TABLE statement to its bare form: drop the (optional)
 * alias and strip alias prefixes from column references. Backends disagree
 * on the selector grammar (a~col vs a.col) and some reject bare aliases in
 * FROM outright ("Only one SELECT statement is allowed" — misleading); the
 * alias-free spelling passes everywhere. Returns null when the statement is
 * multi-table or not normalizable.
 */
export declare function stripSingleTableAlias(sql: string): string | null;
export interface RunQueryFn {
    (sql: string, opts: {
        top: number;
        signal?: AbortSignal;
    }): Promise<{
        columns: Array<{
            name: string;
            type: string;
        }>;
        rows: Array<Record<string, string | null>>;
        totalRows: number;
    }>;
}
export interface CompileRunOptions {
    length: number;
    offset: number;
    signal?: AbortSignal;
}
export interface CompiledSqlResult {
    columns: Array<{
        name: string;
        type: string;
    }>;
    rows: Array<Record<string, string>>;
    notes: string[];
    executedSqls: string[];
}
/**
 * Compile-and-run a freestyle SELECT that needs the client-side path:
 * execute subqueries, fetch each table with pushed-down predicates, then
 * join/filter/aggregate/sort locally. All approximations are reported.
 */
export declare function compileAndRun(sql: string, runQuery: RunQueryFn, opts: CompileRunOptions): Promise<CompiledSqlResult>;
export {};
//# sourceMappingURL=sql-compiler.d.ts.map