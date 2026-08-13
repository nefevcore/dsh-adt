/**
 * Behavior Implementation read operations
 */
import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
/**
 * Get behavior implementation class metadata (without source code)
 * @param connection - SAP connection
 * @param className - Behavior implementation class name
 */
export declare function getBehaviorImplementationMetadata(connection: IAbapConnection, className: string, options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
/**
 * Get behavior implementation class source code (main)
 * @param connection - SAP connection
 * @param className - Behavior implementation class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export declare function getBehaviorImplementationSource(connection: IAbapConnection, className: string, version?: 'active' | 'inactive', options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
/**
 * Get behavior implementation class implementations include source code
 * @param connection - SAP connection
 * @param className - Behavior implementation class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export declare function getBehaviorImplementationImplementations(connection: IAbapConnection, className: string, version?: 'active' | 'inactive' | 'workingArea', options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
/**
 * Get transport request for ABAP behavior implementation class
 * @param connection - SAP connection
 * @param className - Behavior implementation class name
 * @returns Transport request information
 */
export declare function getBehaviorImplementationTransport(connection: IAbapConnection, className: string, options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map