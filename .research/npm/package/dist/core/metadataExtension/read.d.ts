/**
 * Read Metadata Extension (DDLX)
 *
 * Endpoint: GET /sap/bc/adt/ddic/ddlx/sources/{name}
 * Source: GET /sap/bc/adt/ddic/ddlx/sources/{name}/source/main
 */
import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
/**
 * Read metadata extension metadata
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZDEMO_C_CDS_MDE')
 * @returns Axios response with metadata extension metadata
 *
 * @example
 * ```typescript
 * const metadata = await readMetadataExtension(connection, 'ZDEMO_C_CDS_MDE');
 * ```
 */
export declare function readMetadataExtension(connection: IAbapConnection, name: string, options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
/**
 * Read metadata extension source code
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZDEMO_C_CDS_MDE')
 * @param version - Version to read ('active' or 'inactive', default 'active')
 * @returns Axios response with source code as string
 *
 * @example
 * ```typescript
 * const response = await readMetadataExtensionSource(connection, 'ZDEMO_C_CDS_MDE');
 * const sourceCode = response.data;
 * ```
 */
export declare function readMetadataExtensionSource(connection: IAbapConnection, name: string, version?: 'active' | 'inactive', options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
/**
 * Get transport request for ABAP metadata extension
 * @param connection - SAP connection
 * @param name - Metadata extension name
 * @returns Transport request information
 */
export declare function getMetadataExtensionTransport(connection: IAbapConnection, name: string, options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map