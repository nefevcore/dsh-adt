/**
 * Program create operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IAdtContentTypes } from '../shared/contentTypes';
import type { ICreateProgramParams } from './types';
/**
 * Low-level: Create program object with metadata (POST)
 * Does NOT lock/upload/activate - just creates the object
 */
export declare function create(connection: IAbapConnection, args: ICreateProgramParams, contentTypes?: IAdtContentTypes): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map