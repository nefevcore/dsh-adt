/**
 * ABAP Unit test run operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IClassUnitTestDefinition, IClassUnitTestRunOptions } from './types';
/**
 * Start ABAP Unit test run for specific test classes
 * Uses aunit:tests format (for regular class unit tests)
 */
export declare function startClassUnitTestRun(connection: IAbapConnection, tests: IClassUnitTestDefinition[], options?: IClassUnitTestRunOptions): Promise<IAdtResponse>;
/**
 * Start ABAP Unit test run by object (for CDS unit tests)
 * Uses osl:objectSet instead of aunit:tests
 */
export declare function startClassUnitTestRunByObject(connection: IAbapConnection, className: string, options?: IClassUnitTestRunOptions): Promise<IAdtResponse>;
export declare function getClassUnitTestStatus(connection: IAbapConnection, runId: string, withLongPolling?: boolean): Promise<IAdtResponse>;
export declare function getClassUnitTestResult(connection: IAbapConnection, runId: string, options?: {
    withNavigationUris?: boolean;
    format?: 'abapunit' | 'junit';
}): Promise<IAdtResponse>;
//# sourceMappingURL=run.d.ts.map