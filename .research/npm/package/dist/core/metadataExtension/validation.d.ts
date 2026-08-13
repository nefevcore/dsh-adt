/**
 * Metadata Extension Validation
 *
 * Validates parameters before creating a metadata extension (DDLX)
 * Uses ADT validation endpoint: /sap/bc/adt/ddic/ddlx/sources/validation
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IMetadataExtensionValidationParams } from './types';
/**
 * Validate metadata extension parameters
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/ddic/ddlx/sources/validation
 *
 * @param connection - ABAP connection instance
 * @param params - Validation parameters
 * @returns Raw IAdtResponse from ADT validation endpoint (returns error response if object already exists)
 *
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <exc:exception> with message about existing object or validation failure
 */
export declare function validateMetadataExtension(connection: IAbapConnection, params: IMetadataExtensionValidationParams): Promise<IAdtResponse>;
//# sourceMappingURL=validation.d.ts.map