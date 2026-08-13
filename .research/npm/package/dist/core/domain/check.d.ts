/**
 * Domain check operations
 */
import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
/**
 * Check domain syntax
 *
 * @param connection - SAP connection
 * @param domainName - Domain name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param xmlContent - Optional XML content to validate (same format as PUT body). If provided, check validates this content instead of saved version.
 * @returns Check result with errors/warnings
 *
 * Note: When xmlContent is provided, it should be the same XML that will be sent in PUT request.
 */
export declare function checkDomainSyntax(connection: IAbapConnection, domainName: string, version: 'active' | 'inactive', xmlContent?: string, _logger?: ILogger): Promise<IAdtResponse>;
//# sourceMappingURL=check.d.ts.map