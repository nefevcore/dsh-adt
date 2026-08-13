import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IBehaviorDefinitionConfig } from './types';
export declare function getBehaviorDefinitionVersions(connection: IAbapConnection, config: Partial<IBehaviorDefinitionConfig>): Promise<IObjectVersion[]>;
export declare function getBehaviorDefinitionVersionSource(connection: IAbapConnection, contentUri: string): Promise<string>;
//# sourceMappingURL=versions.d.ts.map