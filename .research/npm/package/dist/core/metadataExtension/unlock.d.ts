/**
 * Unlock Metadata Extension (DDLX)
 *
 * Endpoint: POST /sap/bc/adt/ddic/ddlx/sources/{name}?_action=UNLOCK&lockHandle={lockHandle}
 *
 * NOTE: Caller should call connection.setSessionType("stateless") after unlocking
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Unlock a metadata extension after editing
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZDEMO_C_CDS_MDE')
 * @param lockHandle - Lock handle obtained from lockMetadataExtension
 * @returns Axios response
 *
 * @example
 * ```typescript
 * await unlockMetadataExtension(connection, 'ZDEMO_C_CDS_MDE', lockHandle);
 * connection.setSessionType("stateless");
 * ```
 */
export declare function unlockMetadataExtension(connection: IAbapConnection, name: string, lockHandle: string): Promise<IAdtResponse>;
//# sourceMappingURL=unlock.d.ts.map