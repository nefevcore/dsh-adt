/**
 * FunctionModule delete operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IDeleteFunctionModuleParams } from './types';
/**
 * Low-level: Check if function module can be deleted
 */
export declare function checkDeletion(connection: IAbapConnection, params: IDeleteFunctionModuleParams): Promise<IAdtResponse>;
/**
 * Low-level: Delete function module
 */
export declare function deleteFunctionModule(connection: IAbapConnection, params: IDeleteFunctionModuleParams): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map