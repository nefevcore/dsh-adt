/**
 * ServiceDefinition read operations
 */
import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
/**
 * Get ABAP service definition
 */
export declare function getServiceDefinition(connection: IAbapConnection, serviceDefinitionName: string, version?: 'active' | 'inactive' | 'workingArea', options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
/**
 * Get service definition source code
 */
export declare function getServiceDefinitionSource(connection: IAbapConnection, serviceDefinitionName: string, version?: 'active' | 'inactive' | 'workingArea', options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
/**
 * Get transport request for ABAP service definition
 * @param connection - SAP connection
 * @param serviceDefinitionName - Service definition name
 * @returns Transport request information
 */
export declare function getServiceDefinitionTransport(connection: IAbapConnection, serviceDefinitionName: string, options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map