/**
 * ServiceDefinition create operations - Low-level functions
 * NOTE: Caller should call connection.setSessionType("stateful") before creating
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { ICreateServiceDefinitionParams } from './types';
/**
 * Low-level: Create service definition (POST)
 * Does NOT activate - just creates the object
 */
export declare function create(connection: IAbapConnection, args: ICreateServiceDefinitionParams): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map