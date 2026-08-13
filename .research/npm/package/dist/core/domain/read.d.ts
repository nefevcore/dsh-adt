/**
 * Domain read operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
/**
 * Get ABAP domain
 * @param connection - ABAP connection
 * @param domainName - Domain name
 * @param options - Optional read options
 * @param options.withLongPolling - If true, adds ?withLongPolling=true to wait for object to become available
 *                                  Useful after create/activate operations to wait until object is ready
 */
export declare function getDomain(connection: IAbapConnection, domainName: string, options?: IReadOptions): Promise<IAdtResponse>;
/**
 * Get transport request for ABAP domain
 * @param connection - SAP connection
 * @param domainName - Domain name
 * @param options - Optional read options
 * @param options.withLongPolling - If true, adds ?withLongPolling=true to wait for object to become available
 *                                  Useful after create/activate operations to wait until object is ready
 * @returns Transport request information
 */
export declare function getDomainTransport(connection: IAbapConnection, domainName: string, options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map