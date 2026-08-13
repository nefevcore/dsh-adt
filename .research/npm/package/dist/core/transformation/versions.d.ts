import type { IAbapConnection, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { ITransformationConfig } from './types';
export declare function getTransformationVersions(connection: IAbapConnection, config: Partial<ITransformationConfig>): Promise<IObjectVersion[]>;
export declare function getTransformationVersionSource(connection: IAbapConnection, contentUri: string): Promise<string>;
//# sourceMappingURL=versions.d.ts.map