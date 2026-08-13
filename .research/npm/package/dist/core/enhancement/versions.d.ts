import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import { type IEnhancementConfig } from './types';
export declare function getEnhancementVersions(connection: IAbapConnection, config: Partial<IEnhancementConfig>): Promise<IObjectVersion[]>;
export declare function getEnhancementVersionSource(connection: IAbapConnection, contentUri: string): Promise<string>;
//# sourceMappingURL=versions.d.ts.map