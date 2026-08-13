/**
 * Behavior Definition lock operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Lock behavior definition for modification
 *
 * Endpoint: POST /sap/bc/adt/bo/behaviordefinitions/{name}?_action=LOCK&accessMode=MODIFY
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param accessMode - Access mode (default: MODIFY)
 * @returns Lock handle that must be used in subsequent update/unlock requests
 *
 * @example
 * ```typescript
 * const lockHandle = await lock(connection, 'Z_MY_BDEF', sessionId);
 * // Use lockHandle for update operations
 * ```
 */
export declare function lock(connection: IAbapConnection, name: string, accessMode?: string): Promise<string>;
/**
 * Lock behavior definition for editing (returns full response)
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param accessMode - Access mode (default: MODIFY)
 * @returns Object containing response, lockHandle, and optional transport number
 *
 * @example
 * ```typescript
 * const { response, lockHandle, corrNr } = await lockForUpdate(connection, 'Z_MY_BDEF', sessionId);
 * ```
 */
export declare function lockForUpdate(connection: IAbapConnection, name: string, _sessionId: string, accessMode?: string): Promise<{
    response: IAdtResponse;
    lockHandle: string;
    corrNr?: string;
}>;
//# sourceMappingURL=lock.d.ts.map