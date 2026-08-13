/**
 * Include operations for ABAP objects
 *
 * Retrieves source code of specific ABAP include files.
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Get include source code
 *
 * Endpoint: GET /sap/bc/adt/programs/includes/{name}/source/main
 *
 * @param connection - ABAP connection instance
 * @param includeName - Include name
 * @returns Axios response with source code (plain text)
 *
 * @example
 * ```typescript
 * const response = await getInclude(connection, 'ZMY_INCLUDE');
 * const sourceCode = response.data; // Include source code
 * ```
 */
export declare function getInclude(connection: IAbapConnection, includeName: string): Promise<IAdtResponse>;
//# sourceMappingURL=include.d.ts.map