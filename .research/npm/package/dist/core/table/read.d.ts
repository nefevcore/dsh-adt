/**
 * Table read operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
/**
 * Get ABAP table metadata (without source code)
 */
export declare function getTableMetadata(connection: IAbapConnection, tableName: string, options?: IReadOptions): Promise<IAdtResponse>;
/**
 * Get ABAP table source code (DDL)
 */
export declare function getTableSource(connection: IAbapConnection, tableName: string, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IAdtResponse>;
/**
 * Get ABAP table (source code by default for backward compatibility)
 * @deprecated Use getTableSource() or getTableMetadata() instead
 */
export declare function getTable(connection: IAbapConnection, tableName: string): Promise<IAdtResponse>;
/**
 * Get transport request for ABAP table
 * @param connection - SAP connection
 * @param tableName - Table name
 * @returns Transport request information
 */
export declare function getTableTransport(connection: IAbapConnection, tableName: string, options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map