/**
 * AuthorizationField (SUSO / AUTH) name validation
 * Endpoint: POST /sap/bc/adt/aps/iam/auth/validation
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Validate authorization field name against SAP naming rules.
 * Returns raw response — consumer interprets SEVERITY/SHORT_TEXT fields.
 */
export declare function validateAuthorizationFieldName(connection: IAbapConnection, name: string, packageName?: string, description?: string): Promise<IAdtResponse>;
//# sourceMappingURL=validation.d.ts.map