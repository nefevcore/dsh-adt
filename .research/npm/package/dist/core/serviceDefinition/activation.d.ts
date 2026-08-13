/**
 * ServiceDefinition activation operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Parse activation response
 */
/**
 * Activate service definition
 * Makes service definition active and usable in SAP system
 */
export declare function activateServiceDefinition(connection: IAbapConnection, serviceDefinitionName: string): Promise<IAdtResponse>;
//# sourceMappingURL=activation.d.ts.map