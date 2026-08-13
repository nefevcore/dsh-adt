import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { ITableTypeConfig } from './types';
export declare function getTableTypeVersions(connection: IAbapConnection, config: Partial<ITableTypeConfig>): Promise<IObjectVersion[]>;
export declare function getTableTypeVersionSource(connection: IAbapConnection, contentUri: string): Promise<string>;
//# sourceMappingURL=versions.d.ts.map