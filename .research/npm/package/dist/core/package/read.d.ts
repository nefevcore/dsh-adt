/**
 * Package read operations
 */
import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
/**
 * Get ABAP package
 */
export declare function getPackage(connection: IAbapConnection, packageName: string, version?: 'active' | 'inactive', options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
/**
 * Get transport request for ABAP package
 * @param connection - SAP connection
 * @param packageName - Package name
 * @returns Transport request information
 */
export declare function getPackageTransport(connection: IAbapConnection, packageName: string, options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map