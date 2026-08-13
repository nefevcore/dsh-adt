/**
 * View read operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
/**
 * Get ABAP view metadata (without source code)
 */
export declare function getDdlMetadata(connection: IAbapConnection, ddlName: string, options?: IReadOptions): Promise<IAdtResponse>;
/**
 * Get ABAP view source code
 */
export declare function getDdlSource(connection: IAbapConnection, ddlName: string, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IAdtResponse>;
/**
 * Get ABAP view (source code by default for backward compatibility)
 * @deprecated Use getDdlSource() or getDdlMetadata() instead
 */
export declare function getDdl(connection: IAbapConnection, ddlName: string): Promise<IAdtResponse>;
/**
 * Get transport request for ABAP view
 * @param connection - SAP connection
 * @param ddlName - View name
 * @returns Transport request information
 */
export declare function getDdlTransport(connection: IAbapConnection, ddlName: string, options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map