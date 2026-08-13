"use strict";
/**
 * Session-scoped registry of held object locks.
 *
 * One registry per stateful session (owned by AdtClient). Handlers record a lock
 * when they acquire it and remove it on a clean unlock. `unlockAll()` is the
 * last-resort cleanup: it releases any lock still held (e.g. the consumer forgot
 * to unlock, or a managed flow threw before its unlock), so a session is never
 * abandoned with dangling enqueue locks.
 *
 * This is a safety net, NOT the primary defense. Preventing a timeout from
 * interrupting the lock→unlock critical section is the caller's responsibility.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LockRegistry = void 0;
exports.createLockTracker = createLockTracker;
class LockRegistry {
    session;
    locks = new Map();
    /**
     * @param session Controls the shared connection's session type. `unlockAll()`
     *   uses it to keep the session stateful for the whole batch — some
     *   connections (RFC) clear the stateful cookie when switched to stateless,
     *   which would invalidate the remaining lock handles mid-batch.
     */
    constructor(session) {
        this.session = session;
    }
    /** Record a held lock under a stable object key (e.g. `DOMA/ZFOO`). */
    track(key, unlock) {
        this.locks.set(key, unlock);
    }
    /** Drop a lock after it has been released cleanly. */
    untrack(key) {
        this.locks.delete(key);
    }
    /** Keys of locks still held. */
    get pending() {
        return [...this.locks.keys()];
    }
    /**
     * Release every lock still held. Successfully released locks are dropped;
     * locks whose unlock throws are kept and returned as failures.
     *
     * The whole batch runs under a single stateful→stateless transition so that a
     * per-unlock switch to stateless can't clear the session mid-batch and break
     * the remaining lock handles.
     */
    async unlockAll() {
        const failures = [];
        if (this.locks.size === 0)
            return failures;
        this.session?.setSessionType('stateful');
        try {
            for (const [key, unlock] of [...this.locks]) {
                try {
                    await unlock();
                    this.locks.delete(key);
                }
                catch (error) {
                    failures.push({ key, error });
                }
            }
        }
        finally {
            this.session?.setSessionType('stateless');
        }
        return failures;
    }
}
exports.LockRegistry = LockRegistry;
/**
 * Build a {@link LockTracker} for one object type.
 *
 * @param registry   Session registry to record into (undefined → no-op tracker).
 * @param objectType Stable type prefix for the key (e.g. `Domain`).
 * @param unlock     Raw release of a held lock, invoked by `unlockAll()` for
 *                   abandoned locks. MUST NOT toggle the session type —
 *                   `unlockAll()` manages the session for the whole batch.
 */
function createLockTracker(registry, objectType, unlock) {
    const keyOf = (objectName) => `${objectType}/${objectName.toUpperCase()}`;
    return {
        track(objectName, lockHandle) {
            registry?.track(keyOf(objectName), () => unlock(objectName, lockHandle));
        },
        untrack(objectName) {
            registry?.untrack(keyOf(objectName));
        },
    };
}
