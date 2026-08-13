/**
 * Transport list operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IListTransportsParams } from './types';
/**
 * List ABAP transport requests
 *
 * Calls GET /sap/bc/adt/cts/transportrequests with query parameters.
 * Goes through standard connection.makeAdtRequest() so Accept negotiation works.
 */
export declare function listTransports(connection: IAbapConnection, params: IListTransportsParams): Promise<IAdtResponse>;
//# sourceMappingURL=list.d.ts.map