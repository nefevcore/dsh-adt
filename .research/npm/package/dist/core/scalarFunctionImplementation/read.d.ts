import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
export declare function getScalarFunctionImplementation(connection: IAbapConnection, name: string, version?: 'active' | 'inactive', options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
export declare function getScalarFunctionImplementationSource(connection: IAbapConnection, name: string, version?: 'active' | 'inactive', options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
export declare function getScalarFunctionImplementationTransport(connection: IAbapConnection, name: string, options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map