/**
 * FunctionInclude (FUGR/I) check operations.
 *
 * Uses /sap/bc/adt/checkruns?reporters=abapCheckRun. When sourceCode is
 * supplied, the unsaved source is attached as a base64 artifact; otherwise
 * the server re-reads the persisted version by URI.
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Check function include via /sap/bc/adt/checkruns?reporters=abapCheckRun.
 */
export declare function checkFunctionInclude(connection: IAbapConnection, groupName: string, includeName: string, version: 'active' | 'inactive', xmlContent?: string, sourceContentType?: string): Promise<IAdtResponse>;
//# sourceMappingURL=check.d.ts.map