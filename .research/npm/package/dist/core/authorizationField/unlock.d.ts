/**
 * AuthorizationField (SUSO / AUTH) unlock operation
 * NOTE: Caller should call connection.setSessionType("stateless") after unlocking
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
/**
 * Unlock authorization field. Must use the same stateful session that owned
 * the lock and the exact lockHandle returned from lockAuthorizationField().
 */
export declare function unlockAuthorizationField(connection: IAbapConnection, name: string, lockHandle: string): Promise<void>;
//# sourceMappingURL=unlock.d.ts.map