/**
 * FunctionGroup read operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
/**
 * Get ABAP function group
 */
export declare function getFunctionGroup(connection: IAbapConnection, functionGroupName: string, options?: IReadOptions): Promise<IAdtResponse>;
/**
 * Get transport request for ABAP function group
 * @param connection - SAP connection
 * @param functionGroupName - Function group name
 * @returns Transport request information
 */
export declare function getFunctionGroupTransport(connection: IAbapConnection, functionGroupName: string, options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map