/**
 * Behavior Definition unlock operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Unlock behavior definition
 *
 * Endpoint: POST /sap/bc/adt/bo/behaviordefinitions/{name}?_action=UNLOCK&lockHandle={handle}
 *
 * Must use same session and lock handle from lock operation
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param lockHandle - Lock handle obtained from lock operation
 * @param sessionId - Session ID for request tracking
 * @returns Axios response
 *
 * @example
 * ```typescript
 * const lockHandle = await lock(connection, 'Z_MY_BDEF', sessionId);
 * // ... perform updates ...
 * await unlock(connection, 'Z_MY_BDEF', lockHandle, sessionId);
 * ```
 */
export declare function unlock(connection: IAbapConnection, name: string, lockHandle: string): Promise<IAdtResponse>;
//# sourceMappingURL=unlock.d.ts.map