/**
 * FunctionModule read operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
/**
 * Get ABAP function module metadata (without source code)
 */
export declare function getFunctionMetadata(connection: IAbapConnection, functionName: string, functionGroup: string, options?: IReadOptions): Promise<IAdtResponse>;
/**
 * Get ABAP function module source code
 * @param connection - SAP connection
 * @param functionName - Function module name
 * @param functionGroup - Function group name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export declare function getFunctionSource(connection: IAbapConnection, functionName: string, functionGroup: string, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IAdtResponse>;
/**
 * Get ABAP function module (source code by default for backward compatibility)
 * @deprecated Use getFunctionSource() or getFunctionMetadata() instead
 */
export declare function getFunction(connection: IAbapConnection, functionName: string, functionGroup: string, version?: 'active' | 'inactive'): Promise<IAdtResponse>;
/**
 * Get transport request for ABAP function module
 * @param connection - SAP connection
 * @param functionName - Function module name
 * @param functionGroup - Function group name
 * @returns Transport request information
 */
export declare function getFunctionModuleTransport(connection: IAbapConnection, functionName: string, functionGroup: string, options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map