import type { AdtDebugListenResult } from '@nefevcore/abap-adt-protocol';
import type { AdtRegistry, RegistryDestination } from './registry.js';
/** Per-destination debugger identity (terminal + IDE id + target user). */
interface DebugSessionRecord {
    terminalId: string;
    ideId: string;
    user: string;
    /** Last listen outcome (for status rendering). */
    lastListen?: {
        at: string;
        hit: boolean;
        program?: string;
        line?: number;
    };
}
export declare class DebuggerManager {
    private readonly registry;
    private readonly sessions;
    constructor(registry: AdtRegistry);
    /** The session record of a destination, created on first use. */
    sessionFor(entry: RegistryDestination, user?: string): DebugSessionRecord;
    /** Drop a destination's session record (after detach — re-attach needs fresh ids). */
    dropSession(entry: RegistryDestination): void;
    /** Is a session record present (i.e. this destination ever listened)? */
    hasSession(entry: RegistryDestination): boolean;
    /** Register the listener and wait for a breakpoint hit (long-poll). */
    listen(entry: RegistryDestination, options?: {
        timeoutSeconds?: number;
        signal?: AbortSignal;
    }): Promise<AdtDebugListenResult & {
        terminalId: string;
        ideId: string;
    }>;
    /**
     * Detach the listener and drop the session record. Safe to call without a
     * prior listen (a registered-but-idle listener is still worth removing) and
     * tolerant of backends that already dropped the listener (404/409).
     */
    detach(entry: RegistryDestination, signal?: AbortSignal): Promise<{
        detached: boolean;
        note?: string;
    }>;
    /**
     * Plugin teardown (Fiber disposer): best-effort detach of every registered
     * listener on the standing (global) destinations, then drop all records.
     * Failures are swallowed — teardown must never block unloading.
     */
    dispose(): Promise<void>;
    /** Snapshot for status rendering. */
    describe(entry: RegistryDestination): {
        registered: boolean;
        terminalId?: string;
        user?: string;
        lastListen?: DebugSessionRecord['lastListen'];
    };
}
export {};
//# sourceMappingURL=debugger.d.ts.map