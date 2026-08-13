/**
 * Table update operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IUpdateTableParams } from './types';
/**
 * Update table using existing lock/session (Builder workflow)
 */
export declare function updateTable(connection: IAbapConnection, params: IUpdateTableParams, lockHandle: string): Promise<IAdtResponse>;
//# sourceMappingURL=update.d.ts.map