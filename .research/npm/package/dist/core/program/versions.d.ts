import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IProgramConfig } from './types';
export declare function getProgramVersions(connection: IAbapConnection, config: Partial<IProgramConfig>): Promise<IObjectVersion[]>;
export declare function getProgramVersionSource(connection: IAbapConnection, contentUri: string): Promise<string>;
//# sourceMappingURL=versions.d.ts.map