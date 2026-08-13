/**
 * Function Group validation
 * Uses ADT validation endpoint: /sap/bc/adt/functions/validation
 * Matches Eclipse ADT behavior for on-premise and cloud systems
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Validate function group name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/functions/validation
 * (same endpoint for both function groups and function modules)
 *
 * Response format:
 * - Success: <SEVERITY>OK</SEVERITY>
 * - Error: <SEVERITY>ERROR</SEVERITY> with <SHORT_TEXT> message (e.g., "Function group ... already exists")
 */
export declare function validateFunctionGroupName(connection: IAbapConnection, functionGroupName: string, packageName?: string, description?: string): Promise<IAdtResponse>;
//# sourceMappingURL=validation.d.ts.map