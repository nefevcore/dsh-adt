import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IAppendStructureConfig } from './types';
export declare function getAppendStructureVersions(connection: IAbapConnection, config: Partial<IAppendStructureConfig>): Promise<IObjectVersion[]>;
export declare function getAppendStructureVersionSource(connection: IAbapConnection, contentUri: string): Promise<string>;
//# sourceMappingURL=versions.d.ts.map