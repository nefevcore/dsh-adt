import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IDdlConfig } from './types';
export declare function getDdlVersions(connection: IAbapConnection, config: Partial<IDdlConfig>): Promise<IObjectVersion[]>;
export declare function getDdlVersionSource(connection: IAbapConnection, contentUri: string): Promise<string>;
//# sourceMappingURL=versions.d.ts.map