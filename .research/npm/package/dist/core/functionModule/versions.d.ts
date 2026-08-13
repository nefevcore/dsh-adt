import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IFunctionModuleConfig } from './types';
export declare function getFunctionModuleVersions(connection: IAbapConnection, config: Partial<IFunctionModuleConfig>): Promise<IObjectVersion[]>;
export declare function getFunctionModuleVersionSource(connection: IAbapConnection, contentUri: string): Promise<string>;
//# sourceMappingURL=versions.d.ts.map