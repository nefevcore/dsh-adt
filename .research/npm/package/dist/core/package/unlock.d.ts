/**
 * Package unlock operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Unlock package
 * Must use same lock handle from lock operation
 *
 * NOTE: Caller should disable stateful session mode via connection.setSessionType("stateless")
 * after calling this function
 */
export declare function unlockPackage(connection: IAbapConnection, packageName: string, lockHandle: string): Promise<IAdtResponse>;
//# sourceMappingURL=unlock.d.ts.map