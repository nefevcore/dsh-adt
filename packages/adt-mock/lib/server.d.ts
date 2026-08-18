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