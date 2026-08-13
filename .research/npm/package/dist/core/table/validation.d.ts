/**
 * Table validation
 * Uses ADT validation endpoint: /sap/bc/adt/ddic/tables/validation
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Validate table name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/ddic/tables/validation
 *
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <exc:exception> with message about existing object or validation failure
 */
export declare function validateTableName(connection: IAbapConnection, tableName: string, description?: string): Promise<IAdtResponse>;
//# sourceMappingURL=validation.d.ts.map