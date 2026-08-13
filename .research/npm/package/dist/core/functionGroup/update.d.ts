/**
 * FunctionGroup update operations
 *
 * Note: Function groups are containers for function modules.
 * They don't have source code to update directly, but metadata can be updated.
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IAdtContentTypes } from '../shared/contentTypes';
import type { IUpdateFunctionGroupParams } from './types';
/**
 * Update function group metadata (description)
 * Full workflow: lock -> get current -> update -> unlock
 */
export declare function updateFunctionGroup(connection: IAbapConnection, params: IUpdateFunctionGroupParams, contentTypes?: IAdtContentTypes): Promise<IAdtResponse>;
//# sourceMappingURL=update.d.ts.map