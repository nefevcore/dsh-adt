/**
 * Local object snapshots — the optimistic-concurrency base of the edit flow
 * (pull → edit local → verify → push).
 *
 * adt_read_object / adt_write_object / adt_edit_object / adt_push_object keep
 * a local copy of the server source the AGENT last saw, next to a sidecar
 * JSON recording the content hash of the server source at fetch time (the
 * "base version"). Before any upload the server source is re-fetched and
 * hashed while the edit lock is held:
 *
 *   hash == baseHash → the agent's edit is a valid successor of what they
 *                      saw → PUT proceeds;
 *   hash != baseHash → someone else wrote in between → explicit conflict
 *                      (never a silent fuzzy match against drifted content).
 *
 * Why a content hash and not the object's changedAt timestamp: the hash is
 * exact (ANY change flips it), needs no per-type metadata endpoint (availability
 * varies across ADT profiles) and is immune to timestamp granularity/refresh
 * quirks — while costing zero extra round trips (the upload flow already
 * fetches the current source). Running the check under the lock closes the
 * verify→write race: other writers cannot sneak in, they would need the lock.
 *
 * Files live under `.adt-snapshots/<destination>/` in the DSH workspace
 * (sandbox-aware via the optional dsh-fs service, `ctx.get('fs')`):
 *   <name>.<category>.abap            — the source text (editable in place;
 *                                        adt_push_object uploads it after
 *                                        verification)
 *   <name>.<category>.abap.json       — sidecar: base hash, uri, fetchedAt
 */
import { createHash } from 'node:crypto';
/** Thrown when the server source no longer matches the snapshot's base hash. */
export class SnapshotConflictError extends Error {
    objectName;
    snapshotPath;
    fetchedAt;
    toolName;
    constructor(objectName, snapshotPath, fetchedAt, toolName) {
        super(`[CONFLICT] ${toolName}: ${objectName} changed on the server since your last adt_read_object` +
            `${fetchedAt ? ` (snapshot fetched at ${fetchedAt})` : ''} — your change was NOT applied and the server ` +
            `was NOT touched. Re-read the object (your local snapshot is kept at ${snapshotPath}), redo the edit on ` +
            'the fresh content, then retry.');
        this.objectName = objectName;
        this.snapshotPath = snapshotPath;
        this.fetchedAt = fetchedAt;
        this.toolName = toolName;
        this.name = 'SnapshotConflictError';
    }
}
/** Hash a source; line endings normalized so backend CRLF/LF quirks don't false-positive. */
export function hashSource(source) {
    return createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex');
}
/**
 * Tolerant equality for post-write persistence verification: compares what we
 * WROTE against what a read-back returns, ignoring the normalizations real
 * backends apply to stored sources (CRLF↔LF, trailing whitespace/newlines at
 * EOF). Anything beyond that means the server holds DIFFERENT content — most
 * likely a concurrent editor (same user, other session) saved a stale buffer
 * over our write.
 */
export function sourcesEquivalent(written, readBack) {
    const normalize = (s) => s
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => line.replace(/[ \t]+$/, ''))
        .join('\n')
        .replace(/\n+$/, '');
    return normalize(written) === normalize(readBack);
}
function fileStem(ref) {
    const short = (ref.type.split('/')[0] ?? 'obj').toLowerCase();
    return `${ref.name.toLowerCase()}.${short}.abap`;
}
export function snapshotPaths(destination, ref) {
    const file = `.adt-snapshots/${destination}/${fileStem(ref)}`;
    return { file, sidecar: `${file}.json` };
}
/** Load the tracked snapshot for an object; undefined when absent/corrupt/no fs. */
export async function loadSnapshot(ctx, destination, ref) {
    // Optional service (audit D1): no dsh-fs → no snapshots, callers degrade.
    const fs = ctx.get('fs');
    if (!fs)
        return undefined;
    const { file, sidecar } = snapshotPaths(destination, ref);
    try {
        const sidecarTarget = await fs.resolve(sidecar);
        const sidecarRaw = await fs.readText(sidecarTarget);
        const meta = JSON.parse(sidecarRaw);
        if (!meta || typeof meta.baseHash !== 'string' || meta.uri !== ref.uri)
            return undefined;
        const fileTarget = await fs.resolve(file);
        const source = await fs.readText(fileTarget);
        return { source, sidecar: meta, path: file };
    }
    catch {
        return undefined; // no snapshot yet (or unreadable) — callers fall back
    }
}
/** Save/refresh the snapshot; returns the file path. */
export async function saveSnapshot(ctx, destination, ref, source) {
    // Optional service (audit D1): snapshotting needs dsh-fs; callers treat a
    // throw here as "no snapshot available", not a read failure.
    const fs = ctx.get('fs');
    if (!fs)
        throw new Error('adt: snapshotting requires the dsh filesystem service (ctx.get(\'fs\'))');
    const { file, sidecar } = snapshotPaths(destination, ref);
    const meta = {
        destination,
        uri: ref.uri,
        name: ref.name,
        type: ref.type,
        baseHash: hashSource(source),
        fetchedAt: new Date().toISOString(),
    };
    const fileTarget = await fs.resolve(file);
    // (expected, signal) are intentionally omitted — unconditional write.
    await fs.writeText(fileTarget, source, undefined, undefined);
    const sidecarTarget = await fs.resolve(sidecar);
    await fs.writeText(sidecarTarget, JSON.stringify(meta, null, 2), undefined, undefined);
    return file;
}
//# sourceMappingURL=snapshots.js.map