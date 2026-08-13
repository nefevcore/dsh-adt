/**
 * Class create operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import type { IAdtContentTypes } from '../shared/contentTypes';
import type { ICreateClassParams } from './types';
/**
 * Low-level: Create class object with metadata (POST)
 * Does NOT lock/upload/activate - just creates the object
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export declare function create(connection: IAbapConnection, args: ICreateClassParams, logger?: ILogger, contentTypes?: IAdtContentTypes): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map