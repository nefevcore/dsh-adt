/**
 * Pure ABAP syntax helpers shared by the agent-facing tool features:
 * method-block location (method-level read/edit) and dependency extraction
 * (context prologue). No I/O — fully unit-testable without a backend.
 *
 * The design borrows from vsp's `pkg/ctxcomp`: a reader of one ABAP object
 * needs, in order — obligations (superclass, interfaces), then signature
 * types, then frequent collaborators, then exception classes — the PUBLIC
 * CONTRACT of each dependency, not their implementations.
 */
/** Strip ABAP comments from one line: `*` at line start is a full-line
 *  comment; `"` starts a tail comment unless inside a single-quoted literal
 *  ('' is an escaped quote inside literals). Same semantics as write.ts. */
export function stripAbapComment(line) {
    if (line.trimStart().startsWith('*'))
        return '';
    let inString = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === "'")
            inString = !inString;
        else if (ch === '"' && !inString)
            return line.slice(0, i);
    }
    return line;
}
/** Blank string literals (single-quoted and |templates|) so tokens inside
 *  them can never look like structure keywords. Keeps quotes as ''. */
function blankStrings(line) {
    return line.replace(/'(?:[^']|'')*'/g, "''").replace(/\|(?:[^|\\]|\\.)*\|/g, '');
}
const METHOD_OPENER = (name) => new RegExp(`^\\s*METHOD\\s+${name}\\s*\\.`, 'i');
const METHOD_TOKEN = /\bMETHOD\b/g;
const METHOD_END_TOKEN = /\bENDMETHOD\b/g;
/**
 * Find every `METHOD <name>.` … `ENDMETHOD.` block in the source. Method
 * blocks cannot nest in ABAP, but the count is depth-tracked anyway so a
 * (syntax-error) nesting never yields a wrong span. `METHODS`/`CLASS-METHODS`
 * declarations never match (word boundary after METHOD). Returns [] when the
 * method does not exist in this source.
 */
export function findMethodBlocks(source, methodName) {
    const lines = source.split(/\r\n|\n/);
    const opener = METHOD_OPENER(methodName.replace(/[^A-Za-z0-9_\/]/g, ''));
    const blocks = [];
    let depth = 0;
    let startIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        const clean = blankStrings(stripAbapComment(lines[i] ?? '')).replace(/\bCALL\s+METHOD\b/gi, '');
        const opened = (clean.match(METHOD_TOKEN) ?? []).length;
        const closed = (clean.match(METHOD_END_TOKEN) ?? []).length;
        if (depth === 0 && opener.test(lines[i] ?? '')) {
            // An opener line may also carry its own ENDMETHOD (one-liner).
            startIdx = i;
            depth = opened - closed;
            if (depth <= 0) {
                blocks.push({ startIdx: i, endIdx: i });
                depth = 0;
            }
            continue;
        }
        if (startIdx >= 0) {
            depth += opened - closed;
            if (depth <= 0) {
                blocks.push({ startIdx, endIdx: i });
                startIdx = -1;
                depth = 0;
            }
        }
    }
    return blocks;
}
/** Statement-level roles — vsp ordering: obligations first (superclass,
 *  interfaces), then signature types, then collaborators by usage, then
 *  exceptions. */
