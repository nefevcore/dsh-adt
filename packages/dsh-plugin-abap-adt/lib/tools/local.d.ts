import type { Context } from '@deepseek-ai/cordis';
import { type ToolDeps } from './common.js';
/** Minimal filesystem surface the checker needs (injected, so tests can fake it). */
export interface FsReader {
    /** List direct children of an absolute directory path. */
    readDir(absPath: string): Promise<Array<{
        name: string;
        type: 'file' | 'directory' | 'other';
    }>>;
    /** Read a whole UTF-8 text file by absolute path. */
    readFile(absPath: string): Promise<string>;
}
export type CheckSeverity = 'Error' | 'Warning' | 'Info';
/**
 * Map an on-disk file name to the filename abaplint expects (type-suffixed,
 * e.g. `zcl_demo.clas.abap`). Legacy adt_export_objects output (plain
 * `<NAME>.abap`) is sniffed from the source head. Returns undefined for files
 * abaplint cannot handle — they are counted as skipped, not checked.
 */
export declare function toAbaplintName(fileName: string, source: string): string | undefined;
export interface LocalCheckOptions {
    severity?: CheckSeverity;
    maxFiles?: number;
    maxIssues?: number;
    configPath?: string;
}
export interface LocalCheckResult {
    dir: string;
    filesScanned: number;
    filesSkipped: number;
    truncated: boolean;
    /** Total issues found across all severities (uncapped, unfiltered). */
    issuesTotal: number;
    /** Issues at/above the requested severity (what `issues` holds, before capping). */
    reported: number;
    clean: boolean;
    counts: {
        Error: number;
        Warning: number;
        Info: number;
    };
    config: {
        source: 'explicit' | 'found' | 'default';
        ruleCount: number;
    };
    issues: Array<{
        file: string;
        line: number;
        col: number;
        rule: string;
        severity: string;
        message: string;
    }>;
}
/** Run abaplint over a directory of ABAP sources. Pure core, no tool plumbing. */
export declare function runLocalCheck(dir: string, options: LocalCheckOptions, fs: FsReader): Promise<LocalCheckResult>;
export declare function localTools(_deps: ToolDeps, ctx: Context): import("@deepseek-ai/dsh-tools").ToolDefinition[];
//# sourceMappingURL=local.d.ts.map