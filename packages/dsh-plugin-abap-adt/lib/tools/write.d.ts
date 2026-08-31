import type { Context } from '@deepseek-ai/cordis';
import { type ToolDeps } from './common.js';
export interface ReplaceBlockOptions {
    /** 1-based index among the start marker's matches (for duplicate lines). */
    occurrence?: number;
    /** Line-number mode: replace lines startLine..endLine directly. */
    startLine?: number;
    endLine?: number;
}
export interface ReplaceBlockResult {
    full: string;
    oldLines: number;
    newLines: number;
    startLineNumber: number;
    endLineNumber: number;
    /** How the block was located: structured = ENDxxx resolved by nesting depth. */
    matchMode: 'structured' | 'text' | 'text-loose' | 'text-raw' | 'line-number';
    occurrence?: number;
}
/**
 * Locate a block by start/end line markers in the source and replace it
 * wholesale; bytes outside the block are preserved. Line-ending style follows
 * the source file (CRLF/LF).
 *
 * Marker matching runs in TIERS (see findMarkerHits): comment-stripped →
 * whitespace-free → raw. Disambiguation and fallbacks:
 *  - a start marker matching MULTIPLE lines errors with the numbered
 *    candidates unless `occurrence` (1-based, file order) picks one — the only
 *    way to edit exact-duplicate lines;
 *  - the END search starts AT the start line (start == end = single line) and
 *    takes the FIRST match — closers repeat massively in real code
 *    (ENDFORM./ENDIF./…) and the first one at/after the block start is the
 *    block's own;
 *  - `startLine`/`endLine` switch to line-number mode (verify the `start`
 *    marker against that line when both are given — stale-number guard);
 *  - zero-hit markers report the closest lines (token similarity) so the
 *    caller can self-correct in one round trip.
 */
export declare function replaceSourceBlock(source: string, startText: string, endText: string, replacement: string, options?: ReplaceBlockOptions): ReplaceBlockResult;
/**
 * DSH-`edit` semantics for remote objects: replace an EXACT quoted text with
 * new text. The agent quotes `oldText` verbatim from a recent
 * adt_read_object (multi-line OK, tail comments tolerated) and the match runs
 * against the CURRENT server-side source — if the remote changed meanwhile,
 * the match simply fails (safe). Ambiguity is resolved the DSH way: include
 * neighboring lines in the quote (or `occurrence`); not-found lists the
 * closest lines so one re-read + retry converges.
 *
 * Matching: a single-line oldText goes through the tiered marker path
 * (substring-friendly). A multi-line oldText requires per-line equality
 * (comment-stripped, case-insensitive, whitespace collapsed; tier 2 tolerates
 * spacing inside quotes) — i.e. quote exactly what you read.
 */
export declare function replaceSourceText(source: string, oldText: string, newText: string, options?: {
    occurrence?: number;
}): ReplaceBlockResult;
export declare function writeTools(deps: ToolDeps, ctx: Context): import("@deepseek-ai/dsh-tools").ToolDefinition[];
//# sourceMappingURL=write.d.ts.map