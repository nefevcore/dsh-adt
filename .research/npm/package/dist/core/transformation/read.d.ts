import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
/**
 * Get transformation metadata
 */
export declare function getTransformation(connection: IAbapConnection, transformationName: string, version?: 'active' | 'inactive' | 'workingArea', options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
/**
 * Get transformation source code
 */
export declare function getTransformationSource(connection: IAbapConnection, transformationName: string, version?: 'active' | 'inactive' | 'workingArea', options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
/**
 * Get transformation transport info
 */
export declare function getTransformationTransport(connection: IAbapConnection, transformationName: string, options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map