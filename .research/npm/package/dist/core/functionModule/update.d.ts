/**
 * FunctionModule update operations - low-level functions for AdtFunctionModule
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IAdtContentTypes } from '../shared/contentTypes';
import type { IUpdateFunctionModuleParams } from './types';
/**
 * Upload function module source code (low-level - uses existing lockHandle)
 * This function does NOT lock/unlock - it assumes the object is already locked
 * Used internally by AdtFunctionModule
 */
export declare function update(connection: IAbapConnection, params: IUpdateFunctionModuleParams, contentTypes?: IAdtContentTypes): Promise<IAdtResponse>;
//# sourceMappingURL=update.d.ts.map