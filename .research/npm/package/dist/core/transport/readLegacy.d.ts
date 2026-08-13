/**
 * Transport read operations — legacy systems (BASIS < 7.50)
 *
 * Uses /sap/bc/cts/transportrequests instead of /sap/bc/adt/cts/transportrequests
 *
 * Legacy CTS endpoint ignores the transport number in the URL path and always
 * returns the full list of transports for the current user. This function
 * fetches the full list and filters client-side.
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Get ABAP transport request (legacy path)
 *
 * GET /sap/bc/cts/transportrequests always returns the full transport list
 * regardless of the URL path. We filter the XML response client-side to
 * find the requested transport number.
 */
export declare function getTransportLegacy(connection: IAbapConnection, transportNumber: string): Promise<IAdtResponse>;
/**
 * List all transport requests (legacy path)
 *
 * Returns the full transport list for the current user.
 */
export declare function listTransportsLegacy(connection: IAbapConnection): Promise<IAdtResponse>;
//# sourceMappingURL=readLegacy.d.ts.map