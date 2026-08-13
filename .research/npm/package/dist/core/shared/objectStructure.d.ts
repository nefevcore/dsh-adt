/**
 * Object structure operations for ABAP objects
 *
 * Retrieves ADT object structure as compact JSON tree.
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Get object structure from ADT repository
 *
 * Endpoint: GET /sap/bc/adt/repository/objectstructure?objecttype={type}&objectname={name}
 *
 * @param connection - ABAP connection instance
 * @param objectType - Object type (e.g., 'CLAS/OC', 'PROG/P', 'DEVC/K')
 * @param objectName - Object name
 * @returns Axios response with XML containing object structure tree
 *
 * @example
 * ```typescript
 * const response = await getObjectStructure(connection, 'CLAS/OC', 'ZMY_CLASS');
 * // Response contains XML with object structure
 * ```
 */
export declare function getObjectStructure(connection: IAbapConnection, objectType: string, objectName: string): Promise<IAdtResponse>;
//# sourceMappingURL=objectStructure.d.ts.map