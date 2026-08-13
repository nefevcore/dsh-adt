/**
 * FunctionModule create operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { ICreateFunctionModuleParams } from './types';
/**
 * Create function module metadata
 * Low-level function - creates metadata without workflow logic
 */
export declare function create(connection: IAbapConnection, params: ICreateFunctionModuleParams): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map