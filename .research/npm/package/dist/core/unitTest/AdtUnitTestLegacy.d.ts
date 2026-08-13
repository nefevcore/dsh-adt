/**
 * AdtUnitTestLegacy - Unit test operations for legacy SAP systems (BASIS < 7.50)
 *
 * Extends AdtUnitTest and overrides run/status/result to use legacy endpoints:
 * - /sap/bc/adt/abapunit/testruns instead of /sap/bc/adt/abapunit/runs
 * - application/xml content types instead of versioned vnd.sap.adt.api.abapunit.* types
 *
 * Key difference: Legacy systems return results synchronously (aunit:runResult)
 * from the POST to /testruns — no run ID, no async polling needed.
 */
import type { IAdtOperationOptions, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtUnitTest } from './AdtUnitTest';
import type { IClassUnitTestDefinition, IClassUnitTestRunOptions, IUnitTestConfig, IUnitTestState } from './types';
export declare class AdtUnitTestLegacy extends AdtUnitTest {
    /**
     * Create unit test run using legacy endpoint.
     * Legacy returns results synchronously — no run ID or polling needed.
     */
    create(config: IUnitTestConfig, _options?: IAdtOperationOptions): Promise<IUnitTestState>;
    /**
     * Run unit tests — legacy returns results synchronously.
     */
    run(tests: IClassUnitTestDefinition[], options?: IClassUnitTestRunOptions): Promise<string>;
    /**
     * Get unit test status — legacy returns results synchronously,
     * so this returns the cached response from create().
     */
    getStatus(_runId: string, _withLongPolling?: boolean): Promise<IAdtResponse>;
    /**
     * Get unit test result — legacy returns results synchronously,
     * so this returns the cached response from create().
     */
    getResult(_runId: string, _options?: {
        withNavigationUris?: boolean;
        format?: 'abapunit' | 'junit';
    }): Promise<IAdtResponse>;
    /**
     * Read unit test — legacy returns results synchronously,
     * so this returns the cached result from create().
     */
    read(_config: Partial<IUnitTestConfig>, _version?: 'active' | 'inactive'): Promise<IUnitTestState | undefined>;
}
//# sourceMappingURL=AdtUnitTestLegacy.d.ts.map