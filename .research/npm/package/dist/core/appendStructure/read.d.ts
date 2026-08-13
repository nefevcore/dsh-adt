import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
export declare function getAppendStructure(connection: IAbapConnection, name: string, version?: 'active' | 'inactive', options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
export declare function getAppendStructureSource(connection: IAbapConnection, name: string, version?: 'active' | 'inactive', options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
export declare function getAppendStructureTransport(connection: IAbapConnection, name: string, options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map