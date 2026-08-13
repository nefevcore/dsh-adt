import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IAccessControlConfig } from './types';
export declare function getAccessControlVersions(connection: IAbapConnection, config: Partial<IAccessControlConfig>): Promise<IObjectVersion[]>;
export declare function getAccessControlVersionSource(connection: IAbapConnection, contentUri: string): Promise<string>;
//# sourceMappingURL=versions.d.ts.map