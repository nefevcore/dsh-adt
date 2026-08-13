/**
 * All types operations for ABAP objects
 *
 * Retrieves all valid ADT object types from the repository.
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Get all valid ADT object types
 *
 * Endpoint: GET /sap/bc/adt/repository/informationsystem/objecttypes
 *
 * @param connection - ABAP connection instance
 * @param maxItemCount - Maximum number of items to return (default: 999)
 * @param name - Name filter pattern (default: '*')
 * @param data - Data filter (default: 'usedByProvider')
 * @returns Axios response with XML containing all object types
 *
 * @example
 * ```typescript
 * const response = await getAllTypes(connection);
 * // Response contains XML with all ADT object types
 * ```
 */
export declare function getAllTypes(connection: IAbapConnection, maxItemCount?: number, name?: string, data?: string): Promise<IAdtResponse>;
//# sourceMappingURL=allTypes.d.ts.map