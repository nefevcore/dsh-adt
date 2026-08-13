/**
 * Table unlock operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Unlock the table after DDL content is added
 * Must use same session and lock handle from lock operation
 */
export declare function unlockTable(connection: IAbapConnection, tableName: string, lockHandle: string): Promise<IAdtResponse>;
/**
 * Delete table lock (cleanup)
 */
export declare function deleteTableLock(connection: IAbapConnection, tableName: string): Promise<IAdtResponse>;
//# sourceMappingURL=unlock.d.ts.map