/**
 * Debugger session manager — plugin-level owner of the ADT debug sessions.
 *
 * One ADT HTTP session can hold exactly ONE debug session, and once a
 * listener is detached the session cannot be re-attached (vsp field pitfall)
 * — the terminal/IDE identity must therefore be managed OUTSIDE any single
 * tool call: this manager, one session record per destination, created lazily
 * on first use and torn down by the plugin disposer (`dispose()` → detach
 * every registered listener) so an unloaded plugin never leaks a listener
 * that blocks the user's next debug attempt.
 *
 * The debug loop itself (steps / variables / stack) rides the destination's
 * regular AdtClient: the stateful debugger session is identified by the
 * `sap-contextid` cookie the backend sets on the listener registration, and
 * that cookie lives in the client's cookie jar — which is exactly why the
 * registry's client cache (per destination config) is the right transport.
 */
import { randomUUID } from 'node:crypto';
export class DebuggerManager {
    registry;
    sessions = new Map();
    constructor(registry) {
        this.registry = registry;
    }
    /** The session record of a destination, created on first use. */
    sessionFor(entry, user) {
        const key = entry.config.name;
        let record = this.sessions.get(key);
        if (!record) {
            record = {
                terminalId: randomUUID(),
                ideId: randomUUID(),
                user: user ?? defaultDebugUser(entry),
            };
            this.sessions.set(key, record);
        }
        if (user)
            record.user = user;
        return record;
    }
    /** Drop a destination's session record (after detach — re-attach needs fresh ids). */
    dropSession(entry) {
        this.sessions.delete(entry.config.name);
    }
    /** Is a session record present (i.e. this destination ever listened)? */
    hasSession(entry) {
        return this.sessions.has(entry.config.name);
    }
    /** Register the listener and wait for a breakpoint hit (long-poll). */
    async listen(entry, options = {}) {
        const record = this.sessionFor(entry);
        const result = await entry.client.debuggerListen({
            user: record.user,
            terminalId: record.terminalId,
            ideId: record.ideId,
            timeoutSeconds: options.timeoutSeconds,
            signal: options.signal,
        });
        record.lastListen = {
            at: new Date().toISOString(),
            hit: Boolean(result.debuggee),
            program: result.debuggee?.program,
            line: result.debuggee?.line,
        };
        return { ...result, terminalId: record.terminalId, ideId: record.ideId };
    }
    /**
     * Detach the listener and drop the session record. Safe to call without a
     * prior listen (a registered-but-idle listener is still worth removing) and
     * tolerant of backends that already dropped the listener (404/409).
     */
    async detach(entry, signal) {
        const record = this.sessions.get(entry.config.name);
        this.dropSession(entry);
        if (!record)
            return { detached: false, note: 'no session registered for this destination' };
        try {
            await entry.client.debuggerDetach({
                user: record.user,
                terminalId: record.terminalId,
                ideId: record.ideId,
                signal,
            });
            return { detached: true };
        }
        catch (error) {
            // An already-detached listener is success for our purposes; everything
            // else still drops the LOCAL record (a fresh listen uses fresh ids).
            return { detached: false, note: `backend detach answered: ${error.message}` };
        }
    }
    /**
     * Plugin teardown (Fiber disposer): best-effort detach of every registered
     * listener on the standing (global) destinations, then drop all records.
     * Failures are swallowed — teardown must never block unloading.
     */
    async dispose() {
        const detaches = [...this.registry.destinations.values()]
            .filter((entry) => this.hasSession(entry))
            .map((entry) => this.detach(entry).catch(() => undefined));
        await Promise.allSettled(detaches);
        this.sessions.clear();
    }
    /** Snapshot for status rendering. */
    describe(entry) {
        const record = this.sessions.get(entry.config.name);
        if (!record)
            return { registered: false };
        return { registered: true, terminalId: record.terminalId, user: record.user, lastListen: record.lastListen };
    }
}
/** The user whose processes the debugger targets (basic-auth user or 'DEMO'). */
function defaultDebugUser(entry) {
    const auth = entry.client.destination.auth;
    return (auth?.type === 'basic' && auth.username ? auth.username : 'DEMO').toUpperCase();
}
//# sourceMappingURL=debugger.js.map