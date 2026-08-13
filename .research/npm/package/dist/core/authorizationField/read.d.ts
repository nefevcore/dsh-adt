/**
 * AuthorizationField (SUSO / AUTH) read operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
export interface IReadOptions {
    withLongPolling?: boolean;
}
/**
 * Read an authorization field (metadata-only, no source).
 */
export declare function readAuthorizationField(connection: IAbapConnection, name: string, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map