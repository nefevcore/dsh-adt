/**
 * Behavior Definition delete operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Check if behavior definition can be deleted
 *
 * Endpoint: POST /sap/bc/adt/deletion/check
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @returns Axios response with deletion check result
 *
 * @example
 * ```typescript
 * const checkResult = await checkDeletion(connection, 'Z_MY_BDEF', sessionId);
 * // Check if deletable
 * const isDeletable = checkResult.data.match(/del:isDeletable="true"/);
 * ```
 */
export declare function checkDeletion(connection: IAbapConnection, name: string): Promise<IAdtResponse>;
/**
 * Delete behavior definition
 *
 * Endpoint: POST /sap/bc/adt/deletion/delete
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param transportRequest - Optional transport request number
 * @returns Axios response with deletion result
 *
 * @example
 * ```typescript
 * // Check first
 * await checkDeletion(connection, 'Z_MY_BDEF', sessionId);
 *
 * // Then delete
 * await deleteBehaviorDefinition(connection, 'Z_MY_BDEF', sessionId, 'DEVK900123');
 * ```
 */
export declare function deleteBehaviorDefinition(connection: IAbapConnection, name: string, transportRequest?: string): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map