import type { CheckRunVersion } from '../../utils/checkRun';
/**
 * Behavior Definition check operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { CheckReporter } from './types';
/**
 * Run check on behavior definition
 *
 * Endpoint: POST /sap/bc/adt/checkruns?reporters={reporter}
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param reporter - Check reporter type
 * @param sessionId - Session ID for request tracking
 * @param version - Version to check (default: inactive)
 * @param sourceCode - Optional source code to check (will be base64 encoded)
 * @returns Axios response with check results (XML)
 *
 * @example
 * ```typescript
 * // Check saved version
 * const implResult = await check(connection, 'Z_MY_BDEF', 'bdefImplementationCheck', sessionId);
 *
 * // Check unsaved source code
 * const syntaxResult = await check(connection, 'Z_MY_BDEF', 'abapCheckRun', sessionId, 'inactive', sourceCode);
 * ```
 */
export declare function check(connection: IAbapConnection, name: string, reporter: CheckReporter, _sessionId: string, version?: CheckRunVersion, sourceCode?: string): Promise<IAdtResponse>;
/**
 * Check behavior definition implementation
 *
 * Uses bdefImplementationCheck reporter
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param version - Version to check (default: inactive)
 * @param sourceCode - Optional source code to check
 * @returns Axios response with check results
 *
 * @example
 * ```typescript
 * // Check saved version
 * const result = await checkImplementation(connection, 'Z_MY_BDEF', sessionId);
 *
 * // Check unsaved changes
 * const result = await checkImplementation(connection, 'Z_MY_BDEF', sessionId, 'inactive', sourceCode);
 * ```
 */
export declare function checkImplementation(connection: IAbapConnection, name: string, sessionId: string, version?: CheckRunVersion, sourceCode?: string): Promise<IAdtResponse>;
/**
 * Check behavior definition ABAP syntax
 *
 * Uses abapCheckRun reporter
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param version - Version to check (default: inactive)
 * @param sourceCode - Optional source code to check
 * @returns Axios response with check results
 *
 * @example
 * ```typescript
 * // Check saved version
 * const result = await checkAbap(connection, 'Z_MY_BDEF', sessionId);
 *
 * // Check unsaved changes
 * const result = await checkAbap(connection, 'Z_MY_BDEF', sessionId, 'inactive', sourceCode);
 * ```
 */
export declare function checkAbap(connection: IAbapConnection, name: string, sessionId: string, version?: CheckRunVersion, sourceCode?: string): Promise<IAdtResponse>;
//# sourceMappingURL=check.d.ts.map