/**
 * FunctionModule check operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IAdtContentTypes } from '../shared/contentTypes';
/**
 * Check function module code (syntax, compilation, rules)
 *
 * CheckRun validates everything: syntax, compilation errors, warnings, code quality rules.
 *
 * Can check:
 * - Existing active function module: provide functionGroupName, functionModuleName, version='active'
 * - Existing inactive function module: provide functionGroupName, functionModuleName, version='inactive'
 *
 * @param connection - SAP connection
 * @param functionGroupName - Function group name
 * @param functionModuleName - Function module name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param sourceCode - Optional source code to validate
 * @returns Check result with errors/warnings
 */
export declare function checkFunctionModule(connection: IAbapConnection, functionGroupName: string, functionModuleName: string, version: 'active' | 'inactive', sourceCode?: string, contentTypes?: IAdtContentTypes): Promise<IAdtResponse>;
//# sourceMappingURL=check.d.ts.map