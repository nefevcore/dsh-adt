/**
 * TableType lock operations
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
/**
 * Acquire lock handle for the table type by locking it for modification
 */
export declare function acquireTableTypeLockHandle(connection: IAbapConnection, tableTypeName: string): Promise<string>;
//# sourceMappingURL=lock.d.ts.map