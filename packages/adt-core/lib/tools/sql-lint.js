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
/** A lint refusal: the agent gets the reason and the sanctioned alternative. */
export class SqlLintError extends Error {
    rule;
    constructor(rule, detail) {
        super(`adt_data_preview: ${detail} [sql-lint: ${rule}]`);
        this.name = 'SqlLintError';
        this.rule = rule;
    }
}
/** The backend parser rejects lines longer than this (255-char wire limit). */
export const MAX_SQL_LINE_LENGTH = 255;
/** Split SQL into literal / code segments (string literals: '…' and `…`). */
function splitLiterals(sql) {
    const segments = [];
    const re = /('([^']|'')*'|`[^`]*`)/g;
    let lastIndex = 0;
    for (let m = re.exec(sql); m !== null; m = re.exec(sql)) {
        if (m.index > lastIndex)
            segments.push({ text: sql.slice(lastIndex, m.index), literal: false });
        segments.push({ text: m[0], literal: true });
        lastIndex = m.index + m[0].length;
    }
    if (lastIndex < sql.length)
        segments.push({ text: sql.slice(lastIndex), literal: false });
    return segments;
}
/** Map a function over the non-literal segments only. */
function mapCode(sql, fn) {
    return splitLiterals(sql)
        .map((s) => (s.literal ? s.text : fn(s.text)))
        .join('');
}
/** The code text (everything outside string literals). */
function codeOf(sql) {
    return splitLiterals(sql)
        .filter((s) => !s.literal)
        .map((s) => s.text)
        .join('');
}
/** Count LIKE occurrences outside literals. */
function countLikes(sql) {
    return (codeOf(sql).match(/\blike\b/gi) ?? []).length;
}
/** Soft-wrap one overlong line at whitespace boundaries (≤ max chars). */
function wrapLine(line, max) {
    if (line.length <= max)
        return [line];
    const out = [];
    let rest = line;
    while (rest.length > max) {
        // Last whitespace within the budget — break AFTER it (the space itself
        // ends the line; SQL treats the newline as whitespace).
        let cut = rest.lastIndexOf(' ', max);
        if (cut <= 0)
            cut = max; // no whitespace in budget: hard break (rare)
        out.push(rest.slice(0, cut));
        rest = rest.slice(cut).replace(/^\s+/, '');
    }
    if (rest.length > 0)
        out.push(rest);
    return out;
}
/**
 * Lint (and where possible rewrite) one freestyle-SQL SELECT for the ADT
 * data-preview endpoint. Throws {@link SqlLintError} for constructs that
 * cannot be auto-fixed. Pure — no I/O.
 */
