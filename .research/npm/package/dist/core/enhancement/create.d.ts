/**
 * Enhancement create operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import { type ICreateEnhancementParams } from './types';
/**
 * Low-level: Create enhancement object with metadata (POST)
 * Does NOT lock/upload/activate - just creates the object
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 *
 * @param connection - SAP connection
 * @param args - Create parameters
 * @returns Axios response
 */
export declare function create(connection: IAbapConnection, args: ICreateEnhancementParams, logger?: ILogger): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map