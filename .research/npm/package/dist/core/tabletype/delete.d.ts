/**
 * TableType delete operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IDeleteTableTypeParams } from './types';
/**
 * Low-level: Check if table type can be deleted
 */
export declare function checkDeletion(connection: IAbapConnection, params: IDeleteTableTypeParams): Promise<IAdtResponse>;
/**
 * Low-level: Delete table type
 */
export declare function deleteTableType(connection: IAbapConnection, params: IDeleteTableTypeParams): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map