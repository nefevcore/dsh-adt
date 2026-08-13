/**
 * Activate Metadata Extension (DDLX)
 *
 * Endpoint: POST /sap/bc/adt/activation?method=activate&preauditRequested=true
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Activate a metadata extension
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZDEMO_C_CDS_MDE')
 * @param sessionId - Session ID for request tracking
 * @param preaudit - Request pre-audit before activation (default: true)
 * @returns Axios response with activation result
 *
 * @example
 * ```typescript
 * await activateMetadataExtension(connection, 'ZDEMO_C_CDS_MDE', sessionId);
 * ```
 */
export declare function activateMetadataExtension(connection: IAbapConnection, name: string, preaudit?: boolean): Promise<IAdtResponse>;
//# sourceMappingURL=activate.d.ts.map