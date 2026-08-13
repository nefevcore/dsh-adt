/**
 * Legacy deletion for older SAP systems (BASIS < 7.50)
 *
 * Uses direct DELETE on the object URL with lockHandle,
 * instead of the modern /sap/bc/adt/deletion/check + /deletion/delete API.
 *
 * Flow: lock → DELETE {objectUrl}?lockHandle=... → unlock on failure
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
/**
 * Delete an ADT object via direct DELETE request.
 * Requires a lock handle obtained from the object's lock function.
 *
 * @param connection - SAP connection
 * @param objectUrl - Full object URL (e.g. /sap/bc/adt/programs/programs/zmy_prog)
 * @param lockHandle - Lock handle from lock operation
 * @param transportRequest - Optional transport request number
 */
export declare function deleteObjectDirect(connection: IAbapConnection, objectUrl: string, lockHandle: string, transportRequest?: string): Promise<import("@mcp-abap-adt/interfaces").IAdtResponse<any, any>>;
//# sourceMappingURL=deleteLegacy.d.ts.map