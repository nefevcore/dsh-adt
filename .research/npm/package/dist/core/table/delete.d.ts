/**
 * Table delete operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IDeleteTableParams } from './types';
/**
 * Low-level: Check if table can be deleted
 */
export declare function checkDeletion(connection: IAbapConnection, params: IDeleteTableParams): Promise<IAdtResponse>;
/**
 * Low-level: Delete table
 */
export declare function deleteTable(connection: IAbapConnection, params: IDeleteTableParams): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map