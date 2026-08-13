import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IMetadataExtensionConfig } from './types';
export declare function getMetadataExtensionVersions(connection: IAbapConnection, config: Partial<IMetadataExtensionConfig>): Promise<IObjectVersion[]>;
export declare function getMetadataExtensionVersionSource(connection: IAbapConnection, contentUri: string): Promise<string>;
//# sourceMappingURL=versions.d.ts.map