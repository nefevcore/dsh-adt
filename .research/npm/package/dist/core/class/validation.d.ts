/**
 * Class validation
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Validate class name and superclass
 * Uses ADT validation endpoint: /sap/bc/adt/oo/validation/objectname
 */
/**
 * Validate class name and superclass
 * Uses ADT validation endpoint: /sap/bc/adt/oo/validation/objectname
 * Returns raw response from ADT - consumer decides how to interpret it
 */
export declare function validateClassName(connection: IAbapConnection, className: string, packageName?: string, description?: string, superClass?: string): Promise<IAdtResponse>;
/**
 * Validate class source code.
 *
 * If sourceCode is provided: validates unsaved code (live validation with artifacts)
 * If sourceCode is not provided: validates existing class code in SAP system (without artifacts)
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param sourceCode - Optional: source code to validate. If omitted, validates existing class in SAP
 * @param version - 'active' (default) or 'inactive' - version context for validation
 * @param sessionId - Optional session ID
 * @returns Check result with errors/warnings
 * @throws Error if validation finds syntax errors
 */
export declare function validateClassSource(connection: IAbapConnection, className: string, sourceCode?: string, version?: 'inactive' | 'active'): Promise<IAdtResponse>;
//# sourceMappingURL=validation.d.ts.map