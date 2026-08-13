import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IStructureConfig } from './types';
export declare function getStructureVersions(connection: IAbapConnection, config: Partial<IStructureConfig>): Promise<IObjectVersion[]>;
export declare function getStructureVersionSource(connection: IAbapConnection, contentUri: string): Promise<string>;
//# sourceMappingURL=versions.d.ts.map