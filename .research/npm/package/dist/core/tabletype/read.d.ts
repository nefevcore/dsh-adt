/**
 * TableType read operations
 */
import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
/**
 * Get ABAP table type metadata (without source code)
 */
export declare function getTableTypeMetadata(connection: IAbapConnection, tableTypeName: string, options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
/**
 * Get ABAP table type source code (DDL)
 */
export declare function getTableTypeSource(connection: IAbapConnection, tableTypeName: string, version?: 'active' | 'inactive', options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
/**
 * Get ABAP table type (source code by default for backward compatibility)
 * @deprecated Use getTableTypeSource() or getTableTypeMetadata() instead
 */
export declare function getTableType(connection: IAbapConnection, tableTypeName: string): Promise<IAdtResponse>;
/**
 * Get transport request for ABAP table type
 * @param connection - SAP connection
 * @param tableTypeName - Table type name
 * @returns Transport request information
 */
export declare function getTableTypeTransport(connection: IAbapConnection, tableTypeName: string, options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map