/**
 * Table lock operations
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
/**
 * Acquire lock handle for the table by locking it for modification
 */
export declare function acquireTableLockHandle(connection: IAbapConnection, tableName: string): Promise<string>;
//# sourceMappingURL=lock.d.ts.map