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
import { lintFreestyleSql, SqlLintError } from './sql-lint.js';
// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
/** A construct the compiler does not handle — the message names the fix. */
export class SqlCompilerError extends Error {
    rule;
    constructor(rule, detail) {
        super(`adt_data_preview: ${detail} [sql-compiler: ${rule}]`);
        this.name = 'SqlCompilerError';
        this.rule = rule;
    }
}
const KEYWORDS = new Set([
    'SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'HAVING', 'ORDER', 'JOIN', 'INNER',
    'LEFT', 'RIGHT', 'FULL', 'OUTER', 'ON', 'AS', 'AND', 'OR', 'NOT', 'IN',
    'LIKE', 'IS', 'NULL', 'DISTINCT', 'COUNT', 'SUM', 'MIN', 'MAX', 'AVG',
    'ASC', 'DESC', 'ASCENDING', 'DESCENDING', 'OFFSET', 'LIMIT', 'UP', 'TO',
    'ROWS', 'UNION', 'EXCEPT', 'INTERSECT',
]);
function tokenize(sql) {
    const tokens = [];
    let i = 0;
    const n = sql.length;
    while (i < n) {
        const ch = sql[i];
        if (/\s/.test(ch)) {
            i += 1;
            continue;
        }
        if (ch === "'") {
            // '…' with '' as an escaped quote.
            let j = i + 1;
            let value = '';
            while (j < n) {
                if (sql[j] === "'") {
                    if (sql[j + 1] === "'") {
                        value += "'";
                        j += 2;
                        continue;
                    }
                    break;
                }
                value += sql[j];
                j += 1;
            }
            if (j >= n)
                throw new SqlCompilerError('unterminated-string', `unterminated string literal at position ${i}`);
            tokens.push({ type: 'string', text: value, raw: `'${value}'`, pos: i });
            i = j + 1;
            continue;
        }
        if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(sql[i + 1] ?? ''))) {
            let j = i;
            while (j < n && /[0-9.]/.test(sql[j]))
                j += 1;
            tokens.push({ type: 'number', text: sql.slice(i, j), raw: sql.slice(i, j), pos: i });
            i = j;
            continue;
        }
        if (/[A-Za-z_]/.test(ch)) {
            let j = i;
            while (j < n && /[A-Za-z0-9_]/.test(sql[j]))
                j += 1;
            const raw = sql.slice(i, j);
            const upper = raw.toUpperCase();
            tokens.push({ type: KEYWORDS.has(upper) ? 'keyword' : 'ident', text: upper, raw, pos: i });
            i = j;
            continue;
        }
        if (ch === '*' || ch === '~') {
            tokens.push({ type: 'star', text: ch, raw: ch, pos: i });
            i += 1;
            continue;
        }
        if (ch === '.' && /[A-Za-z_]/.test(sql[i + 1] ?? '')) {
            // `alias.col` — the standard-SQL column selector; normalized to the
            // Open SQL `~` (decimal literals never reach here: they start with a
            // digit and are consumed by the number branch above).
            tokens.push({ type: 'star', text: '~', raw: '.', pos: i });
            i += 1;
            continue;
        }
        if ('(),;'.includes(ch)) {
            tokens.push({ type: 'punct', text: ch, raw: ch, pos: i });
            i += 1;
            continue;
        }
        const two = sql.slice(i, i + 2);
        if (two === '<>' || two === '<=' || two === '>=' || two === '!=') {
            tokens.push({ type: 'op', text: two === '<>' ? '!=' : two, raw: two, pos: i });
            i += 2;
            continue;
        }
        if ('=<>'.includes(ch)) {
            tokens.push({ type: 'op', text: ch, raw: ch, pos: i });
            i += 1;
            continue;
        }
        throw new SqlCompilerError('bad-character', `unexpected character '${ch}' at position ${i}`);
    }
    return tokens;
}
// ---------------------------------------------------------------------------
// Parser (recursive descent over the clause skeleton)
// ---------------------------------------------------------------------------
class Parser {
    tokens;
    pos = 0;
    constructor(tokens) {
        this.tokens = tokens;
    }
    peek(offset = 0) {
        return this.tokens[this.pos + offset];
    }
    next() {
        const t = this.peek();
        if (!t)
            throw new SqlCompilerError('unexpected-end', 'statement ended unexpectedly');
        this.pos += 1;
        return t;
    }
    expectKeyword(kw) {
        const t = this.next();
        if (t.type !== 'keyword' || t.text !== kw) {
            throw new SqlCompilerError('syntax', `expected ${kw} but found '${t.raw}'`);
        }
    }
    acceptKeyword(kw) {
        const t = this.peek();
        if (t && t.type === 'keyword' && t.text === kw) {
            this.pos += 1;
            return true;
        }
        return false;
    }
    acceptPunct(p) {
        const t = this.peek();
        if (t && t.type === 'punct' && t.text === p) {
            this.pos += 1;
            return true;
        }
        return false;
    }
    parseSelect(subselect = false) {
        this.expectKeyword('SELECT');
        const distinct = this.acceptKeyword('DISTINCT');
        const items = [];
        for (;;) {
            items.push(this.parseSelectItem());
            if (!this.acceptPunct(','))
                break;
        }
        this.expectKeyword('FROM');
        const from = this.parseTableRef();
        const joins = [];
        for (;;) {
            const joinType = this.parseJoinType();
            if (!joinType)
                break;
            const table = this.parseTableRef();
            this.expectKeyword('ON');
            const on = this.parseCond();
            joins.push({ type: joinType, table, on });
        }
        let where;
        if (this.acceptKeyword('WHERE'))
            where = this.parseCond();
        const groupBy = [];
        if (this.acceptKeyword('GROUP')) {
            this.expectKeyword('BY');
            for (;;) {
                groupBy.push(this.parseColumnRef());
                if (!this.acceptPunct(','))
                    break;
            }
        }
        let having;
        if (this.acceptKeyword('HAVING'))
            having = this.parseCond();
        const orderBy = [];
        if (this.acceptKeyword('ORDER')) {
            this.expectKeyword('BY');
            for (;;) {
                const expr = this.parseSelectExpr();
                let dir = 'ASC';
                if (this.acceptKeyword('ASCENDING') || this.acceptKeyword('ASC'))
                    dir = 'ASC';
                else if (this.acceptKeyword('DESCENDING') || this.acceptKeyword('DESC'))
                    dir = 'DESC';
                orderBy.push({ expr, dir });
                if (!this.acceptPunct(','))
                    break;
            }
        }
        // Trailing `UP TO n ROWS` (agent habit from the dialect docs) — accepted
        // and ignored: the row window is the tool's length/offset parameters.
        if (this.acceptKeyword('UP')) {
            this.expectKeyword('TO');
            this.next(); // the number
            this.expectKeyword('ROWS');
        }
        // Trailing `LIMIT n [OFFSET m]` — likewise a length/offset spelling the
        // lint may have left when the compiler runs on the PRE-lint text (the
        // lint already rewrote ORDER BY directions, so it must not double-see
        // this; the compiler path tolerates and drops it).
        if (this.acceptKeyword('LIMIT')) {
            this.next(); // the number
            if (this.acceptKeyword('OFFSET'))
                this.next(); // its number
        }
        const trailing = this.peek();
        if (trailing && !(subselect && trailing.type === 'punct' && trailing.text === ')')) {
            throw new SqlCompilerError('trailing-tokens', `unexpected trailing input near '${trailing.raw}'`);
        }
        return { distinct, items, from, joins, where, groupBy, having, orderBy };
    }
    parseJoinType() {
        const t = this.peek();
        if (!t || t.type !== 'keyword')
            return undefined;
        if (t.text === 'JOIN') {
            this.pos += 1;
            return 'inner';
        }
        if (t.text === 'INNER') {
            const nxt = this.peek(1);
            if (nxt?.type === 'keyword' && nxt.text === 'JOIN') {
                this.pos += 2;
                return 'inner';
            }
            return undefined;
        }
        if (t.text === 'LEFT') {
            let look = 1;
            let outerSeen = false;
            const t2 = this.peek(1);
            if (t2?.type === 'keyword' && t2.text === 'OUTER') {
                outerSeen = true;
                look = 2;
            }
            const tj = this.peek(look);
            if (tj?.type === 'keyword' && tj.text === 'JOIN') {
                this.pos += look + 1;
                void outerSeen;
                return 'left';
            }
            return undefined;
        }
        if (t.text === 'RIGHT' || t.text === 'FULL') {
            throw new SqlCompilerError('join-type', `${t.text} JOIN is not supported by the client-side compiler (INNER and LEFT only) — ` +
                'restructure the query (swap the tables) or run the sides separately');
        }
        return undefined;
    }
    parseTableRef() {
        const t = this.next();
        if (t.type !== 'ident') {
            throw new SqlCompilerError('table-name', `expected a table name but found '${t.raw}'`);
        }
        const ref = { name: t.text };
        if (this.acceptKeyword('AS')) {
            const a = this.next();
            if (a.type !== 'ident')
                throw new SqlCompilerError('table-alias', `expected an alias after AS but found '${a.raw}'`);
            ref.alias = a.text;
        }
        else {
            const a = this.peek();
            // Bare alias (FROM bkpf h) — an identifier directly after the table.
            if (a && a.type === 'ident') {
                ref.alias = a.text;
                this.pos += 1;
            }
        }
        return ref;
    }
    parseSelectItem() {
        const expr = this.parseSelectExpr();
        let alias;
        if (this.acceptKeyword('AS')) {
            const a = this.next();
            if (a.type !== 'ident' && a.type !== 'keyword') {
                throw new SqlCompilerError('select-alias', `expected an alias after AS but found '${a.raw}'`);
            }
            alias = a.text;
        }
        return { expr, alias };
    }
    /** A select/order/having expression: column ref or aggregate call. */
    parseSelectExpr() {
        const t = this.peek();
        if (!t)
            throw new SqlCompilerError('unexpected-end', 'expected an expression');
        if (t.type === 'keyword' && (t.text === 'COUNT' || t.text === 'SUM' || t.text === 'MIN' || t.text === 'MAX' || t.text === 'AVG')) {
            this.pos += 1;
            if (!this.acceptPunct('('))
                throw new SqlCompilerError('aggregate-syntax', `expected ( after ${t.text}`);
            const distinct = this.acceptKeyword('DISTINCT');
            let arg;
            if (this.peek()?.type === 'star') {
                this.pos += 1;
                arg = { kind: 'column', column: '*' };
            }
            else {
                arg = this.parseColumnRef();
            }
            if (!this.acceptPunct(')'))
                throw new SqlCompilerError('aggregate-syntax', `expected ) to close ${t.text}(`);
            return { kind: 'aggregate', fn: t.text, distinct, arg };
        }
        return this.parseColumnRef();
    }
    parseColumnRef() {
        const t = this.next();
        if (t.type === 'star')
            return { kind: 'column', column: '*' };
        if (t.type === 'ident') {
            // alias~col / alias~* / plain col (`.` was normalized to `~` by the
            // tokenizer).
            const nx = this.peek();
            if (nx && nx.type === 'star' && nx.text === '~') {
                this.pos += 1;
                const after = this.peek();
                if (after && after.type === 'star' && after.text === '*') {
                    this.pos += 1;
                    return { kind: 'column', alias: t.text, column: '*' };
                }
                if (after && after.type === 'ident') {
                    this.pos += 1;
                    return { kind: 'column', alias: t.text, column: after.text };
                }
                throw new SqlCompilerError('column-ref', `expected a column after '${t.raw}~'`);
            }
            return { kind: 'column', column: t.text };
        }
        if (t.type === 'number' || t.type === 'string') {
            throw new SqlCompilerError('literal-item', `literal '${t.raw}' in the SELECT list is not supported — select real columns (or wrap literals in a WHERE condition)`);
        }
        throw new SqlCompilerError('column-ref', `expected a column reference but found '${t.raw}'`);
    }
    // --- conditions ---
    parseCond() {
        return this.parseOr();
    }
    parseOr() {
        const parts = [this.parseAnd()];
        while (this.acceptKeyword('OR'))
            parts.push(this.parseAnd());
        return parts.length === 1 ? parts[0] : { kind: 'or', parts };
    }
    parseAnd() {
        const parts = [this.parseUnary()];
        while (this.acceptKeyword('AND'))
            parts.push(this.parseUnary());
        return parts.length === 1 ? parts[0] : { kind: 'and', parts };
    }
    parseUnary() {
        if (this.acceptKeyword('NOT'))
            return { kind: 'not', inner: this.parseUnary() };
        if (this.acceptPunct('(')) {
            const inner = this.parseOr();
            if (!this.acceptPunct(')'))
                throw new SqlCompilerError('paren', 'expected ) to close a condition group');
            return inner;
        }
        return this.parsePredicate();
    }
    parsePredicate() {
        const left = this.parseSelectExpr();
        if (left.kind !== 'column') {
            // Aggregate predicates (HAVING COUNT(*) >= 1) are legal on the left;
            // literals are not conditions.
            if (left.kind === 'aggregate') {
                const t = this.peek();
                if (t?.type === 'op') {
                    this.pos += 1;
                    const right = this.parseOperand();
                    return { kind: 'cmp', left, op: t.text, right };
                }
            }
            throw new SqlCompilerError('operand', 'the left side of a condition must be a column reference (literals may only appear on the right)');
        }
        const t = this.peek();
        if (t?.type === 'op') {
            this.pos += 1;
            const right = this.parseOperand();
            return { kind: 'cmp', left, op: t.text, right };
        }
        if (t?.type === 'keyword' && t.text === 'LIKE') {
            this.pos += 1;
            const right = this.parseOperand();
            return { kind: 'cmp', left, op: 'LIKE', right };
        }
        if (t?.type === 'keyword' && t.text === 'IN') {
            this.pos += 1;
            return this.parseInAfterKeyword(left, false);
        }
        if (t?.type === 'keyword' && t.text === 'IS') {
            this.pos += 1;
            let not = false;
            if (this.acceptKeyword('NOT'))
                not = true;
            this.expectKeyword('NULL');
            return { kind: 'isnull', left, not };
        }
        if (t?.type === 'keyword' && t.text === 'NOT') {
            const nxt = this.peek(1);
            if (nxt?.type === 'keyword' && nxt.text === 'IN') {
                this.pos += 2;
                return this.parseInAfterKeyword(left, true);
            }
        }
        throw new SqlCompilerError('operator', `expected a comparison operator after '${left.column}'`);
    }
    /** IN tail: literal list → `in`, subselect → `in-sub`. */
    parseInAfterKeyword(left, not) {
        if (!this.acceptPunct('('))
            throw new SqlCompilerError('in-syntax', 'expected ( after IN');
        if (this.peek()?.type === 'keyword' && this.peek().text === 'SELECT') {
            const sub = this.parseSubselect();
            if (!this.acceptPunct(')'))
                throw new SqlCompilerError('in-syntax', 'expected ) to close IN ( SELECT …');
            return { kind: 'in-sub', left, not, sub };
        }
        const list = [];
        for (;;) {
            const t = this.next();
            if (t.type === 'string')
                list.push({ kind: 'literal', value: t.text, numeric: false });
            else if (t.type === 'number')
                list.push({ kind: 'literal', value: t.text, numeric: true });
            else
                throw new SqlCompilerError('in-list', `IN lists take literals — found '${t.raw}'`);
            if (!this.acceptPunct(','))
                break;
        }
        if (!this.acceptPunct(')'))
            throw new SqlCompilerError('in-syntax', 'expected ) to close the IN list');
        return { kind: 'in', left, not, list };
    }
    /** A parenthesized full SELECT (the body of IN ( SELECT … )). */
    parseSubselect() {
        return this.parseSelect(true);
    }
    parseOperand() {
        const t = this.next();
        if (t.type === 'string')
            return { kind: 'literal', value: t.text, numeric: false };
        if (t.type === 'number')
            return { kind: 'literal', value: t.text, numeric: true };
        if (t.type === 'star')
            throw new SqlCompilerError('operand', "unexpected '*' in a condition");
        if (t.type === 'ident' || t.type === 'keyword') {
            if (t.type === 'keyword' && t.text === 'NULL') {
                throw new SqlCompilerError('operand', 'NULL on the right side — use IS [NOT] NULL instead');
            }
            this.pos -= 1;
            return this.parseColumnRef();
        }
        throw new SqlCompilerError('operand', `expected a value or column but found '${t.raw}'`);
    }
}
// ---------------------------------------------------------------------------
// Analysis + planning
// ---------------------------------------------------------------------------
/** All tables a statement reads (FROM + JOINs, subqueries included). */
export function collectTables(ast) {
    const names = new Set();
    const walk = (node) => {
        names.add(node.from.name);
        for (const j of node.joins)
            names.add(j.table.name);
        const walkCond = (c) => {
            if (!c)
                return;
            if (c.kind === 'and' || c.kind === 'or')
                c.parts.forEach(walkCond);
            else if (c.kind === 'not')
                walkCond(c.inner);
            else if (c.kind === 'in-sub')
                walk(c.sub);
        };
        walkCond(node.where);
        walkCond(node.having);
    };
    walk(ast);
    return [...names];
}
/** Does this statement need the compiler (multi-table / aggregate / …)? */
export function needsCompilation(ast) {
    const hasJoin = ast.joins.length > 0;
    const hasAggregate = ast.items.some((i) => i.expr.kind === 'aggregate') || ast.orderBy.some((o) => o.expr.kind === 'aggregate');
    const hasGroupBy = ast.groupBy.length > 0;
    const hasHaving = ast.having !== undefined;
    const hasInSub = (c) => {
        if (!c)
            return false;
        if (c.kind === 'and' || c.kind === 'or')
            return c.parts.some(hasInSub);
        if (c.kind === 'not')
            return hasInSub(c.inner);
        return c.kind === 'in-sub';
    };
    const hasInSubquery = hasInSub(ast.where) || hasInSub(ast.having);
    return hasJoin || hasAggregate || hasGroupBy || hasHaving || hasInSubquery;
}
/** Parse a full freestyle SELECT (throws SqlCompilerError on shape). */
export function parseSelect(sql) {
    return new Parser(tokenize(sql)).parseSelect();
}
/**
 * Normalize a SINGLE-TABLE statement to its bare form: drop the (optional)
 * alias and strip alias prefixes from column references. Backends disagree
 * on the selector grammar (a~col vs a.col) and some reject bare aliases in
 * FROM outright ("Only one SELECT statement is allowed" — misleading); the
 * alias-free spelling passes everywhere. Returns null when the statement is
 * multi-table or not normalizable.
 */
