/**
 * TableType update operations
 *
 * Uses read-modify-write pattern: GET current XML → patch fields → PUT.
 * This preserves all SAP-managed fields (valueHelps, etc.)
 * that would be lost if XML were built from scratch.
 */
import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import type { IUpdateTableTypeParams } from './types';
/**
 * Update table type using existing lock/session (read-modify-write pattern)
 */
export declare function updateTableType(connection: IAbapConnection, params: IUpdateTableTypeParams, lockHandle: string, logger?: ILogger): Promise<IAdtResponse>;
//# sourceMappingURL=update.d.ts.map