/**
 * TableType unlock operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Unlock the table type after DDL content is added
 * Must use same session and lock handle from lock operation
 */
export declare function unlockTableType(connection: IAbapConnection, tableTypeName: string, lockHandle: string): Promise<IAdtResponse>;
/**
 * Delete table type lock (cleanup)
 */
export declare function deleteTableTypeLock(connection: IAbapConnection, tableTypeName: string): Promise<IAdtResponse>;
//# sourceMappingURL=unlock.d.ts.map