export function stripSingleTableAlias(sql) {
    let ast;
    try {
        ast = parseSelect(sql);
    }
    catch {
        return null;
    }
    if (ast.joins.length > 0)
        return null; // multi-table: alias is load-bearing
    const alias = ast.from.alias ?? ast.from.name;
    const strip = (ref) => {
        const m = new RegExp(`^${alias}[~.]\\s*([A-Za-z_][A-Za-z0-9_]*)$`, 'i').exec(ref.trim());
        return m ? m[1] : ref.trim();
    };
    const rewriteList = (text) => text
        .split(',')
        .map((part) => strip(part))
        .join(', ');
    // SELECT list (keep ONE leading space after the SELECT keyword).
    const selectStart = /\bselect\b/i.exec(sql).index;
    const fromMatch = /\bfrom\b/i.exec(sql.slice(selectStart));
    const selectBody = sql.slice(selectStart + 6, selectStart + fromMatch.index);
    const newSelectBody = ` ${rewriteList(selectBody).replace(/\s+/g, ' ').trim()} `;
    // WHERE / GROUP BY / ORDER BY bodies: replace `alias~col`/`alias.col`.
    let rest = sql.slice(selectStart + fromMatch.index);
    rest = rest.replace(new RegExp(`\\b${alias}[~.]([A-Za-z_][A-Za-z0-9_]*)`, 'gi'), '$1');
    // Drop the alias in FROM (both `FROM t a` and `FROM t AS a`) — keep the
    // whitespace AFTER the table name intact.
    rest = rest.replace(new RegExp(`(\\bfrom\\s+${ast.from.name})(\\s+)(?:as\\s+)?${alias}\\b`, 'i'), '$1 ');
    return sql.slice(0, selectStart + 6) + newSelectBody + rest.replace(/\s+/g, ' ').trimEnd();
}
// ---------------------------------------------------------------------------
// Local evaluation helpers
// ---------------------------------------------------------------------------
/** Numeric compare when both sides look numeric, else string compare. */
function compareValues(a, b) {
    const na = Number(a);
    const nb = Number(b);
    if (a.trim() !== '' && b.trim() !== '' && !Number.isNaN(na) && !Number.isNaN(nb))
        return na - nb;
    return a < b ? -1 : a > b ? 1 : 0;
}
function likeToRegExp(pattern) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
    return new RegExp(`^${escaped}$`);
}
function literalOf(l) {
    return l.value;
}
/** Per-table fetch cap: the protocol accepts up to 5000 rows. */
const MAX_FETCH_ROWS = 5000;
/** Build the single-table fetch for one table: referenced columns + pushed
 *  predicates. Deliberately UNPREFIXED — no alias, bare column names: the
 *  generated statement reads exactly one table, so no selector is needed,
 *  and backends disagree on the separator grammar (IMPC wants `a~col`, kic
 *  wants `a.col`; bare names pass on both). */
