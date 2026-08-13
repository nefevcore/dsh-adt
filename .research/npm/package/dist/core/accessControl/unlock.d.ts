import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Unlock access control
 * Must use same session and lock handle from lock operation
 */
export declare function unlockAccessControl(connection: IAbapConnection, accessControlName: string, lockHandle: string): Promise<IAdtResponse>;
//# sourceMappingURL=unlock.d.ts.map