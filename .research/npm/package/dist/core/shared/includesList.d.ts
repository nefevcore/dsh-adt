/**
 * Include list operations for ABAP objects
 *
 * Recursively discovers and lists all include files within an ABAP program or include.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
/**
 * Get list of includes for ABAP object
 *
 * Uses node structure endpoint to recursively discover includes.
 *
 * @param connection - ABAP connection instance
 * @param objectName - Object name (program or include)
 * @param objectType - Object type: 'PROG/P' | 'PROG/I' | 'FUGR' | 'CLAS/OC'
 * @param timeout - Optional timeout in milliseconds (default: 30000)
 * @returns Array of include names
 *
 * @example
 * ```typescript
 * const includes = await getIncludesList(connection, 'ZMY_PROGRAM', 'PROG/P');
 * // Returns: ['ZMY_INCLUDE1', 'ZMY_INCLUDE2', ...]
 * ```
 */
export declare function getIncludesList(connection: IAbapConnection, objectName: string, objectType: 'PROG/P' | 'PROG/I' | 'FUGR' | 'CLAS/OC', timeout?: number): Promise<string[]>;
//# sourceMappingURL=includesList.d.ts.map