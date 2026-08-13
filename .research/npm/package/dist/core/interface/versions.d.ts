import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IInterfaceConfig } from './types';
export declare function getInterfaceVersions(connection: IAbapConnection, config: Partial<IInterfaceConfig>): Promise<IObjectVersion[]>;
export declare function getInterfaceVersionSource(connection: IAbapConnection, contentUri: string): Promise<string>;
//# sourceMappingURL=versions.d.ts.map