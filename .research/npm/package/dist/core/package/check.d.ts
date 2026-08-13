/**
 * Package check operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Check package for errors
 *
 * @param connection - SAP connection
 * @param packageName - Package name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param xmlContent - Optional XML content to validate (same format as PUT body). If provided, check validates this content instead of saved version.
 * @returns Check result
 *
 * Note: When xmlContent is provided, it should be the same XML that will be sent in PUT request.
 */
export declare function checkPackage(connection: IAbapConnection, packageName: string, version?: 'active' | 'inactive', xmlContent?: string): Promise<IAdtResponse>;
//# sourceMappingURL=check.d.ts.map