/**
 * FunctionGroup create operations
 */
import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import type { IAdtContentTypes } from '../shared/contentTypes';
import type { ICreateFunctionGroupParams } from './types';
/**
 * Create function group metadata via POST
 * Low-level function - creates function group without workflow logic
 */
export declare function create(connection: IAbapConnection, params: ICreateFunctionGroupParams, logger?: ILogger, contentTypes?: IAdtContentTypes): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map