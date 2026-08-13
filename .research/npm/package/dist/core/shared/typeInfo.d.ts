/**
 * Type information operations for ABAP objects
 *
 * Retrieves type information (domain, data element, table type) with fallback chain.
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Get type information with fallback chain
 *
 * Tries multiple endpoints in order:
 * 1. Domain: `/sap/bc/adt/ddic/domains/{name}/source/main`
 * 2. Data Element: `/sap/bc/adt/ddic/dataelements/{name}`
 * 3. Table Type: `/sap/bc/adt/ddic/tabletypes/{name}`
 * 4. Fallback: `/sap/bc/adt/repository/informationsystem/objectproperties/values?uri={uri}`
 *
 * @param connection - ABAP connection instance
 * @param typeName - Type name to look up
 * @returns Axios response with type information (XML)
 *
 * @example
 * ```typescript
 * const response = await getTypeInfo(connection, 'ZMY_TYPE');
 * // Response contains XML with type information
 * ```
 */
export declare function getTypeInfo(connection: IAbapConnection, typeName: string): Promise<IAdtResponse>;
//# sourceMappingURL=typeInfo.d.ts.map