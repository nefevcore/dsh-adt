/**
 * Function Module validation
 * Uses ADT validation endpoint: /sap/bc/adt/functions/validation
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Validate function module name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/functions/validation
 *
 * Query parameters:
 * - objtype: FUGR/FF
 * - objname: function module name
 * - fugrname: function group name
 * - description: optional description
 *
 * Response format:
 * - Success: <SEVERITY>OK</SEVERITY>
 * - Error: <SEVERITY>ERROR</SEVERITY> with <SHORT_TEXT> message (e.g., "Function module ... already exists")
 */
export declare function validateFunctionModuleName(connection: IAbapConnection, functionGroupName: string, functionModuleName: string, description?: string): Promise<IAdtResponse>;
/**
 * Validate function module source code.
 *
 * If sourceCode is provided: validates unsaved code (live validation with artifacts)
 * If sourceCode is not provided: validates existing FM code in SAP system (without artifacts)
 *
 * @param connection - SAP connection
 * @param functionGroupName - Function group name
 * @param functionModuleName - Function module name
 * @param sourceCode - Optional: source code to validate. If omitted, validates existing FM in SAP
 * @param version - 'active' (default) or 'inactive' - version context for validation
 * @param sessionId - Optional session ID
 * @returns Check result with errors/warnings
 * @throws Error if validation finds syntax errors
 */
export declare function validateFunctionModuleSource(connection: IAbapConnection, functionGroupName: string, functionModuleName: string, sourceCode?: string, version?: 'inactive' | 'active'): Promise<IAdtResponse>;
//# sourceMappingURL=validation.d.ts.map