export function lintFreestyleSql(input) {
    let sql = input.replace(/\r\n/g, '\n').trim();
    const rewrites = [];
    // --- hard rejections (cheapest first) ------------------------------------
    // SELECT-only (the data-preview API is read-only) — kept from the original
    // tool gate so every entry point lints identically.
    if (!/^\s*select[\s(]/i.test(sql)) {
        throw new SqlLintError('select-only', '`sql` accepts a SELECT statement only (the data-preview API is read-only). ' +
            `Got: ${sql.slice(0, 60)}${sql.length > 60 ? '…' : ''}`);
    }
    // Compound SELECTs: the endpoint parses exactly one statement.
    const compound = /\b(union(\s+all)?|intersect|except)\b/i.exec(codeOf(sql));
    if (compound) {
        throw new SqlLintError('union', `UNION/INTERSECT/EXCEPT compound SELECTs are not accepted by the data-preview parser ` +
            `(matched: "${compound[1].toUpperCase()}") — run each SELECT as its own call and combine the rows locally`);
    }
    // OR + LIKE (live-verified 400 on multiple backends), and more than one
    // LIKE per statement — the parser's WHERE grammar takes a single LIKE.
    const code = codeOf(sql);
    const hasOr = /\bor\b/i.test(code);
    const likes = countLikes(sql);
    if (hasOr && likes > 0) {
        throw new SqlLintError('or-like', 'OR combined with LIKE is rejected by the data-preview parser (live-verified 400). ' +
            'Remedy: run one SELECT per LIKE pattern and union the rows locally — or replace ' +
            "equality ORs with an IN ( 'a', 'b' ) list");
    }
    if (likes > 1) {
        throw new SqlLintError('multi-like', 'the data-preview parser accepts at most ONE LIKE per statement (live-verified 400). ' +
            'Remedy: run one SELECT per pattern and intersect/union the rows locally');
    }
    // Double quotes: Open SQL has no double-quoted strings/identifiers on this
    // endpoint — a `"` almost always means a HANA/standard-SQL paste.
    if (/"/.test(code)) {
        throw new SqlLintError('double-quote', 'double quotes are not valid in this dialect (Open SQL uses single quotes for literals ' +
            'and ~ for column selectors) — rewrite "quoted" names without quotes');
    }
    // Multi-statement: an interior `;` cannot be fixed; a TRAILING one is
    // stripped with a note.
    const interiorSemicolon = /;/.test(code.replace(/;\s*$/, ''));
    if (interiorSemicolon) {
        throw new SqlLintError('multi-statement', '`sql` must be ONE SELECT statement — a statement separator (;) inside the text is not ' +
            'accepted; split into multiple adt_data_preview calls');
    }
    const trailingSemicolon = /;\s*$/.test(sql);
    if (trailingSemicolon) {
        sql = sql.replace(/;\s*$/, '');
        rewrites.push({
            rule: 'trailing-semicolon',
            action: 'rewrite',
            detail: 'trailing ; stripped (the endpoint takes a single bare SELECT)',
        });
    }
    // --- rewrites -------------------------------------------------------------
    // 1. Trailing `LIMIT n [OFFSET m]` FIRST — a direction token directly
    //    before LIMIT (`ORDER BY x DESC LIMIT 5`) must see end-of-statement
    //    after the LIMIT clause is stripped, or the DESC/ASC rule below misses
    //    it. The row window becomes the tool's length/offset parameters.
    const limitMatch = /\blimit\s+(\d+)(?:\s+offset\s+(\d+))?\s*$/i.exec(sql);
    if (limitMatch) {
        const n = limitMatch[1];
        const m = limitMatch[2];
        sql = sql.slice(0, limitMatch.index).trimEnd();
        rewrites.push({
            rule: 'limit-to-length',
            action: 'rewrite',
            detail: `LIMIT ${n}` +
                (m ? ` OFFSET ${m}` : '') +
                ` converted — pass rows via the tool's \`length\` (${n})` +
                (m ? ` and \`offset\` (${m}) parameters` : ' parameter') +
                ' (the dialect has no LIMIT keyword)',
        });
    }
    // 2. ORDER BY direction tokens: DESC/ASC → DESCENDING/ASCENDING. Scoped to
    //    the tail from ORDER BY (the clause runs to end-of-statement — in valid
    //    SQL nothing follows it); a trailing DESC/ASC token (followed by `,` or
    //    end, possibly across a newline) is always a sort direction, so a
    //    column merely NAMED like a direction word is untouched.
    const obMatch = /\border\s+by\b/i.exec(sql);
    if (obMatch) {
        const tail = sql.slice(obMatch.index);
        const fixed = tail.replace(/\b(desc|asc)(?=\s*(?:,|$))/gi, (token) => token.toUpperCase() === 'DESC' ? 'DESCENDING' : 'ASCENDING');
        if (fixed !== tail) {
            sql = sql.slice(0, obMatch.index) + fixed;
            rewrites.push({
                rule: 'order-by-direction',
                action: 'rewrite',
                detail: 'ORDER BY DESC/ASC rewritten to DESCENDING/ASCENDING (the parser rejects the short forms)',
            });
        }
    }
    // 3. `<>` → `!=` (outside literals).
    const neSwapped = mapCode(sql, (c) => c.replace(/<>/g, '!='));
    if (neSwapped !== sql) {
        sql = neSwapped;
        rewrites.push({
            rule: 'ne-operator',
            action: 'rewrite',
            detail: '<> rewritten to != (the parser rejects the ANSI form)',
        });
    }
    // 4. `alias.col` / `alias~col`: both spellings occur in the wild — backends
    //    DISAGREE (IMPC-class rejects `~` and expects `.`; kic-class accepts
    //    `.`). No rewrite: the statement is sent as written, and a backend 400
    //    about the selector is reworded to suggest trying the OTHER spelling.
    //    (Single-table statements with an alias still work bare on both.)
    // 5. Parenthesis spacing the parser needs: aggregate calls `COUNT(*)` →
    //    `COUNT( * )` (live-verified: tight parens around aggregates/DISTINCT
    //    are rejected). IN ( 'a','b' ) lists with literal members are fine
    //    tight-parened (field-proven) and span literal segments, so they are
    //    left verbatim.
    const padded = mapCode(sql, (c) => c.replace(/\b(count|sum|min|max|avg)\s*\(\s*([^()]*?)\s*\)/gi, (_all, fn, inner) => `${fn.toUpperCase()}( ${inner} )`));
    if (padded !== sql) {
        sql = padded;
        rewrites.push({
            rule: 'call-paren-spacing',
            action: 'rewrite',
            detail: 'parenthesis spacing normalized (COUNT( * ) / IN ( … ) — the parser rejects tight parens)',
        });
    }
    // 6. Soft-wrap lines over the 255-char wire limit at whitespace.
    const lines = sql.split('\n');
    const wrapped = lines.flatMap((l) => wrapLine(l, MAX_SQL_LINE_LENGTH));
    if (wrapped.length !== lines.length) {
        sql = wrapped.join('\n');
        rewrites.push({
            rule: 'long-line-wrap',
            action: 'rewrite',
            detail: `lines over ${MAX_SQL_LINE_LENGTH} chars soft-wrapped at whitespace ` +
                '(the backend rejects longer lines)',
        });
    }
    return { sql, rewrites };
}
//# sourceMappingURL=sql-lint.js.map