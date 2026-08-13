/**
 * Create Metadata Extension (DDLX)
 *
 * Endpoint: POST /sap/bc/adt/ddic/ddlx/sources
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IMetadataExtensionCreateParams } from './types';
/**
 * Create a new metadata extension (DDLX)
 *
 * @param connection - ABAP connection instance
 * @param params - Creation parameters
 * @param sessionId - Session ID for request tracking
 * @returns Axios response with created metadata extension details
 *
 * @example
 * ```typescript
 * const response = await createMetadataExtension(connection, {
 *   name: 'ZDEMO_C_CDS_MDE',
 *   description: 'First metadata extension',
 *   packageName: 'ZDEMO_PKG',
 *   transportRequest: 'TRLK900123'
 * }, sessionId);
 * ```
 */
export declare function createMetadataExtension(connection: IAbapConnection, params: IMetadataExtensionCreateParams): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map