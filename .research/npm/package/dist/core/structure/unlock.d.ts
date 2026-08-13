/**
 * Structure unlock operations
 * NOTE: Caller should call connection.setSessionType("stateless") after unlocking
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Unlock structure
 * Must use same session and lock handle from lock operation
 */
export declare function unlockStructure(connection: IAbapConnection, structureName: string, lockHandle: string): Promise<IAdtResponse>;
//# sourceMappingURL=unlock.d.ts.map