/**
 * ServiceDefinition unlock operations
 * NOTE: Caller should call connection.setSessionType("stateless") after unlocking
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Unlock service definition
 * Must use same session and lock handle from lock operation
 */
export declare function unlockServiceDefinition(connection: IAbapConnection, serviceDefinitionName: string, lockHandle: string): Promise<IAdtResponse>;
//# sourceMappingURL=unlock.d.ts.map