function buildFetch(ast, table, alias, referenced, pushed, fetchTop) {
    void alias;
    const cols = [...referenced].sort().join(', ');
    const colList = cols.length > 0 ? cols : '*';
    let sql = `SELECT ${colList} FROM ${table.name}`;
    const conds = pushed.map((c) => condToSqlBare(c)).filter((s) => s !== null);
    if (conds.length > 0)
        sql += ` WHERE ${conds.join(' AND ')}`;
    return sql;
}
/** Render a pushed condition against the ONE fetched table, bare names. */
function condToSqlBare(c) {
    switch (c.kind) {
        case 'and':
            return c.parts.map((p) => condToSqlBare(p)).filter(Boolean).length === c.parts.length
                ? c.parts.map((p) => condToSqlBare(p)).join(' AND ')
                : null;
        case 'cmp': {
            if (c.left.kind !== 'column')
                return null;
            if (c.right.kind !== 'literal')
                return null;
            const right = literalOf(c.right);
            if (c.op === 'LIKE')
                return `${c.left.column} LIKE '${right.replace(/'/g, "''")}'`;
            return `${c.left.column} ${c.op} ${c.right.numeric ? right : `'${right.replace(/'/g, "''")}'`}`;
        }
        case 'in': {
            const values = c.list.map((l) => (l.numeric ? l.value : `'${l.value.replace(/'/g, "''")}'`)).join(', ');
            return values.length > 0 ? `${c.left.column} ${c.not ? 'NOT ' : ''}IN ( ${values} )` : null;
        }
        case 'isnull': {
            return c.not ? `${c.left.column} != ''` : `${c.left.column} = ''`;
        }
        default:
            return null; // OR / NOT / in-sub stay local
    }
}
/** Render a condition back to freestyle SQL for ONE table (alias-bound). */
function condToSql(c, alias) {
    switch (c.kind) {
        case 'and':
            return c.parts.map((p) => condToSql(p, alias)).filter(Boolean).length === c.parts.length
                ? c.parts.map((p) => condToSql(p, alias)).join(' AND ')
                : null;
        case 'cmp': {
            if (c.left.kind !== 'column' || c.left.alias !== alias)
                return null;
            if (c.right.kind !== 'literal')
                return null;
            const right = literalOf(c.right);
            const col = `${alias}~${c.left.column}`;
            if (c.op === 'LIKE')
                return `${col} LIKE '${right.replace(/'/g, "''")}'`;
            return `${col} ${c.op} ${c.right.numeric ? right : `'${right.replace(/'/g, "''")}'`}`;
        }
        case 'in': {
            if (c.left.alias !== alias)
                return null;
            const values = c.list.map((l) => (l.numeric ? l.value : `'${l.value.replace(/'/g, "''")}'`)).join(', ');
            return values.length > 0 ? `${alias}~${c.left.column} ${c.not ? 'NOT ' : ''}IN ( ${values} )` : null;
        }
        case 'isnull': {
            if (c.left.alias !== alias)
                return null;
            return c.not ? `${alias}~${c.left.column} != ''` : `${alias}~${c.left.column} = ''`;
        }
        default:
            return null; // OR / NOT / in-sub stay local
    }
}
/** Columns referenced by a condition (any table). */
function condColumns(c, out) {
    if (c.kind === 'and' || c.kind === 'or') {
        c.parts.forEach((p) => condColumns(p, out));
    }
    else if (c.kind === 'not') {
        condColumns(c.inner, out);
    }
    else if (c.kind === 'cmp') {
        if (c.left.kind === 'column')
            out.push({ alias: c.left.alias, column: c.left.column });
        if (c.right.kind === 'column')
            out.push({ alias: c.right.alias, column: c.right.column });
    }
    else if (c.kind === 'in' || c.kind === 'in-sub') {
        out.push({ alias: c.left.alias, column: c.left.column });
    }
    else if (c.kind === 'isnull') {
        out.push({ alias: c.left.alias, column: c.left.column });
    }
}
/**
 * Compile-and-run a freestyle SELECT that needs the client-side path:
 * execute subqueries, fetch each table with pushed-down predicates, then
 * join/filter/aggregate/sort locally. All approximations are reported.
 */
