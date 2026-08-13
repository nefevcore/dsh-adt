/**
 * ServiceDefinition check operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { type CheckRunVersion } from '../../utils/checkRun';
/**
 * Check service definition syntax
 */
export declare function checkServiceDefinition(connection: IAbapConnection, serviceDefinitionName: string, version?: CheckRunVersion, sourceCode?: string): Promise<IAdtResponse>;
//# sourceMappingURL=check.d.ts.map