/**
 * Mock ADT server — implements the subset of the `/sap/bc/adt` REST protocol
 * needed to exercise the protocol client end-to-end without a real ABAP
 * system: discovery (AtomPub), search, source read/write on `/source/main`,
 * `_action=LOCK/UNLOCK` lock protocol, activation with in-body messages,
 * check runs, async ABAP Unit + ATC runs with JUnit / checkstyle results,
 * transport requests and object creation via type-specific collections.
 *
 * Behaviors mirror the real protocol (verified against open-source clients):
 * Basic auth, session cookies, CSRF tokens on state-changing requests, and
 * the correct `application/vnd.sap.*` media types in responses.
 *
 * Routing is a declarative table (ROUTES): `method` guards and CSRF
 * enforcement for state-changing routes are declared per route instead of
 * hand-written per branch, so a new route cannot silently miss them. A path
 * match under the wrong method falls through to the trailing 404 (the
 * historical behavior); the single modeled 405 is transport release.
 */
import { type IncomingMessage, type ServerResponse } from 'node:http';
import { type MockObject } from './data.js';
export interface MockAdtOptions {
    port?: number;
    host?: string;
    /** Username/password required by Basic auth (default: any). */
    username?: string;
    password?: string;
    systemId?: string;
    release?: string;
    /**
     * Simulate an old / restricted backend (BASIS < 7.5x, verified against a
     * real NW 7.4x system): the async `/abapunit/runs` service is absent
     * (404) and ABAP Unit runs only via the synchronous `/abapunit/testruns`
     * endpoint, which returns `aunit:runResult` directly in the POST response.
     */
    legacyUnitOnly?: boolean;
    /**
     * Send permissive CORS headers (`Access-Control-Allow-Origin: *`) so a
     * local page can drive the demo (default: true). SECURITY NOTE (audit
     * P3): with CORS on and NO credentials configured, any website open in a
     * local browser can read and drive the mock — acceptable only because
     * the server binds 127.0.0.1 and carries disposable demo data. Turn this
     * OFF (`cors: false`) when running the standalone CLI mock with anything
     * sensitive nearby.
     */
    cors?: boolean;
}
interface MockState {
    objects: MockObject[];
    locked: Map<string, {
        handle: string;
        corrnr: string;
        user?: string;
    }>;
    csrfToken: string;
    sessions: Set<string>;
    /** ABAP Unit run id → requested object names (uppercased). */
    unitRuns: Map<string, string[] | undefined>;
    /** ATC run ids issued by the async run flow. */
    atcRunIds: Set<string>;
    /** Debugger state machine (see hDebugger* handlers). */
    debugger: MockDebuggerState;
}
/** Debugger state: enough of the ADT debugger lifecycle to exercise the tools. */
interface MockDebuggerState {
    /** terminalId → registered listener. */
    listeners: Map<string, {
        ideId: string;
        user: string;
    }>;
    /** Breakpoint id → placement; shared by all listeners (external scope). */
    breakpoints: Map<string, {
        uri: string;
        line: number;
    }>;
    bpCounter: number;
    /**
     * A breakpoint was just set: the NEXT listener POST catches a debuggee
     * immediately (deterministic hit — no real long-poll needed in tests).
     */
    pendingHit: boolean;
    /** The stopped debuggee while a debug session is active. */
    session?: {
        debuggeeId: string;
        terminalId: string;
        program: string;
        include: string;
        line: number;
        user: string;
        /** Variable name → value view (setVariableValue mutates this). */
        variables: Map<string, {
            value: string;
            type: string;
            readOnly: boolean;
        }>;
        /** Debuggee released (stepContinue) — no longer inspectable. */
        running: boolean;
    };
}
export declare function createMockAdtServer(options?: MockAdtOptions): {
    server: import("http").Server<typeof IncomingMessage, typeof ServerResponse>;
    state: MockState;
    listen(port?: number): Promise<number>;
    close(): Promise<void>;
    /** Access the in-memory object store (tests). */
    readonly objects: MockObject[];
};
export {};
//# sourceMappingURL=server.d.ts.map