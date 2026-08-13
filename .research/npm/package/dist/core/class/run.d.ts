/**
 * Class run operations - execute ABAP classes that implement if_oo_adt_classrun
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Run an ABAP class that implements if_oo_adt_classrun interface.
 *
 * This executes the class's main() method and returns execution output.
 * The class must implement if_oo_adt_classrun interface to be executable.
 *
 * Endpoint: POST /sap/bc/adt/oo/classrun/{className}
 *
 * Use cases:
 * - Execute test/demo classes
 * - Run data migration scripts
 * - Execute batch processing classes
 * - Quick code testing without creating programs
 *
 * @param connection - SAP connection
 * @param className - Name of the class to run (must implement if_oo_adt_classrun)
 * @param runnable - Optional flag to check if class is runnable (default: true, throws error if false)
 * @param sessionId - Optional session ID for session-based requests
 * @returns Response with execution output from the class execution
 * @throws Error if runnable is false, or if class doesn't implement if_oo_adt_classrun or execution fails
 *
 * @example
 * ```typescript
 * // Class must implement if_oo_adt_classrun:
 * // CLASS zcl_test DEFINITION PUBLIC FINAL CREATE PUBLIC.
 * //   PUBLIC SECTION.
 * //     INTERFACES if_oo_adt_classrun.
 * // ENDCLASS.
 * //
 * // CLASS zcl_test IMPLEMENTATION.
 * //   METHOD if_oo_adt_classrun~main.
 * //     out->write( 'Hello World' ).
 * //   ENDMETHOD.
 * // ENDCLASS.
 *
 * const result = await runClass(connection, 'ZCL_TEST', true);
 *
 * // Check if class is runnable before attempting to run
 * if (classConfig.runnable) {
 *   const result = await runClass(connection, 'ZCL_TEST', true);
 * }
 * ```
 */
export declare function runClass(connection: IAbapConnection, className: string, runnable?: boolean, _sessionId?: string): Promise<IAdtResponse>;
export type { IClassUnitTestDefinition, IClassUnitTestRunOptions, } from '../unitTest/types';
import type { IClassUnitTestDefinition, IClassUnitTestRunOptions } from '../unitTest/types';
export declare function startClassUnitTestRun(connection: IAbapConnection, tests: IClassUnitTestDefinition[], options?: IClassUnitTestRunOptions): Promise<IAdtResponse>;
export declare function getClassUnitTestStatus(connection: IAbapConnection, runId: string, withLongPolling?: boolean): Promise<IAdtResponse>;
export declare function getClassUnitTestResult(connection: IAbapConnection, runId: string, options?: {
    withNavigationUris?: boolean;
    format?: 'abapunit' | 'junit';
}): Promise<IAdtResponse>;
/**
 * Start ABAP Unit test run by object (for CDS unit tests)
 * Uses osl:objectSet instead of aunit:tests
 */
export declare function startClassUnitTestRunByObject(connection: IAbapConnection, className: string, options?: IClassUnitTestRunOptions): Promise<IAdtResponse>;
//# sourceMappingURL=run.d.ts.map