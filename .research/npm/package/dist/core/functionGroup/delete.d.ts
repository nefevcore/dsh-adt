/**
 * FunctionGroup delete operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IDeleteFunctionGroupParams } from './types';
/**
 * Low-level: Check if function group can be deleted
 */
export declare function checkDeletion(connection: IAbapConnection, params: IDeleteFunctionGroupParams): Promise<IAdtResponse>;
/**
 * Low-level: Delete function group
 */
export declare function deleteFunctionGroup(connection: IAbapConnection, params: IDeleteFunctionGroupParams): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map