const ROLE_WEIGHT = {
    super: 100,
    interface: 95,
    signature: 60,
    collaborator: 40,
    exception: 20,
};
const PATTERNS = [
    { re: /\bINHERITING\s+FROM\s+([A-Za-z0-9_\/]+)/gi, role: 'super' },
    { re: /\bINTERFACES\s+([A-Za-z0-9_\/]+)/gi, role: 'interface' },
    { re: /\bRAISING\s+([A-Za-z0-9_\/\s,]+)/gi, role: 'exception' },
    { re: /\bTYPE\s+REF\s+TO\s+([A-Za-z0-9_\/]+)/gi, role: 'signature' },
    { re: /\bNEW\s+([A-Za-z0-9_\/]+)\s*\(/gi, role: 'collaborator' },
    { re: /\bCAST\s+([A-Za-z0-9_\/]+)\s*\(/gi, role: 'signature' },
    { re: /\bCALL\s+FUNCTION\s+'([A-Za-z0-9_]+)'/gi, role: 'collaborator', function: true },
    { re: /\b([A-Za-z0-9_]+)\s*=>/g, role: 'collaborator' },
];
// Locally-defined naming conventions: local classes/interfaces and local
// TYPES declarations — a context prologue is for GLOBAL dependencies the
// reader must go elsewhere for. Exception classes (CX_/LCX_) are NOT
// excluded: they are usually global and carry obligations.
const LOCAL_PREFIXES = /^(LCL_|LTCL_|LIF_|TY_)/;
/**
 * Extract dependency candidates from an ABAP source. Names defined by the
 * source itself (its own CLASS/INTERFACE DEFINITIONs — local test classes
 * included) and the object's own name are excluded: a context prologue is
 * for things the reader must go ELSEWHERE to understand.
 */
export function extractDependencyCandidates(source, selfName) {
    const lines = source.split(/\r\n|\n/);
    const definedHere = new Set([selfName.toUpperCase()]);
    const selfUpper = selfName.toUpperCase();
    for (const raw of lines) {
        const clean = blankStrings(stripAbapComment(raw));
        for (const m of clean.matchAll(/\bCLASS\s+([A-Za-z0-9_\/]+)\s+DEFINITION/gi)) {
            definedHere.add((m[1] ?? '').toUpperCase());
        }
        for (const m of clean.matchAll(/\bINTERFACE\s+([A-Za-z0-9_\/]+)/gi)) {
            definedHere.add((m[1] ?? '').toUpperCase());
        }
    }
    const byName = new Map();
    const add = (name, role, line, functionKind) => {
        const upper = name.toUpperCase().replace(/[\s,.]+$/, '');
        if (upper.length < 3)
            return; // noise guard
        if (definedHere.has(upper))
            return;
        if (!functionKind && LOCAL_PREFIXES.test(upper))
            return; // local naming conventions
        if (functionKind) {
            // keep function modules even when they share a prefix with locals
        }
        else if (!/^[A-Za-z][A-Za-z0-9_\/]*$/.test(upper))
            return;
        let cand = byName.get(upper);
        if (!cand) {
            cand = { name: upper, kind: functionKind ? 'function' : 'oo', roles: [], usageCount: 0, line };
            byName.set(upper, cand);
        }
        if (functionKind)
            cand.kind = 'function';
        if (!cand.roles.includes(role))
            cand.roles.push(role);
        cand.usageCount += 1;
    };
    for (let i = 0; i < lines.length; i++) {
        const withStrings = stripAbapComment(lines[i] ?? '');
        // Blank strings for every pattern except CALL FUNCTION (its name IS a
        // string literal); |template| content must not read as static access.
        const blanked = blankStrings(withStrings);
        for (const p of PATTERNS) {
            const target = p.function ? withStrings : blanked;
            p.re.lastIndex = 0;
            for (const m of target.matchAll(p.re)) {
                const captured = m[1] ?? '';
                if (p.role === 'exception') {
                    // RAISING a, b — comma-separated exception list.
                    for (const part of captured.split(',')) {
                        const name = part.trim();
                        if (name)
                            add(name, 'exception', i + 1, false);
                    }
                }
                else {
                    add(captured, p.role, i + 1, p.function === true);
                }
            }
        }
    }
    const candidates = [...byName.values()];
    // Drop name-only static-access noise that is not a plausible global type
    // (ABAP globals in source appear as word chars; keep the rest).
    return candidates.filter((c) => c.kind === 'function' || c.name.length >= 3);
}
/** Rank candidates by reader priority (see ROLE_WEIGHT); usage breaks ties. */
export function rankDependencies(candidates) {
    return [...candidates].sort((a, b) => {
        const wa = Math.max(...a.roles.map((r) => ROLE_WEIGHT[r]));
        const wb = Math.max(...b.roles.map((r) => ROLE_WEIGHT[r]));
        return wb - wa || b.usageCount - a.usageCount || a.line - b.line;
    });
}
// ---------------------------------------------------------------------------
// Contract extraction
// ---------------------------------------------------------------------------
/** Per-contract line cap — a giant PUBLIC SECTION must not eat the prologue. */
const CONTRACT_MAX_LINES = 80;
function capLines(text) {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    if (lines.length <= CONTRACT_MAX_LINES)
        return text.replace(/\r\n/g, '\n');
    return `${lines.slice(0, CONTRACT_MAX_LINES).join('\n')}\n"... (contract truncated at ${CONTRACT_MAX_LINES} lines — read the object for the rest)"`;
}
/**
 * Extract the PUBLIC CONTRACT of a dependency source:
 *  - interface: the whole (already compact) declaration;
 *  - class: the `CLASS … DEFINITION` up to PROTECTED/PRIVATE SECTION (or
 *    ENDCLASS for all-public classes) — implementations elided.
 */
export function extractContract(source, name, type) {
    if (type === 'INTF')
        return capLines(source);
    const lines = source.split(/\r\n|\n/);
    const opener = new RegExp(`^\\s*CLASS\\s+${name.replace(/[^A-Za-z0-9_\/]/g, '')}\\s+DEFINITION`, 'i');
    const start = lines.findIndex((l) => opener.test(l));
    if (start < 0)
        return capLines(source); // unexpected shape — whole source, capped
    const out = [];
    for (let i = start; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (i > start && /^\s*(PROTECTED|PRIVATE)\s+SECTION\b/i.test(line))
            break;
        if (i > start && /^\s*ENDCLASS\b/i.test(line))
            break;
        out.push(line);
    }
    return capLines(out.join('\n'));
}
//# sourceMappingURL=abap.js.map