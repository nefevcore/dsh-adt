/**
 * ServiceDefinition update operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IUpdateServiceDefinitionParams } from './types';
/**
 * Update service definition source code
 * Requires object to be locked first (lockHandle must be provided)
 */
export declare function updateServiceDefinition(connection: IAbapConnection, args: IUpdateServiceDefinitionParams, lockHandle: string): Promise<IAdtResponse>;
//# sourceMappingURL=update.d.ts.map