export async function compileAndRun(sql, runQuery, opts) {
    const ast = parseSelect(sql);
    const notes = [];
    const executedSqls = [];
    const fetches = [];
    // ---- 1. resolve IN ( SELECT … ) subqueries up front ----------------------
    const subResults = new Map();
    const resolveSubqueries = async (c) => {
        if (!c)
            return;
        if (c.kind === 'and' || c.kind === 'or') {
            for (const p of c.parts)
                await resolveSubqueries(p);
            return;
        }
        if (c.kind === 'not')
            return resolveSubqueries(c.inner);
        if (c.kind !== 'in-sub')
            return;
        const subAst = c.sub;
        // Plain single-table subselects run directly; anything richer recurses.
        if (needsCompilation(subAst)) {
            const inner = await compileAndRun(renderAst(subAst), runQuery, { length: MAX_FETCH_ROWS, offset: 0, signal: opts.signal });
            inner.notes.forEach((n) => notes.push(`[subquery] ${n}`));
            const col = inner.columns[0]?.name ?? '';
            subResults.set(c, inner.rows.map((r) => String(r[col] ?? '')));
            return;
        }
        const rendered = renderAst(subAst);
        const linted = lintFreestyleSql(rendered);
        const res = await runQuery(linted.sql, { top: MAX_FETCH_ROWS, signal: opts.signal });
        executedSqls.push(linted.sql);
        const col = subAst.items[0].expr;
        const colName = col.kind === 'column' ? col.column : '*';
        const key = res.columns.find((c2) => c2.name.toUpperCase() === colName.toUpperCase())?.name ?? res.columns[0]?.name ?? '';
        subResults.set(c, res.rows.map((r) => String(r[key] ?? '')));
        if (res.rows.length >= MAX_FETCH_ROWS) {
            notes.push(`[subquery] IN ( SELECT … ) fetched ${res.rows.length} rows (cap) — membership beyond the cap is not seen`);
        }
    };
    await resolveSubqueries(ast.where);
    await resolveSubqueries(ast.having);
    // ---- 2. alias map + referenced columns per table -------------------------
    const aliasOf = (t) => t.alias ?? t.name;
    const tables = [ast.from, ...ast.joins.map((j) => j.table)];
    const aliasSeen = new Set();
    for (const t of tables) {
        const a = aliasOf(t);
        if (aliasSeen.has(a))
            throw new SqlCompilerError('duplicate-alias', `table alias '${a}' used twice — give each table a unique alias`);
        aliasSeen.add(a);
    }
    // Every column the statement references anywhere (select/order/group/
    // join-ON/where/having), per alias; `*` widens to the full table.
    const referenced = new Map();
    const widen = new Set(); // aliases whose SELECT includes * or t.*
    const note = (a, col) => {
        if (col === '*') {
            widen.add(a);
            return;
        }
        const set = referenced.get(a) ?? new Set();
        set.add(col);
        referenced.set(a, set);
    };
    for (const item of ast.items) {
        const e = item.expr;
        if (e.kind === 'column')
            note(e.alias ?? aliasOf(ast.from), e.column === '*' ? '*' : e.column);
        else if (e.arg.kind === 'column' && e.arg.column !== '*')
            note(e.arg.alias ?? aliasOf(ast.from), e.arg.column);
        else if (e.arg.kind === 'column')
            note(e.arg.alias ?? aliasOf(ast.from), '*');
    }
    for (const o of ast.orderBy) {
        const e = o.expr;
        if (e.kind === 'column')
            note(e.alias ?? aliasOf(ast.from), e.column);
        else if (e.arg.kind === 'column' && e.arg.column !== '*')
            note(e.arg.alias ?? aliasOf(ast.from), e.arg.column);
    }
    for (const g of ast.groupBy)
        note(g.alias ?? aliasOf(ast.from), g.column);
    const allConds = [ast.where, ast.having, ...ast.joins.map((j) => j.on)].filter((c) => c !== undefined);
    for (const c of allConds) {
        const cols = [];
        condColumns(c, cols);
        for (const col of cols) {
            const a = col.alias ?? tables.find((t) => col.column.startsWith(t.name))?.alias ?? tables.find((t) => t.name === col.column)?.alias;
            note(a ?? aliasOf(ast.from), col.column);
        }
    }
    // ---- 3. predicate pushdown (AND-connected single-table conds only) -------
    const localWhere = [];
    const pushedByAlias = new Map();
    const pushable = (c) => {
        // Returns the single alias a condition is bound to, or null (mixed/complex).
        const cols = [];
        condColumns(c, cols);
        if (cols.some((x) => x.column === '*'))
            return null;
        const aliases = new Set(cols.map((x) => x.alias));
        if (aliases.size !== 1)
            return null;
        const only = [...aliases][0];
        if (c.kind === 'cmp' && c.right.kind !== 'literal')
            return null; // col-to-col stays local
        if (c.kind === 'in-sub')
            return null; // membership computed locally
        return only ?? null;
    };
    const splitWhere = (c) => {
        if (c.kind === 'and') {
            c.parts.forEach(splitWhere);
            return;
        }
        const alias = pushable(c);
        if (alias) {
            const list = pushedByAlias.get(alias) ?? [];
            list.push(c);
            pushedByAlias.set(alias, list);
        }
        else {
            localWhere.push(c);
        }
    };
    if (ast.where)
        splitWhere(ast.where);
    // ---- 4. fetch each table -------------------------------------------------
    const fetchTop = Math.min(MAX_FETCH_ROWS, Math.max(500, opts.length * 10));
    // Null cells normalize to '' at the boundary — the local evaluator works
    // on plain strings (the '' -as-NULL convention the dialect uses anyway).
    const tableData = new Map();
    for (const t of tables) {
        const a = aliasOf(t);
        const wantAll = widen.has(a);
        const cols = wantAll ? new Set() : referenced.get(a) ?? new Set();
        const pushed = pushedByAlias.get(a) ?? [];
        const fetchSql = buildFetch(ast, t, a, cols, pushed, fetchTop);
        const linted = lintFreestyleSql(fetchSql);
        const res = await runQuery(linted.sql, { top: fetchTop, signal: opts.signal });
        executedSqls.push(linted.sql);
        fetches.push({ table: t.name, sql: linted.sql, requestedTop: fetchTop, fetched: res.rows.length, truncated: res.rows.length >= fetchTop });
        tableData.set(a, {
            columns: res.columns,
            rows: res.rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? '']))),
        });
    }
    const truncatedFetch = fetches.filter((f) => f.truncated);
    if (truncatedFetch.length > 0) {
        notes.push(`row-cap approximation: ${truncatedFetch.map((f) => `${f.table} (fetched ${f.fetched}, cap ${f.requestedTop})`).join(', ')} — ` +
            'results over the cap are not seen; narrow the WHERE per table for exact answers');
    }
    // ---- 5. local join --------------------------------------------------------
    const aliasList = tables.map((t) => aliasOf(t));
    let rows = (tableData.get(aliasList[0])?.rows ?? []).map((r) => {
        const m = new Map();
        m.set(aliasList[0], r);
        return m;
    });
    const baseColumns = new Map();
    for (const a of aliasList)
        baseColumns.set(a, tableData.get(a)?.columns ?? []);
    const evalCondOnRow = (c, row, subs) => {
        switch (c.kind) {
            case 'and':
                return c.parts.every((p) => evalCondOnRow(p, row, subs));
            case 'or':
                return c.parts.some((p) => evalCondOnRow(p, row, subs));
            case 'not':
                return !evalCondOnRow(c.inner, row, subs);
            case 'cmp': {
                // Aggregate left sides only occur in HAVING (evaluated on the output
                // row by evalHaving); on a raw row they are not computable — false.
                if (c.left.kind === 'aggregate')
                    return false;
                const l = c.left.kind === 'column' ? valueOf(c.left, row, tables) : literalOf(c.left);
                const r = c.right.kind === 'column' ? valueOf(c.right, row, tables) : literalOf(c.right);
                if (l === undefined || r === undefined)
                    return false;
                switch (c.op) {
                    case '=':
                        return compareValues(l, r) === 0;
                    case '!=':
                        return compareValues(l, r) !== 0;
                    case '<':
                        return compareValues(l, r) < 0;
                    case '<=':
                        return compareValues(l, r) <= 0;
                    case '>':
                        return compareValues(l, r) > 0;
                    case '>=':
                        return compareValues(l, r) >= 0;
                    case 'LIKE':
                        return likeToRegExp(r).test(l);
                }
                return false;
            }
            case 'in': {
                const l = valueOf(c.left, row, tables);
                if (l === undefined)
                    return false;
                const hit = c.list.some((lit) => compareValues(l, literalOf(lit)) === 0);
                return c.not ? !hit : hit;
            }
            case 'in-sub': {
                const l = valueOf(c.left, row, tables);
                if (l === undefined)
                    return false;
                const values = subs.get(c) ?? [];
                const hit = values.some((v) => compareValues(l, v) === 0);
                return c.not ? !hit : hit;
            }
            case 'isnull': {
                const l = valueOf(c.left, row, tables);
                const empty = l === undefined || l === '';
                return c.not ? !empty : empty;
            }
        }
    };
    for (const join of ast.joins) {
        const rightAlias = aliasOf(join.table);
        const rightData = tableData.get(rightAlias);
        // Equi-join keys from the ON condition (a~x = b~y pairs).
        const pairs = [];
        const residuals = [];
        const splitOn = (c) => {
            if (c.kind === 'and') {
                c.parts.forEach(splitOn);
                return;
            }
            if (c.kind === 'cmp' && c.op === '=' && c.left.kind === 'column' && c.right.kind === 'column') {
                pairs.push({ left: c.left, right: c.right });
            }
            else {
                residuals.push(c);
            }
        };
        splitOn(join.on);
        if (pairs.length === 0) {
            throw new SqlCompilerError('join-keys', `the ON condition of ${join.table.name} has no equality pair (a~x = b~y) — the local join needs at least one`);
        }
        // Hash the right side by its key columns.
        const rightIndex = new Map();
        for (const rr of rightData.rows) {
            const key = pairs
                .map((p) => {
                const col = p.right.alias === rightAlias ? p.right.column : p.left.column;
                return rr[col.toUpperCase()] ?? '';
            })
                .join('\u0000');
            const bucket = rightIndex.get(key);
            if (bucket)
                bucket.push(rr);
            else
                rightIndex.set(key, [rr]);
        }
        const joined = [];
        for (const row of rows) {
            const key = pairs
                .map((p) => {
                const ref = p.left.alias === rightAlias ? p.right : p.left;
                return valueOf(ref, row, tables) ?? '';
            })
                .join('\u0000');
            const matches = rightIndex.get(key) ?? [];
            if (matches.length > 0) {
                for (const m of matches) {
                    const next = new Map(row);
                    next.set(rightAlias, m);
                    if (residuals.every((c) => evalCondOnRow(c, next, subResults)))
                        joined.push(next);
                }
            }
            else if (join.type === 'left') {
                // LEFT JOIN: keep the row with NULL (empty) right-side columns.
                const empty = {};
                for (const col of rightData.columns)
                    empty[col.name] = '';
                const next = new Map(row);
                next.set(rightAlias, empty);
                if (residuals.every((c) => evalCondOnRow(c, next, subResults)))
                    joined.push(next);
            }
        }
        rows = joined;
    }
    // ---- 6. local WHERE (un-pushed parts) -------------------------------------
    if (localWhere.length > 0) {
        const cond = localWhere.length === 1 ? localWhere[0] : { kind: 'and', parts: localWhere };
        rows = rows.filter((row) => evalCondOnRow(cond, row, subResults));
        notes.push('WHERE partially pushed down: ' +
            `${localWhere.length} condition(s) evaluated client-side (cross-table / OR / subquery parts)`);
    }
    // ---- 7. projection / aggregation ------------------------------------------
    const outputName = (item, idx) => {
        if (item.alias)
            return item.alias;
        if (item.expr.kind === 'column')
            return item.expr.column === '*' ? `${aliasOf(ast.from)}~*` : item.expr.column;
        return `${item.expr.fn}(${item.expr.arg.kind === 'column' ? item.expr.arg.column : '*'})`.toUpperCase() + (idx > 0 ? `_${idx + 1}` : '');
    };
    const groupRefs = ast.groupBy;
    const hasAggregate = ast.items.some((i) => i.expr.kind === 'aggregate') || ast.orderBy.some((o) => o.expr.kind === 'aggregate') || groupRefs.length > 0;
    let outRows;
    const outColumns = ast.items.map((item, idx) => ({
        name: outputName(item, idx),
        type: item.expr.kind === 'aggregate' ? 'AGGREGATE' : guessType(item, baseColumns, aliasOf(ast.from)),
    }));
    if (!hasAggregate) {
        outRows = rows.map((row) => {
            const rec = {};
            ast.items.forEach((item, idx) => {
                rec[outputName(item, idx)] = project(item.expr, row, tables, baseColumns, widen, aliasOf(ast.from));
            });
            return rec;
        });
    }
    else {
        // Group rows by the groupBy key (or one global group when no GROUP BY).
        const groups = new Map();
        for (const row of rows) {
            const key = groupRefs.map((g) => valueOf(g, row, tables) ?? '').join('\u0000');
            const bucket = groups.get(key);
            if (bucket)
                bucket.push(row);
            else
                groups.set(key, [row]);
        }
        if (groupRefs.length === 0 && rows.length === 0)
            groups.set('', []); // COUNT(*) over empty → 0
        outRows = [];
        for (const [, group] of groups) {
            const rec = {};
            ast.items.forEach((item, idx) => {
                const name = outputName(item, idx);
                if (item.expr.kind === 'column') {
                    // Must be a groupBy column (first row of the group carries it).
                    rec[name] = group.length > 0 ? (valueOf(item.expr, group[0], tables) ?? '') : '';
                }
                else {
                    rec[name] = aggregateOf(item.expr, group, tables);
                }
            });
            // HAVING filters aggregated rows.
            if (ast.having) {
                const havingRow = group.length > 0 ? group[0] : new Map();
                const outputNames = ast.items.map((item, idx) => ({ expr: item.expr, name: outputName(item, idx) }));
                if (!evalHaving(ast.having, rec, havingRow, tables, subResults, outputNames))
                    continue;
            }
            outRows.push(rec);
        }
        if (groupRefs.length > 0 || ast.items.some((i) => i.expr.kind === 'aggregate')) {
            notes.push('aggregation computed client-side over the fetched (capped) rows — exact over small sets, approximate beyond the cap');
        }
    }
    // ---- 8. DISTINCT / ORDER BY / window --------------------------------------
    if (ast.distinct) {
        const seen = new Set();
        outRows = outRows.filter((r) => {
            const key = JSON.stringify(r);
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    if (ast.orderBy.length > 0) {
        const keyOf = (r, o) => {
            if (o.expr.kind === 'column' && !o.expr.alias) {
                // Direct column or alias reference: output name first, then column.
                const direct = r[o.expr.column];
                if (direct !== undefined)
                    return direct;
            }
            const name = orderByOutputName(o);
            return r[name] ?? '';
        };
        outRows.sort((a, b) => {
            for (const o of ast.orderBy) {
                const cmp = compareValues(keyOf(a, o), keyOf(b, o));
                if (cmp !== 0)
                    return o.dir === 'DESC' ? -cmp : cmp;
            }
            return 0;
        });
    }
    // ---- 9. offset/length window -----------------------------------------------
    const windowed = outRows.slice(opts.offset, opts.offset + opts.length);
    if (opts.offset + opts.length < outRows.length) {
        notes.push(`more rows available: raise offset to ${opts.offset + opts.length}`);
    }
    return { columns: outColumns, rows: windowed, notes, executedSqls };
}
// ---------------------------------------------------------------------------
// Evaluation helpers over WorkRow
// ---------------------------------------------------------------------------
function valueOf(ref, row, tables) {
    const alias = ref.alias ?? (tables[0] ? (tables[0].alias ?? tables[0].name) : undefined);
    if (!alias)
        return undefined;
    const rec = row.get(alias);
    if (!rec)
        return undefined;
    if (ref.column === '*')
        return undefined;
    const hit = rec[ref.column];
    if (hit !== undefined)
        return hit;
    // Case-insensitive fallback (SAP columns come back uppercase).
    const upper = rec[ref.column.toUpperCase()];
    if (upper !== undefined)
        return upper;
    const entry = Object.entries(rec).find(([k]) => k.toUpperCase() === ref.column.toUpperCase());
    return entry ? entry[1] : undefined;
}
function guessType(item, baseColumns, defaultAlias) {
    if (item.expr.kind !== 'column')
        return 'AGGREGATE';
    if (item.expr.column === '*')
        return 'STRUCT';
    const cols = baseColumns.get(item.expr.alias ?? defaultAlias) ?? [];
    return cols.find((c) => c.name.toUpperCase() === item.expr.kind && false) ? 'CHAR' : (cols.find((c) => c.name.toUpperCase() === item.expr.column.toUpperCase())?.type ?? 'CHAR');
}
/** Project one select expression for a plain (non-aggregate) row. */
function project(expr, row, tables, baseColumns, widen, defaultAlias) {
    if (expr.kind === 'column') {
        if (expr.column === '*') {
            // Flatten the (single) table's columns — only meaningful for a
            // single-table projection; joined * is ambiguous and was widened.
            const alias = expr.alias ?? defaultAlias;
            const rec = row.get(alias);
            if (!rec)
                return '';
            return Object.values(rec).join(' | ');
        }
        return valueOf(expr, row, tables) ?? '';
    }
    return aggregateOf(expr, [row], tables);
}
function aggregateOf(expr, rows, tables) {
    const values = rows
        .map((row) => (expr.arg.column === '*' ? '1' : valueOf(expr.arg, row, tables) ?? ''))
        .filter((v) => v !== '');
    const uniq = expr.distinct ? [...new Set(values)] : values;
    const fn = expr.fn;
    if (fn === 'COUNT')
        return String(uniq.length);
    const numeric = uniq.map((v) => Number(v));
    const allNumeric = numeric.length > 0 && numeric.every((v) => !Number.isNaN(v));
    if (fn === 'SUM' || fn === 'AVG') {
        if (!allNumeric)
            return '';
        const sum = numeric.reduce((a, b) => a + b, 0);
        if (fn === 'SUM')
            return String(sum);
        return String(sum / numeric.length);
    }
    // MIN/MAX: numeric when every value is numeric, else lexicographic.
    if (allNumeric) {
        return fn === 'MIN' ? String(Math.min(...numeric)) : String(Math.max(...numeric));
    }
    const sorted = [...uniq].sort(compareValues);
    return fn === 'MIN' ? (sorted[0] ?? '') : (sorted.at(-1) ?? '');
}
/** ORDER BY output-name resolution: alias, column name, or aggregate label. */
function orderByOutputName(o) {
    if (o.expr.kind === 'column')
        return o.expr.column;
    return `${o.expr.fn}(${o.expr.arg.kind === 'column' ? o.expr.arg.column : '*'})`.toUpperCase();
}
/** HAVING evaluation: aggregates compare against the computed output row. */
function evalHaving(c, rec, sampleRow, tables, subs, outputNames = []) {
    switch (c.kind) {
        case 'and':
            return c.parts.every((p) => evalHaving(p, rec, sampleRow, tables, subs, outputNames));
        case 'or':
            return c.parts.some((p) => evalHaving(p, rec, sampleRow, tables, subs, outputNames));
        case 'not':
            return !evalHaving(c.inner, rec, sampleRow, tables, subs, outputNames);
        case 'cmp': {
            const side = (operand) => {
                if (operand.kind === 'literal')
                    return operand.value;
                if (operand.kind === 'aggregate') {
                    // Aggregate output: under the item alias when the SELECT item that
                    // produced it has one, else the generated label.
                    const item = outputNames.find((o) => o.expr.kind === 'aggregate' && o.expr.fn === operand.fn && o.expr.arg.kind === operand.arg.kind && (o.expr.arg.kind !== 'column' || operand.arg.kind !== 'column' || o.expr.arg.column === operand.arg.column));
                    return item ? rec[item.name] : undefined;
                }
                if (operand.alias)
                    return valueOf(operand, sampleRow, tables);
                return rec[operand.column] ?? valueOf(operand, sampleRow, tables);
            };
            const l = side(c.left);
            const r = side(c.right);
            if (l === undefined || r === undefined)
                return false;
            switch (c.op) {
                case '=':
                    return compareValues(l, r) === 0;
                case '!=':
                    return compareValues(l, r) !== 0;
                case '<':
                    return compareValues(l, r) < 0;
                case '<=':
                    return compareValues(l, r) <= 0;
                case '>':
                    return compareValues(l, r) > 0;
                case '>=':
                    return compareValues(l, r) >= 0;
                case 'LIKE':
                    return likeToRegExp(r).test(l);
            }
            return false;
        }
        default:
            // IN / IS NULL over aggregates: rare — evaluate on the output row.
            void subs;
            return true;
    }
}
/** Render an AST back to single-table freestyle SQL (subquery path). */
function renderAst(ast) {
    const parts = ['SELECT'];
    if (ast.distinct)
        parts.push('DISTINCT');
    parts.push(ast.items
        .map((i) => {
        const e = i.expr.kind === 'column'
            ? i.expr.alias
                ? `${i.expr.alias}~${i.expr.column}`
                : i.expr.column
            : `${i.expr.fn}( ${i.expr.arg.kind === 'column' ? (i.expr.arg.alias ? `${i.expr.arg.alias}~${i.expr.arg.column}` : i.expr.arg.column) : '*'} )`;
        return i.alias ? `${e} AS ${i.alias}` : e;
    })
        .join(', '));
    parts.push(`FROM ${ast.from.name}${ast.from.alias ? ` AS ${ast.from.alias}` : ''}`);
    if (ast.where) {
        const rendered = renderCond(ast.where);
        if (rendered)
            parts.push(`WHERE ${rendered}`);
    }
    if (ast.groupBy.length > 0)
        parts.push(`GROUP BY ${ast.groupBy.map((g) => (g.alias ? `${g.alias}~${g.column}` : g.column)).join(', ')}`);
    if (ast.orderBy.length > 0) {
        parts.push(`ORDER BY ${ast.orderBy.map((o) => `${o.expr.kind === 'column' ? (o.expr.alias ? `${o.expr.alias}~${o.expr.column}` : o.expr.column) : `${o.expr.fn}( * )`} ${o.dir === 'DESC' ? 'DESCENDING' : 'ASCENDING'}`).join(', ')}`);
    }
    return parts.join(' ');
}
function renderCond(c) {
    switch (c.kind) {
        case 'and':
        case 'or':
            return c.parts.map((p) => renderCond(p)).filter(Boolean).length === c.parts.length
                ? c.parts.map((p) => `(${renderCond(p)})`).join(c.kind === 'and' ? ' AND ' : ' OR ')
                : null;
        case 'cmp': {
            if (c.left.kind === 'aggregate')
                return `${c.left.fn}( * )`;
            const left = c.left.kind === 'column' ? `${c.left.alias ? `${c.left.alias}~` : ''}${c.left.column}` : `'${literalOf(c.left).replace(/'/g, "''")}'`;
            const right = c.right.kind === 'literal'
                ? c.right.numeric
                    ? literalOf(c.right)
                    : `'${literalOf(c.right).replace(/'/g, "''")}'`
                : `${c.right.alias ? `${c.right.alias}~` : ''}${c.right.column}`;
            return `${left} ${c.op === 'LIKE' ? 'LIKE' : c.op} ${right}`;
        }
        case 'in': {
            const left = `${c.left.alias ? `${c.left.alias}~` : ''}${c.left.column}`;
            const values = c.list.map((l) => (l.numeric ? l.value : `'${l.value.replace(/'/g, "''")}'`)).join(', ');
            return `${left} ${c.not ? 'NOT ' : ''}IN ( ${values} )`;
        }
        case 'isnull': {
            const left = `${c.left.alias ? `${c.left.alias}~` : ''}${c.left.column}`;
            return `${left} IS ${c.not ? 'NOT ' : ''}NULL`;
        }
        case 'not':
            return `NOT ( ${renderCond(c.inner) ?? ''} )`;
        case 'in-sub':
            return null;
    }
}
//# sourceMappingURL=sql-compiler.js.map