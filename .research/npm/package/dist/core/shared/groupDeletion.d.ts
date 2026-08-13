/**
 * Group Deletion operations - delete multiple objects with session support
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IObjectReference } from './types';
/**
 * Check if multiple objects can be deleted (group deletion check)
 *
 * Endpoint: POST /sap/bc/adt/deletion/check
 *
 * This function allows checking deletion for multiple objects of different types in a single request.
 * Useful for checking related objects together (e.g., view + table).
 *
 * @param connection - ABAP connection instance
 * @param objects - Array of objects to check for deletion
 * @returns Axios response with deletion check result
 *
 * @example
 * ```typescript
 * // Check deletion for view and table together
 * const objects = [
 *   {
 *     type: 'DDLS/DF',
 *     name: 'ZADT_BLD_VIEW02'
 *   },
 *   {
 *     type: 'TABL/DT',
 *     name: 'ZADT_VIEW_TBL02'
 *   }
 * ];
 *
 * const result = await checkDeletionGroup(connection, objects);
 * ```
 */
export declare function checkDeletionGroup(connection: IAbapConnection, objects: IObjectReference[]): Promise<IAdtResponse>;
/**
 * Delete multiple objects in a group (with session support)
 *
 * Endpoint: POST /sap/bc/adt/deletion/delete
 *
 * This function allows deleting multiple objects of different types in a single request.
 * Useful for deleting related objects together (e.g., view + table).
 *
 * @param connection - ABAP connection instance
 * @param objects - Array of objects to delete
 * @param transportRequest - Optional transport request number
 * @returns Axios response with deletion result
 *
 * @example
 * ```typescript
 * // Delete view and table together
 * const objects = [
 *   {
 *     type: 'DDLS/DF',
 *     name: 'ZADT_BLD_VIEW02'
 *   },
 *   {
 *     type: 'TABL/DT',
 *     name: 'ZADT_VIEW_TBL02'
 *   }
 * ];
 *
 * const result = await deleteObjectsGroup(connection, objects);
 * ```
 */
export declare function deleteObjectsGroup(connection: IAbapConnection, objects: IObjectReference[], transportRequest?: string): Promise<IAdtResponse>;
//# sourceMappingURL=groupDeletion.d.ts.map