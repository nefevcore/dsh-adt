/**
 * Structure validation
 * Uses ADT validation endpoint: /sap/bc/adt/ddic/structures/validation
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Validate structure name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/ddic/structures/validation
 *
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <exc:exception> with message about existing object or validation failure
 */
export declare function validateStructureName(connection: IAbapConnection, structureName: string, description?: string): Promise<IAdtResponse>;
//# sourceMappingURL=validation.d.ts.map