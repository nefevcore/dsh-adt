/**
 * FunctionInclude (FUGR/I) unlock operation.
 * NOTE: Caller should call connection.setSessionType("stateless") after unlocking.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
/**
 * Unlock function include. Must use the same stateful session that owned
 * the lock and the exact lockHandle returned from lockFunctionInclude().
 */
export declare function unlockFunctionInclude(connection: IAbapConnection, groupName: string, includeName: string, lockHandle: string): Promise<void>;
//# sourceMappingURL=unlock.d.ts.map