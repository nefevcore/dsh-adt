/**
 * Lock Metadata Extension (DDLX) for editing
 *
 * Endpoint: POST /sap/bc/adt/ddic/ddlx/sources/{name}?_action=LOCK&accessMode=MODIFY
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
/**
 * Lock a metadata extension for modification
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZDEMO_C_CDS_MDE')
 * @param sessionId - Session ID for request tracking
 * @returns Lock handle string
 *
 * @example
 * ```typescript
 * const lockHandle = await lockMetadataExtension(connection, 'ZDEMO_C_CDS_MDE', sessionId);
 * ```
 */
export declare function lockMetadataExtension(connection: IAbapConnection, name: string): Promise<string>;
//# sourceMappingURL=lock.d.ts.map