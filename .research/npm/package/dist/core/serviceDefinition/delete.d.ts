/**
 * ServiceDefinition delete operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IDeleteServiceDefinitionParams } from './types';
/**
 * Low-level: Check if service definition can be deleted
 */
export declare function checkDeletion(connection: IAbapConnection, params: IDeleteServiceDefinitionParams): Promise<IAdtResponse>;
/**
 * Low-level: Delete service definition
 */
export declare function deleteServiceDefinition(connection: IAbapConnection, params: IDeleteServiceDefinitionParams): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map