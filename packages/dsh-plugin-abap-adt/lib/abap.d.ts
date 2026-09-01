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
export declare function stripAbapComment(line: string): string;
/** A 0-based inclusive line range of the source. */
export interface LineBlock {
    startIdx: number;
    endIdx: number;
}
/**
 * Find every `METHOD <name>.` … `ENDMETHOD.` block in the source. Method
 * blocks cannot nest in ABAP, but the count is depth-tracked anyway so a
 * (syntax-error) nesting never yields a wrong span. `METHODS`/`CLASS-METHODS`
 * declarations never match (word boundary after METHOD). Returns [] when the
 * method does not exist in this source.
 */
export declare function findMethodBlocks(source: string, methodName: string): LineBlock[];
/** How a dependency is used by the read source — drives fetch priority. */
export type DepRole = 'super' | 'interface' | 'signature' | 'collaborator' | 'exception';
/** One dependency candidate extracted from the source text. */
export interface DepCandidate {
    /** Upper-cased object name as written in the source. */
    name: string;
    /** Function modules are listed, not fetched (their contract lives in the
     *  function group; the mock has none and real reads need the parent). */
    kind: 'oo' | 'function';
    roles: DepRole[];
    /** How often the name is referenced (collaborator tie-break). */
    usageCount: number;
    /** 1-based line of the first mention. */
    line: number;
}
/**
 * Extract dependency candidates from an ABAP source. Names defined by the
 * source itself (its own CLASS/INTERFACE DEFINITIONs — local test classes
 * included) and the object's own name are excluded: a context prologue is
 * for things the reader must go ELSEWHERE to understand.
 */
export declare function extractDependencyCandidates(source: string, selfName: string): DepCandidate[];
/** Rank candidates by reader priority (see ROLE_WEIGHT); usage breaks ties. */
export declare function rankDependencies(candidates: DepCandidate[]): DepCandidate[];
/**
 * Extract the PUBLIC CONTRACT of a dependency source:
 *  - interface: the whole (already compact) declaration;
 *  - class: the `CLASS … DEFINITION` up to PROTECTED/PRIVATE SECTION (or
 *    ENDCLASS for all-public classes) — implementations elided.
 */
export declare function extractContract(source: string, name: string, type: 'CLAS' | 'INTF'): string;
//# sourceMappingURL=abap.d.ts.map