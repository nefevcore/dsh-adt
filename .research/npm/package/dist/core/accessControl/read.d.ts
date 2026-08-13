import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
/**
 * Get access control metadata
 */
export declare function getAccessControl(connection: IAbapConnection, accessControlName: string, version?: 'active' | 'inactive' | 'workingArea', options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
/**
 * Get access control source code
 */
export declare function getAccessControlSource(connection: IAbapConnection, accessControlName: string, version?: 'active' | 'inactive' | 'workingArea', options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
/**
 * Get access control transport info
 */
export declare function getAccessControlTransport(connection: IAbapConnection, accessControlName: string, options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map