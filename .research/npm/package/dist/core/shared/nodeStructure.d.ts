/**
 * Node structure operations for ABAP objects
 *
 * Provides functions for fetching node structure from ADT repository.
 * Used by GetObjectInfo, GetIncludesList, and other tree navigation operations.
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Fetch node structure from ADT repository
 *
 * Endpoint: POST /sap/bc/adt/repository/nodestructure
 *
 * @param connection - ABAP connection instance
 * @param parentType - Parent object type (e.g., 'CLAS/OC', 'PROG/P', 'DEVC/K')
 * @param parentName - Parent object name
 * @param nodeId - Optional node ID (default: '0000' for root)
 * @param withShortDescriptions - Include short descriptions (default: true)
 * @returns Axios response with XML containing node structure
 *
 * @example
 * ```typescript
 * const response = await fetchNodeStructure(connection, 'CLAS/OC', 'ZMY_CLASS', '0000');
 * // Response contains XML with node structure
 * ```
 */
export declare function fetchNodeStructure(connection: IAbapConnection, parentType: string, parentName: string, nodeId?: string, withShortDescriptions?: boolean): Promise<IAdtResponse>;
//# sourceMappingURL=nodeStructure.d.ts.map