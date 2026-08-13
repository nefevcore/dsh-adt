import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { ITableConfig } from './types';
export declare function getTableVersions(connection: IAbapConnection, config: Partial<ITableConfig>): Promise<IObjectVersion[]>;
export declare function getTableVersionSource(connection: IAbapConnection, contentUri: string): Promise<string>;
//# sourceMappingURL=versions.d.ts.map