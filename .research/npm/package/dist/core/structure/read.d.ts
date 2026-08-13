/**
 * Structure read operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
/**
 * Get ABAP structure metadata (without source code)
 */
export declare function getStructureMetadata(connection: IAbapConnection, structureName: string, options?: IReadOptions): Promise<IAdtResponse>;
/**
 * Get ABAP structure source code
 */
export declare function getStructureSource(connection: IAbapConnection, structureName: string, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IAdtResponse>;
/**
 * Get ABAP structure (source code by default for backward compatibility)
 * @deprecated Use getStructureSource() or getStructureMetadata() instead
 */
export declare function getStructure(connection: IAbapConnection, structureName: string): Promise<IAdtResponse>;
/**
 * Get transport request for ABAP structure
 * @param connection - SAP connection
 * @param structureName - Structure name
 * @returns Transport request information
 */
export declare function getStructureTransport(connection: IAbapConnection, structureName: string, options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map