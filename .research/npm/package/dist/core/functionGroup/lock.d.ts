/**
 * Lock Function Group operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Lock a function group for editing
 *
 * @param connection - ABAP connection
 * @param functionGroupName - Name of the function group (e.g., 'Z_FUGR_TEST_0001')
 * @param sessionId - Optional session ID for tracking
 * @returns Lock handle string
 */
export declare function lockFunctionGroup(connection: IAbapConnection, functionGroupName: string, _sessionId?: string): Promise<string>;
/**
 * Unlock a function group
 *
 * @param connection - ABAP connection
 * @param functionGroupName - Name of the function group
 * @param lockHandle - Lock handle from lockFunctionGroup
 * @param sessionId - Optional session ID for tracking
 * @returns IAdtResponse from unlock request
 */
export declare function unlockFunctionGroup(connection: IAbapConnection, functionGroupName: string, lockHandle: string, _sessionId?: string): Promise<IAdtResponse>;
//# sourceMappingURL=lock.d.ts.map