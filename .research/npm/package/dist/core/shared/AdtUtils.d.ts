/**
 * AdtUtils - Utility Functions Wrapper
 *
 * Provides access to cross-cutting ADT utility functions that are NOT CRUD operations.
 * These functions don't implement IAdtObject interface because they are not object-specific CRUD operations.
 *
 * Utility functions include:
 * - Search operations
 * - Where-used analysis
 * - Inactive objects management
 * - Group activation/deletion
 * - Object metadata and source code reading
 * - SQL queries and table contents
 *
 * Usage:
 * ```typescript
 * const client = new AdtClient(connection, logger);
 * const utils = client.getUtils();
 *
 * // Search for objects
 * const searchResult = await utils.searchObjects({ query: 'Z*', objectType: 'CLAS' });
 *
 * // Get where-used references
 * const whereUsed = await utils.getWhereUsed({ objectName: 'ZMY_CLASS', objectType: 'CLAS' });
 *
 * // Group activation
 * await utils.activateObjectsGroup([{ type: 'DOMA', name: 'ZMY_DOMAIN' }]);
 * ```
 */
import type { IAbapConnection, IAdtResponse, IAdtSearchable, ILogger, ISearchResult } from '@mcp-abap-adt/interfaces';
import type { AdtObjectType, AdtSourceObjectType, IGetDiscoveryParams, IGetPackageContentsListOptions, IGetPackageHierarchyOptions, IGetSqlQueryParams, IGetTableContentsParams, IGetVirtualFoldersContentsParams, IGetWhereUsedListParams, IGetWhereUsedParams, IGetWhereUsedScopeParams, IInactiveObjectsResponse, IObjectReference, IPackageContentItem, IPackageHierarchyNode, IReadOptions, ISearchObjectsParams, IWhereUsedListResult } from './types';
export declare class AdtUtils implements IAdtSearchable<ISearchObjectsParams, ISearchResult> {
    protected connection: IAbapConnection;
    private logger;
    constructor(connection: IAbapConnection, logger: ILogger);
    /**
     * Search for ABAP objects by name pattern
     *
     * @param params - Search parameters
     * @returns Search results
     */
    searchObjects(params: ISearchObjectsParams): Promise<IAdtResponse>;
    /**
     * Locate objects by name pattern — the IAdtSearchable capability.
     *
     * `searchObjects` above returns the raw response and stays; this returns the
     * hits themselves. Both are kept because they answer different questions:
     * one for a caller that needs status and headers, one for a caller that
     * wants the objects.
     */
    search(criteria: ISearchObjectsParams): Promise<ISearchResult[]>;
    /**
     * Fetch virtual folder contents for hierarchical browsing.
     *
     * @param params - Virtual folder request parameters
     * @returns Virtual folder contents in XML format
     */
    getVirtualFoldersContents(params: IGetVirtualFoldersContentsParams): Promise<IAdtResponse>;
    /**
     * Where-used Step 1: fetch scope configuration.
     *
     * ADT exposes where-used as a two-step flow. First you request the "scope" XML
     * (available object types + default selections). You can then modify that XML
     * to include/exclude types before executing the search.
     *
     * Returns available object types that can be searched for where-used references.
     * Consumer can parse the XML response, present options to user, and modify selections.
     *
     * @param params - Scope parameters
     * @returns Scope XML with available object types (isSelected, isDefault attributes)
     *
     * @example
     * // Get scope for a class
     * const scopeResponse = await utils.getWhereUsedScope({
     *   object_name: 'ZMY_CLASS',
     *   object_type: 'class'
     * });
     *
     * // Parse and display types to user, then modify XML
     * let scopeXml = scopeResponse.data;
     * // Enable function modules in search
     * scopeXml = scopeXml.replace(/name="FUGR\/FF" isSelected="false"/, 'name="FUGR/FF" isSelected="true"');
     *
     * // Execute search with modified scope
     * const result = await utils.getWhereUsed({
     *   object_name: 'ZMY_CLASS',
     *   object_type: 'class',
     *   scopeXml: scopeXml
     * });
     */
    getWhereUsedScope(params: IGetWhereUsedScopeParams): Promise<IAdtResponse>;
    /**
     * Where-used helper: modify scope XML.
     *
     * This is a local helper (no ADT call). It toggles `isSelected` flags in the scope
     * XML produced by `getWhereUsedScope`, so you can control which object types are
     * included when you call `getWhereUsed`.
     *
     * @param scopeXml - Scope XML from getWhereUsedScope()
     * @param options - Modification options
     * @returns Modified scope XML
     *
     * @example
     * const scopeResponse = await utils.getWhereUsedScope({ object_name: 'ZMY_CLASS', object_type: 'class' });
     * let scopeXml = scopeResponse.data;
     *
     * // Enable function modules in search
     * scopeXml = utils.modifyWhereUsedScope(scopeXml, { enable: ['FUGR/FF'] });
     *
     * // Search only in classes and interfaces
     * scopeXml = utils.modifyWhereUsedScope(scopeXml, { enableOnly: ['CLAS/OC', 'INTF/OI'] });
     *
     * const result = await utils.getWhereUsed({
     *   object_name: 'ZMY_CLASS',
     *   object_type: 'class',
     *   scopeXml: scopeXml
     * });
     */
    modifyWhereUsedScope(scopeXml: string, options: {
        enableAll?: boolean;
        enableOnly?: string[];
        enable?: string[];
        disable?: string[];
    }): string;
    /**
     * Where-used: execute search.
     *
     * Performs the where-used search for an object. When a scope XML is supplied
     * the search is narrowed to those object types; when omitted it runs unscoped
     * against SAP's default selection. This posts directly to /usageReferences and
     * does NOT fetch the /usageReferences/scope sub-resource, so it works on
     * systems that do not expose it.
     *
     * @param params - Where-used parameters
     * @param params.object_name - Name of the object to search
     * @param params.object_type - Type of the object (class, table, etc.)
     * @param params.scopeXml - Optional scope XML from getWhereUsedScope(). When omitted, the search runs unscoped (SAP's default selection); no scope is fetched.
     * @returns Where-used references in XML format
     *
     * @example
     * // Simple usage with default scope
     * const result = await utils.getWhereUsed({
     *   object_name: 'ZMY_CLASS',
     *   object_type: 'class'
     * });
     *
     * // Advanced: use custom scope from getWhereUsedScope()
     * const scopeResponse = await utils.getWhereUsedScope({
     *   object_name: 'ZMY_CLASS',
     *   object_type: 'class'
     * });
     * let scopeXml = scopeResponse.data;
     * // Modify selections...
     * const result = await utils.getWhereUsed({
     *   object_name: 'ZMY_CLASS',
     *   object_type: 'class',
     *   scopeXml: scopeXml
     *   searchInAllTypes: ['CLAS/OC', 'INTF/OI']
     * });
     */
    getWhereUsed(params: IGetWhereUsedParams): Promise<IAdtResponse>;
    /**
     * Get where-used references with parsed results
     *
     * This is a convenience method that combines scope fetching, search execution,
     * and XML parsing into a single call with structured output.
     *
     * @param params - Where-used list parameters
     * @returns Parsed where-used results with references list
     *
     * @example
     * ```typescript
     * const result = await utils.getWhereUsedList({
     *   object_name: 'ZMY_TABLE',
     *   object_type: 'table',
     *   enableAllTypes: true
     * });
     *
     * console.log(`Found ${result.totalReferences} references`);
     * for (const ref of result.references) {
     *   console.log(`${ref.name} (${ref.type}) in package ${ref.packageName}`);
     * }
     * ```
     */
    getWhereUsedList(params: IGetWhereUsedListParams): Promise<IWhereUsedListResult>;
    /**
     * Get list of inactive objects (objects that are not yet activated)
     *
     * @param options - Optional parameters
     * @returns List of inactive objects with their metadata
     */
    getInactiveObjects(options?: {
        includeRawXml?: boolean;
    }): Promise<IInactiveObjectsResponse>;
    /**
     * Activate multiple objects in a group
     *
     * @param objects - Array of object references to activate
     * @param preauditRequested - Whether to request pre-audit
     * @returns Activation result
     */
    activateObjectsGroup(objects: IObjectReference[], preauditRequested?: boolean): Promise<IAdtResponse>;
    /**
     * Check if multiple objects can be deleted (group deletion check)
     *
     * @param objects - Array of object references to check
     * @returns Check result
     */
    checkDeletionGroup(objects: IObjectReference[]): Promise<IAdtResponse>;
    /**
     * Delete multiple objects in a group
     *
     * @param objects - Array of object references to delete
     * @param transportRequest - Optional transport request
     * @returns Delete result
     */
    deleteObjectsGroup(objects: IObjectReference[], transportRequest?: string): Promise<IAdtResponse>;
    /**
     * Read object metadata (without source code)
     *
     * @param objectType - Object type (e.g., 'CLAS', 'PROG', 'INTF')
     * @param objectName - Object name
     * @param functionGroup - Function group (required for function modules)
     * @param options - Optional read options
     * @param options.withLongPolling - If true, adds ?withLongPolling=true to wait for object to become available
     * @param options.accept - Optional Accept override for the metadata request
     * @returns Metadata response
     */
    readObjectMetadata(objectType: AdtObjectType, objectName: string, functionGroup?: string, options?: IReadOptions): Promise<IAdtResponse>;
    /**
     * Read object source code
     * Only works for objects that have source code (class, program, interface, etc.)
     *
     * @param objectType - Object type (e.g., 'CLAS', 'PROG', 'INTF')
     * @param objectName - Object name
     * @param functionGroup - Function group (required for function modules)
     * @param version - 'active' or 'inactive'
     * @param options - Optional read options
     * @param options.withLongPolling - If true, adds ?withLongPolling=true to wait for object to become available
     * @param options.accept - Optional Accept override for the source request
     * @returns Source code response
     */
    readObjectSource(objectType: AdtSourceObjectType, objectName: string, functionGroup?: string, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IAdtResponse>;
    /**
     * Check if object type supports source code reading
     *
     * @param objectType - Object type to check
     * @returns true if object type supports source code reading
     */
    supportsSourceCode(objectType: AdtObjectType): boolean;
    /**
     * Get object source URI based on object type
     *
     * @param objectType - Object type
     * @param objectName - Object name
     * @param functionGroup - Function group (required for function modules)
     * @param version - 'active' or 'inactive'
     * @returns Source URI
     */
    getObjectSourceUri(objectType: AdtSourceObjectType, objectName: string, functionGroup?: string, version?: 'active' | 'inactive'): string;
    /**
     * Execute SQL query via ADT Data Preview API
     * ⚠️ ABAP Cloud Limitation: Only works on on-premise systems with basic auth
     *
     * @param params - SQL query parameters
     * @returns Query result
     */
    getSqlQuery(params: IGetSqlQueryParams): Promise<IAdtResponse>;
    /**
     * Get table contents via ADT Data Preview API
     * ⚠️ ABAP Cloud Limitation: Only works on on-premise systems with basic auth
     *
     * @param params - Table contents parameters
     * @returns Table contents result
     */
    getTableContents(params: IGetTableContentsParams): Promise<IAdtResponse>;
    /**
     * Fetch ADT discovery document with endpoint catalog
     *
     * @param params - Optional request/timeout options
     * @returns Axios response with discovery XML
     */
    discovery(params?: IGetDiscoveryParams): Promise<IAdtResponse>;
    /**
     * Get transaction properties (metadata) for ABAP transaction
     *
     * Retrieves transaction information using ADT object properties endpoint:
     * - Transaction name
     * - Description
     * - Package (if applicable)
     * - Transaction type
     *
     * @param transactionName - Transaction code (e.g., 'SE80', 'SE11', 'SM30')
     * @returns Axios response with XML containing transaction properties
     *          Response format: opr:objectProperties with opr:object containing
     *          name, text (description), package, type
     *
     * @example
     * ```typescript
     * const response = await utils.getTransaction('SE80');
     * // Response contains XML with transaction properties
     * ```
     */
    getTransaction(transactionName: string): Promise<IAdtResponse>;
    /**
     * Get behavior definition source code (BDEF)
     *
     * Convenience wrapper for reading behavior definition source code.
     * Uses the same endpoint as `AdtClient.getBehaviorDefinition().read()`.
     *
     * @param bdefName - Behavior definition name (e.g., 'Z_I_MYENTITY')
     * @param version - Version to read: 'active' or 'inactive' (default: 'active')
     * @returns Axios response with source code (plain text)
     *
     * @example
     * ```typescript
     * const response = await utils.getBdef('Z_I_MYENTITY');
     * const sourceCode = response.data; // BDEF source code
     * ```
     */
    getBdef(bdefName: string, version?: 'active' | 'inactive'): Promise<IAdtResponse>;
    /**
     * Fetch node structure from ADT repository
     *
     * Used for object tree navigation and structure discovery.
     *
     * @param parentType - Parent object type (e.g., 'CLAS/OC', 'PROG/P', 'DEVC/K')
     * @param parentName - Parent object name
     * @param nodeId - Optional node ID (default: '0000' for root)
     * @param withShortDescriptions - Include short descriptions (default: true)
     * @returns Axios response with XML containing node structure
     *
     * @example
     * ```typescript
     * const response = await utils.fetchNodeStructure('CLAS/OC', 'ZMY_CLASS', '0000');
     * ```
     */
    fetchNodeStructure(parentType: string, parentName: string, nodeId?: string, withShortDescriptions?: boolean): Promise<IAdtResponse>;
    /**
     * Get enhancement implementations for ABAP object
     *
     * Retrieves enhancement implementations for programs, includes, or classes.
     *
     * @param objectName - Object name (program, include, or class)
     * @param objectType - Object type: 'program' | 'include' | 'class'
     * @param context - Optional program context for includes (required when objectType is 'include')
     * @returns Axios response with XML containing enhancement implementations
     *
     * @example
     * ```typescript
     * // For a program
     * const response = await utils.getEnhancements('ZMY_PROGRAM', 'program');
     *
     * // For an include
     * const response = await utils.getEnhancements('ZMY_INCLUDE', 'include', 'ZMY_PROGRAM');
     *
     * // For a class
     * const response = await utils.getEnhancements('ZMY_CLASS', 'class');
     * ```
     */
    getEnhancements(objectName: string, objectType: 'program' | 'include' | 'class', context?: string): Promise<IAdtResponse>;
    /**
     * Get list of includes for ABAP object
     *
     * Recursively discovers and lists all include files within an ABAP program or include.
     *
     * @param objectName - Object name (program or include)
     * @param objectType - Object type: 'PROG/P' | 'PROG/I' | 'FUGR' | 'CLAS/OC'
     * @param timeout - Optional timeout in milliseconds (default: 30000)
     * @returns Array of include names
     *
     * @example
     * ```typescript
     * const includes = await utils.getIncludesList('ZMY_PROGRAM', 'PROG/P');
     * // Returns: ['ZMY_INCLUDE1', 'ZMY_INCLUDE2', ...]
     * ```
     */
    getIncludesList(objectName: string, objectType: 'PROG/P' | 'PROG/I' | 'FUGR' | 'CLAS/OC', timeout?: number): Promise<string[]>;
    /**
     * List the function modules of a function group.
     *
     * @example
     * const fms = await utils.listFunctionModules('ZMY_FUGR');
     * // Returns: ['Z_MY_FM1', 'Z_MY_FM2']
     */
    listFunctionModules(functionGroupName: string): Promise<string[]>;
    /**
     * List the includes of a function group (TOP, UXX collector, custom includes).
     *
     * Complements listFunctionModules: includes hold code that is not part of any
     * function module (global data/types in TOP, FORM routines in custom includes),
     * so a complete function-group backup needs them.
     *
     * @example
     * const includes = await utils.listFunctionGroupIncludes('ZMY_FUGR');
     * // Returns: ['LZMY_FUGRTOP', 'LZMY_FUGRUXX', ...]
     */
    listFunctionGroupIncludes(functionGroupName: string): Promise<string[]>;
    /**
     * Get package contents as raw XML
     *
     * Low-level method that retrieves package contents as raw XML response.
     * For most use cases, prefer getPackageContentsList() or getPackageHierarchy().
     *
     * @param packageName - Package name
     * @returns Axios response with XML containing package contents
     *
     * @example
     * ```typescript
     * const response = await utils.getPackageContents('ZMY_PACKAGE');
     * // Response contains XML with objects in the package
     * ```
     */
    getPackageContents(packageName: string): Promise<IAdtResponse>;
    /**
     * Get package contents as a flat list
     *
     * Returns all objects in a package as a flat array. This is a convenient
     * wrapper that fetches all object categories and returns them in a single list.
     *
     * @param packageName - Package name
     * @param options - Optional options for fetching
     * @returns Array of package content items
     *
     * @example
     * ```typescript
     * const items = await utils.getPackageContentsList('ZMY_PACKAGE');
     * // Returns: [{ name: 'ZCL_MY_CLASS', type: 'CLAS/OC', description: '...' }, ...]
     *
     * // Include subpackage contents recursively
     * const allItems = await utils.getPackageContentsList('ZMY_PACKAGE', {
     *   includeSubpackages: true,
     * });
     * ```
     */
    getPackageContentsList(packageName: string, options?: IGetPackageContentsListOptions): Promise<IPackageContentItem[]>;
    /**
     * Get package hierarchy as a tree structure
     *
     * Builds a tree of package contents and subpackages using node structure.
     *
     * @param packageName - Package name
     * @param options - Optional hierarchy options
     * @returns Root tree node for the package hierarchy
     *
     * @example
     * ```typescript
     * const tree = await utils.getPackageHierarchy('ZMY_PACKAGE', {
     *   includeSubpackages: true,
     *   maxDepth: 5,
     *   includeDescriptions: true,
     * });
     * // tree contains package, subpackages, and objects in a hierarchy
     * ```
     */
    getPackageHierarchy(packageName: string, options?: IGetPackageHierarchyOptions): Promise<IPackageHierarchyNode>;
    /**
     * Get object structure from ADT repository
     *
     * Retrieves ADT object structure as compact JSON tree.
     *
     * @param objectType - Object type (e.g., 'CLAS/OC', 'PROG/P', 'DEVC/K')
     * @param objectName - Object name
     * @returns Axios response with XML containing object structure tree
     *
     * @example
     * ```typescript
     * const response = await utils.getObjectStructure('CLAS/OC', 'ZMY_CLASS');
     * ```
     */
    getObjectStructure(objectType: string, objectName: string): Promise<IAdtResponse>;
    /**
     * Get include source code
     *
     * Retrieves source code of specific ABAP include file.
     *
     * @param includeName - Include name
     * @returns Axios response with source code (plain text)
     *
     * @example
     * ```typescript
     * const response = await utils.getInclude('ZMY_INCLUDE');
     * const sourceCode = response.data; // Include source code
     * ```
     */
    getInclude(includeName: string): Promise<IAdtResponse>;
    /**
     * Get type information with fallback chain
     *
     * Tries multiple endpoints in order: domain, data element, table type, object properties.
     *
     * @param typeName - Type name to look up
     * @returns Axios response with type information (XML)
     *
     * @example
     * ```typescript
     * const response = await utils.getTypeInfo('ZMY_TYPE');
     * ```
     */
    getTypeInfo(typeName: string): Promise<IAdtResponse>;
    /**
     * Get enhancement implementation source code
     *
     * Uses different URL format: /sap/bc/adt/enhancements/{spot}/{name}/source/main
     * where spot is the enhancement spot name (not type).
     *
     * @param enhancementSpot - Enhancement spot name (e.g., 'enhoxhh')
     * @param enhancementName - Enhancement implementation name
     * @returns Axios response with XML containing enhancement source code
     *
     * @example
     * ```typescript
     * const response = await utils.getEnhancementImpl('enhoxhh', 'zpartner_update_pai');
     * ```
     */
    getEnhancementImpl(enhancementSpot: string, enhancementName: string): Promise<IAdtResponse>;
    /**
     * Get enhancement spot metadata
     *
     * Convenience wrapper for reading enhancement spot metadata.
     * Uses type 'enhsxsb' (BAdI Enhancement Spot).
     *
     * @param enhancementSpot - Enhancement spot name
     * @returns Axios response with XML containing enhancement spot metadata
     *
     * @example
     * ```typescript
     * const response = await utils.getEnhancementSpot('enhoxhh');
     * ```
     */
    getEnhancementSpot(enhancementSpot: string): Promise<IAdtResponse>;
    /**
     * Get all valid ADT object types
     *
     * Retrieves list of all valid ADT object types from the repository.
     *
     * @param maxItemCount - Maximum number of items to return (default: 999)
     * @param name - Name filter pattern (default: '*')
     * @param data - Data filter (default: 'usedByProvider')
     * @returns Axios response with XML containing all object types
     *
     * @example
     * ```typescript
     * const response = await utils.getAllTypes();
     * // Response contains XML with all ADT object types
     * ```
     */
    getAllTypes(maxItemCount?: number, name?: string, data?: string): Promise<IAdtResponse>;
}
//# sourceMappingURL=AdtUtils.d.ts.map