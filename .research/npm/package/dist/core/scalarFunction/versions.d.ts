import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IScalarFunctionConfig } from './types';
export declare function getScalarFunctionVersions(connection: IAbapConnection, config: Partial<IScalarFunctionConfig>): Promise<IObjectVersion[]>;
export declare function getScalarFunctionVersionSource(connection: IAbapConnection, contentUri: string): Promise<string>;
//# sourceMappingURL=versions.d.ts.map