import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IServiceDefinitionConfig } from './types';
export declare function getServiceDefinitionVersions(connection: IAbapConnection, config: Partial<IServiceDefinitionConfig>): Promise<IObjectVersion[]>;
export declare function getServiceDefinitionVersionSource(connection: IAbapConnection, contentUri: string): Promise<string>;
//# sourceMappingURL=versions.d.ts.map