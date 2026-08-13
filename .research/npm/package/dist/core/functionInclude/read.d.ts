/**
 * FunctionInclude (FUGR/I) read operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
export interface IReadOptions {
    withLongPolling?: boolean;
}
/**
 * Read a function include (metadata only, no source).
 */
export declare function readFunctionInclude(connection: IAbapConnection, groupName: string, includeName: string, version?: 'active' | 'inactive', _options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map