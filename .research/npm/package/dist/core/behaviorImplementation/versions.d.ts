import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IBehaviorImplementationConfig } from './types';
export declare function getBehaviorImplementationVersions(connection: IAbapConnection, config: Partial<IBehaviorImplementationConfig>): Promise<IObjectVersion[]>;
export declare function getBehaviorImplementationVersionSource(connection: IAbapConnection, contentUri: string): Promise<string>;
//# sourceMappingURL=versions.d.ts.map