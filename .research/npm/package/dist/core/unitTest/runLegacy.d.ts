/**
 * ABAP Unit test run operations for legacy systems (BASIS < 7.50)
 *
 * Legacy systems use:
 * - /sap/bc/adt/abapunit/testruns instead of /sap/bc/adt/abapunit/runs
 * - application/xml for Content-Type and Accept (not versioned vnd.sap.adt.api.abapunit.* types)
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IClassUnitTestDefinition, IClassUnitTestRunOptions } from './types';
/**
 * Start ABAP Unit test run on legacy systems
 * Uses /sap/bc/adt/abapunit/testruns endpoint with aunit:runConfiguration format
 *
 * Legacy format differs from modern:
 * - Root element: aunit:runConfiguration (not aunit:run)
 * - Namespace: http://www.sap.com/adt/aunit (not http://www.sap.com/adt/api/aunit)
 * - Objects via adtcore:objectReferences with URI (not aunit:tests with containerClass/class)
 * - Content-Type/Accept: application/xml (not versioned vnd.sap.adt.api.abapunit.*)
 */
export declare function startClassUnitTestRunLegacy(connection: IAbapConnection, tests: IClassUnitTestDefinition[], _options?: IClassUnitTestRunOptions): Promise<IAdtResponse>;
export declare function getClassUnitTestStatusLegacy(connection: IAbapConnection, runId: string, withLongPolling?: boolean): Promise<IAdtResponse>;
export declare function getClassUnitTestResultLegacy(connection: IAbapConnection, runId: string, options?: {
    withNavigationUris?: boolean;
}): Promise<IAdtResponse>;
//# sourceMappingURL=runLegacy.d.ts.map