/**
 * Get Inactive Objects - retrieve list of objects not yet activated
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { IInactiveObjectsResponse } from './types';
/**
 * Get list of inactive objects (objects that are not yet activated)
 *
 * Endpoint: GET /sap/bc/adt/activation/inactiveobjects
 *
 * @param connection - ABAP connection instance
 * @param options - Optional parameters
 * @returns List of inactive objects with their metadata
 *
 * @example
 * ```typescript
 * const result = await getInactiveObjects(connection);
 *
 * // Objects can be directly passed to activateObjectsGroup
 * await activateObjectsGroup(connection, result.objects);
 * ```
 */
export declare function getInactiveObjects(connection: IAbapConnection, options?: {
    includeRawXml?: boolean;
}): Promise<IInactiveObjectsResponse>;
//# sourceMappingURL=getInactiveObjects.d.ts.map