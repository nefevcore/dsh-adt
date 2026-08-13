/**
 * FunctionGroup check operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Check function group code (syntax, compilation, rules)
 *
 * CheckRun validates everything: syntax, compilation errors, warnings, code quality rules.
 *
 * Can check:
 * - Existing active function group: provide functionGroupName, version='active', omit sourceCode
 * - Existing inactive function group: provide functionGroupName, version='inactive', omit sourceCode
 * - Hypothetical code: provide functionGroupName, sourceCode, version (object doesn't need to exist)
 *
 * @param connection - SAP connection
 * @param functionGroupName - Function group name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param sourceCode - Optional: source code to validate. If provided, validates hypothetical code without creating object
 * @returns Check result with errors/warnings
 */
export declare function checkFunctionGroup(connection: IAbapConnection, functionGroupName: string, version: 'active' | 'inactive', sourceCode?: string): Promise<IAdtResponse>;
//# sourceMappingURL=check.d.ts.map