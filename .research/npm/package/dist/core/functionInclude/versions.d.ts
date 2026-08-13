import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IFunctionIncludeConfig } from './types';
export declare function getFunctionIncludeVersions(connection: IAbapConnection, config: Partial<IFunctionIncludeConfig>): Promise<IObjectVersion[]>;
export declare function getFunctionIncludeVersionSource(connection: IAbapConnection, contentUri: string): Promise<string>;
//# sourceMappingURL=versions.d.ts.map