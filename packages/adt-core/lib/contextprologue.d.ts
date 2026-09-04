/**
 * Context prologue — vsp `pkg/ctxcomp` idea, adapted to this plugin's
 * primitives: when an agent reads an ABAP object it usually needs the PUBLIC
 * CONTRACTS of what that object uses, not just its own source. This module
 * extracts dependency candidates from the read slice (see abap.ts), fetches
 * their contracts with a bounded parallel budget, and renders an ABAP-comment
 * prologue.
 *
 * Budget discipline (the part worth copying verbatim from vsp): the budget is
 * spent on contracts that ARRIVE — a candidate that fails to resolve costs
 * one fetch attempt, not one slot — and every unresolved dependency stays
 * visible in the answer, because a dependency the reader cannot see is still
 * a dependency.
 */
import type { AdtClient } from '@nefevcore/abap-adt-protocol';
/** Default number of contracts to resolve into one prologue. */
export declare const DEFAULT_CONTEXT_DEPS = 8;
/** Clamp bounds for the `contextDeps` parameter. */
export declare const CONTEXT_DEPS_MIN = 1;
export declare const CONTEXT_DEPS_MAX = 15;
export interface ContextPrologueStats {
    found: number;
    resolved: number;
    unresolved: number;
    /** Candidates beyond the budget that were never attempted. */
    deferred: number;
}
export interface ContextPrologueResult {
    prologue: string | undefined;
    stats: ContextPrologueStats;
}
/**
 * Build the dependency-contract prologue for one read slice.
 *
 * @param slice the source text the agent will see (a method block when the
 *        read is method-level — dependencies scope to the method then).
 */
export declare function buildContextPrologue(client: AdtClient, slice: string, selfName: string, options?: {
    maxDeps?: number;
    signal?: AbortSignal;
}): Promise<ContextPrologueResult>;
//# sourceMappingURL=contextprologue.d.ts.map