/**
 * Service Definition validation
 * Uses ADT validation endpoint: /sap/bc/adt/ddic/srvd/sources/validation
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Validate service definition name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/ddic/srvd/sources/validation
 *
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <CHECK_RESULT/> or error response
 */
export declare function validateServiceDefinitionName(connection: IAbapConnection, serviceDefinitionName: string, description?: string): Promise<IAdtResponse>;
//# sourceMappingURL=validation.d.ts.map