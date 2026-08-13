import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IScalarFunctionImplementationConfig } from './types';
export declare function getScalarFunctionImplementationVersions(connection: IAbapConnection, config: Partial<IScalarFunctionImplementationConfig>): Promise<IObjectVersion[]>;
export declare function getScalarFunctionImplementationVersionSource(connection: IAbapConnection, contentUri: string): Promise<string>;
//# sourceMappingURL=versions.d.ts.map