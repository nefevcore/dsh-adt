/**
 * Interface unlock operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Unlock interface
 * Must use same session and lock handle from lock operation
 */
export declare function unlockInterface(connection: IAbapConnection, interfaceName: string, lockHandle: string): Promise<IAdtResponse>;
//# sourceMappingURL=unlock.d.ts.map