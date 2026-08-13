/**
 * Program validation
 * Uses ADT validation endpoint: /sap/bc/adt/programs/validation
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Validate program name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/programs/validation
 *
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <exc:exception> with message about existing object or validation failure
 */
export declare function validateProgramName(connection: IAbapConnection, programName: string, description?: string, packageName?: string): Promise<IAdtResponse>;
//# sourceMappingURL=validation.d.ts.map