/**
 * ADT discovery endpoint access
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IGetDiscoveryParams } from './types';
/**
 * Fetch ADT discovery document (endpoint catalog)
 *
 * @param connection - ABAP connection
 * @param params - Optional request/timeout options
 * @returns Discovery XML response
 */
export declare function getDiscovery(connection: IAbapConnection, params?: IGetDiscoveryParams): Promise<IAdtResponse>;
//# sourceMappingURL=discovery.d.ts.map