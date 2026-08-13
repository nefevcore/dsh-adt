/**
 * Package lock operations
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
/**
 * Lock package for modification
 * Returns lock handle that must be used in subsequent requests
 *
 * NOTE: Caller must enable stateful session mode via connection.setSessionType("stateful")
 * before calling this function
 */
export interface IPackageLockResult {
    lockHandle: string;
    corrNr?: string;
}
export declare function lockPackage(connection: IAbapConnection, packageName: string): Promise<IPackageLockResult>;
//# sourceMappingURL=lock.d.ts.map