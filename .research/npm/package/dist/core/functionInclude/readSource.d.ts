/**
 * FunctionInclude (FUGR/I) source read operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Read function include source code.
 */
export declare function readFunctionIncludeSource(connection: IAbapConnection, groupName: string, includeName: string, version?: 'active' | 'inactive'): Promise<IAdtResponse>;
//# sourceMappingURL=readSource.d.ts.map