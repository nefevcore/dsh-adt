/**
 * AdtUnitTest - High-level CRUD operations for Unit Test objects
 *
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 *
 * Uses low-level functions directly (not Builder classes).
 *
 * Session management:
 * - No stateful needed for unit test operations
 * - Unit tests don't use lock/unlock
 *
 * Operation chains:
 * - Create: create (start test run)
 * - Read: read (get test run status/result)
 * - Update: not supported (test runs cannot be updated)
 * - Delete: not supported (test runs cannot be deleted)
 * - Activate: not supported (test runs are not activated)
 * - Check: not supported (test runs don't have check operation)
 */
import type { IAbapConnection, IAdtCreatable, IAdtOperationOptions, IAdtReadable, IAdtResponse, IAdtTestRunnable, IAdtValidatable, ILogger, IObjectVersion } from '@mcp-abap-adt/interfaces';
import { AdtClass, AdtLocalTestClass } from '../class';
import type { IClassUnitTestDefinition, IClassUnitTestRunOptions, IUnitTestConfig, IUnitTestState } from './types';
/**
 * A test run is created, read and validated — never edited. ADT exposes no
 * update, delete, activate, check, lock or version resource for one, so the
 * class declares only the capabilities it honours. The refusing methods below
 * are kept so an existing caller still gets a clear runtime error rather than
 * `undefined is not a function`, but they are no longer part of the contract.
 */
export declare class AdtUnitTest implements IAdtCreatable<IUnitTestConfig, IUnitTestState>, IAdtReadable<IUnitTestConfig, IUnitTestState>, IAdtValidatable<IUnitTestConfig, IUnitTestState>, IAdtTestRunnable {
    protected readonly connection: IAbapConnection;
    protected readonly logger?: ILogger;
    readonly objectType: string;
    protected lastRunId?: string;
    protected lastStatusResponse?: IAdtResponse;
    protected lastResultResponse?: IAdtResponse;
    protected state: IUnitTestState;
    protected adtClass: AdtClass;
    protected adtLocalTestClass: AdtLocalTestClass;
    constructor(connection: IAbapConnection, logger?: ILogger);
    /**
     * Validate unit test configuration before creation
     * Note: ADT doesn't provide validation endpoint for unit tests
     */
    validate(config: Partial<IUnitTestConfig>): Promise<IUnitTestState>;
    /**
     * Create unit test run (start test execution)
     */
    create(config: IUnitTestConfig, _options?: IAdtOperationOptions): Promise<IUnitTestState>;
    /**
     * Read unit test run (get status or result)
     */
    read(config: Partial<IUnitTestConfig>, _version?: 'active' | 'inactive'): Promise<IUnitTestState | undefined>;
    /**
     * Read unit test metadata
     * For unit tests, metadata is the same as read() result (status/result information)
     */
    readMetadata(config: Partial<IUnitTestConfig>): Promise<IUnitTestState>;
    /**
     * Update unit test run
     * Note: Test runs cannot be updated
     */
    update(_config: Partial<IUnitTestConfig>, _options?: IAdtOperationOptions): Promise<IUnitTestState>;
    /**
     * Delete unit test run
     * Note: Test runs cannot be deleted via ADT
     */
    delete(_config: Partial<IUnitTestConfig>): Promise<IUnitTestState>;
    /**
     * Activate unit test run
     * Note: Test runs are not activated
     */
    activate(_config: Partial<IUnitTestConfig>): Promise<IUnitTestState>;
    /**
     * Check unit test run
     * Note: Test runs don't have check operation
     */
    check(_config: Partial<IUnitTestConfig>, _status?: string): Promise<IUnitTestState>;
    /**
     * Run unit tests (convenience method that wraps create)
     */
    run(tests: IClassUnitTestDefinition[], options?: IClassUnitTestRunOptions): Promise<string>;
    /**
     * Get run ID from last operation
     */
    getRunId(): string | undefined;
    /**
     * Get unit test status (convenience method)
     */
    getStatus(runId: string, withLongPolling?: boolean): Promise<IAdtResponse>;
    /**
     * Get status response from last getStatus call
     */
    getStatusResponse(): IAdtResponse | undefined;
    /**
     * Get unit test result (convenience method)
     */
    getResult(runId: string, options?: {
        withNavigationUris?: boolean;
        format?: 'abapunit' | 'junit';
    }): Promise<IAdtResponse>;
    /**
     * Get result response from last getResult call
     */
    getResultResponse(): IAdtResponse | undefined;
    /**
     * Extract run ID from unit test run response
     */
    protected extractRunId(response: IAdtResponse): string | undefined;
    /**
     * Read transport request information for unit test
     * Note: Unit tests are test runs, not ADT objects, so they don't have transport requests
     */
    readTransport(_config: Partial<IUnitTestConfig>): Promise<IUnitTestState>;
    /**
     * Lock unit test (not supported)
     */
    lock(_config: Partial<IUnitTestConfig>): Promise<string>;
    /**
     * Unlock unit test (not supported)
     */
    unlock(_config: Partial<IUnitTestConfig>, _lockHandle: string): Promise<IUnitTestState>;
    getVersions(_config: Partial<IUnitTestConfig>): Promise<IObjectVersion[]>;
    getVersionSource(_contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtUnitTest.d.ts.map