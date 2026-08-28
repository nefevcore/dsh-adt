import type { Context } from '@deepseek-ai/cordis';
/** Thrown when the server source no longer matches the snapshot's base hash. */
export declare class SnapshotConflictError extends Error {
    readonly objectName: string;
    readonly snapshotPath: string;
    readonly fetchedAt: string | undefined;
    readonly toolName: string;
    constructor(objectName: string, snapshotPath: string, fetchedAt: string | undefined, toolName: string);
}
export interface SnapshotSidecar {
    destination: string;
    uri: string;
    name: string;
    type: string;
    /** Hash of the server source at fetch time — the base version to verify against. */
    baseHash: string;
    fetchedAt: string;
}
export interface ObjectSnapshot {
    /** The snapshot file content (= fetch-time server source, unless edited locally). */
    source: string;
    sidecar: SnapshotSidecar;
    /** Workspace-relative path of the snapshot file. */
    path: string;
}
/** Hash a source; line endings normalized so backend CRLF/LF quirks don't false-positive. */
export declare function hashSource(source: string): string;
/**
 * Tolerant equality for post-write persistence verification: compares what we
 * WROTE against what a read-back returns, ignoring the normalizations real
 * backends apply to stored sources (CRLF↔LF, trailing whitespace/newlines at
 * EOF). Anything beyond that means the server holds DIFFERENT content — most
 * likely a concurrent editor (same user, other session) saved a stale buffer
 * over our write.
 */
export declare function sourcesEquivalent(written: string, readBack: string): boolean;
export declare function snapshotPaths(destination: string, ref: {
    name: string;
    type: string;
}): {
    file: string;
    sidecar: string;
};
/** Load the tracked snapshot for an object; undefined when absent/corrupt/no fs. */
export declare function loadSnapshot(ctx: Context, destination: string, ref: {
    name: string;
    type: string;
    uri: string;
}): Promise<ObjectSnapshot | undefined>;
/** Save/refresh the snapshot; returns the file path. */
export declare function saveSnapshot(ctx: Context, destination: string, ref: {
    name: string;
    type: string;
    uri: string;
}, source: string): Promise<string>;
//# sourceMappingURL=snapshots.d.ts.map