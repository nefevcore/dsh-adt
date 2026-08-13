/**
 * Where-used operations for ABAP objects
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IGetWhereUsedListParams, IGetWhereUsedParams, IGetWhereUsedScopeParams, IWhereUsedListResult } from './types';
/**
 * Modify where-used scope to enable/disable specific object types
 *
 * @param scopeXml - Scope XML from getWhereUsedScope()
 * @param options - Modification options
 * @returns Modified scope XML
 *
 * @example
 * const scopeResponse = await getWhereUsedScope(connection, { object_name: 'ZMY_CLASS', object_type: 'class' });
 * let scopeXml = scopeResponse.data;
 *
 * // Enable all types
 * scopeXml = modifyWhereUsedScope(scopeXml, { enableAll: true });
 *
 * // Enable specific types only
 * scopeXml = modifyWhereUsedScope(scopeXml, {
 *   enableOnly: ['CLAS/OC', 'INTF/OI', 'FUGR/FF']
 * });
 *
 * // Enable additional types (keeps existing selections)
 * scopeXml = modifyWhereUsedScope(scopeXml, {
 *   enable: ['FUGR/FF', 'TABL/DT']
 * });
 *
 * // Disable specific types
 * scopeXml = modifyWhereUsedScope(scopeXml, {
 *   disable: ['WDYN/YT', 'WAPA/WO']
 * });
 */
export declare function modifyWhereUsedScope(scopeXml: string, options: {
    enableAll?: boolean;
    enableOnly?: string[];
    enable?: string[];
    disable?: string[];
}): string;
/**
 * Get where-used scope configuration (Step 1 of 2)
 *
 * Returns available object types for where-used search.
 * Consumer can modify isSelected attributes before passing to getWhereUsed()
 *
 * @param connection - ABAP connection
 * @param params - Scope parameters
 * @returns Scope configuration XML with available object types
 *
 * @example
 * // Step 1: Get scope
 * const scopeResponse = await getWhereUsedScope(connection, {
 *   object_name: 'ZMY_CLASS',
 *   object_type: 'class'
 * });
 *
 * // Modify scope XML to select/deselect object types
 * let scopeXml = scopeResponse.data;
 * scopeXml = scopeXml.replace(/name="FUGR\/FF" isSelected="false"/, 'name="FUGR/FF" isSelected="true"');
 *
 * // Step 2: Execute search with modified scope
 * const result = await getWhereUsed(connection, {
 *   object_name: 'ZMY_CLASS',
 *   object_type: 'class',
 *   scopeXml: scopeXml
 * });
 */
export declare function getWhereUsedScope(connection: IAbapConnection, params: IGetWhereUsedScopeParams): Promise<IAdtResponse>;
/**
 * Get where-used references for ABAP object
 *
 * Posts directly to /usageReferences (the request the Eclipse ADT client
 * sends). An optional scope can be supplied to narrow the searched object types
 * server-side; when omitted, SAP applies its default scope. This function never
 * calls the /usageReferences/scope sub-resource itself — that resource is not
 * available on every system (see getWhereUsedScope).
 *
 * @param connection - ABAP connection
 * @param params - Where-used parameters
 * @param params.scopeXml - Optional scope XML from getWhereUsedScope(). When omitted, the search runs against SAP's default scope (unscoped).
 * @returns Where-used references
 */
export declare function getWhereUsed(connection: IAbapConnection, params: IGetWhereUsedParams): Promise<IAdtResponse>;
/**
 * Get where-used references with parsed results
 *
 * This is a convenience method that combines scope fetching, search execution,
 * and XML parsing into a single call with structured output.
 *
 * @param connection - ABAP connection
 * @param params - Where-used list parameters
 * @returns Parsed where-used results with references list
 *
 * @example
 * ```typescript
 * // Search every object type (Eclipse 'select all') — may return many results
 * const all = await getWhereUsedList(connection, {
 *   object_name: 'ZMY_TABLE',
 *   object_type: 'table',
 *   enableAllTypes: true
 * });
 *
 * // Or restrict to just the types you care about (e.g. only structures/tables)
 * // so you never get hundreds of classes back. Filtered server-side via the
 * // scope sub-resource where available, else client-side on the unscoped result.
 * const structuresOnly = await getWhereUsedList(connection, {
 *   object_name: 'ZMY_TABLE',
 *   object_type: 'table',
 *   enableOnlyTypes: ['TABL/DS', 'TABL/DT']
 * });
 *
 * console.log(`Found ${structuresOnly.totalReferences} references`);
 * for (const ref of structuresOnly.references) {
 *   console.log(`${ref.name} (${ref.type}) in package ${ref.packageName}`);
 * }
 * ```
 */
export declare function getWhereUsedList(connection: IAbapConnection, params: IGetWhereUsedListParams): Promise<IWhereUsedListResult>;
//# sourceMappingURL=whereUsed.d.ts.map