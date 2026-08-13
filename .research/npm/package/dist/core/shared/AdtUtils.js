"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtUtils = void 0;
const acceptNegotiation_1 = require("../../utils/acceptNegotiation");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const read_1 = require("../behaviorDefinition/read");
const read_2 = require("../enhancement/read");
const allTypes_1 = require("./allTypes");
const discovery_1 = require("./discovery");
const enhancementImpl_1 = require("./enhancementImpl");
const enhancements_1 = require("./enhancements");
const functionGroupIncludesList_1 = require("./functionGroupIncludesList");
const functionModulesList_1 = require("./functionModulesList");
const getInactiveObjects_1 = require("./getInactiveObjects");
const groupActivation_1 = require("./groupActivation");
const groupDeletion_1 = require("./groupDeletion");
const include_1 = require("./include");
const includesList_1 = require("./includesList");
const nodeStructure_1 = require("./nodeStructure");
const objectStructure_1 = require("./objectStructure");
const packageContentsList_1 = require("./packageContentsList");
const packageHierarchy_1 = require("./packageHierarchy");
// Import utility functions
const search_1 = require("./search");
const sqlQuery_1 = require("./sqlQuery");
const tableContents_1 = require("./tableContents");
const transaction_1 = require("./transaction");
const typeInfo_1 = require("./typeInfo");
const virtualFolders_1 = require("./virtualFolders");
const whereUsed_1 = require("./whereUsed");
// Note: Application Logs and ATC Logs are in runtime/, not core
// They are accessed via AdtRuntime, not AdtUtils
// Note: DDIC Activation Graph is in runtime/logs/ddic.ts
// It is accessed via AdtRuntime.getDdicActivationGraph(), not AdtUtils
const contentTypes_1 = require("../../constants/contentTypes");
class AdtUtils {
    connection;
    logger;
    constructor(connection, logger) {
        this.connection = connection;
        this.logger = logger;
    }
    /**
     * Search for ABAP objects by name pattern
     *
     * @param params - Search parameters
     * @returns Search results
     */
    async searchObjects(params) {
        return (0, search_1.searchObjects)(this.connection, params);
    }
    /**
     * Locate objects by name pattern — the IAdtSearchable capability.
     *
     * `searchObjects` above returns the raw response and stays; this returns the
     * hits themselves. Both are kept because they answer different questions:
     * one for a caller that needs status and headers, one for a caller that
     * wants the objects.
     */
    async search(criteria) {
        return (0, search_1.searchObjectsTyped)(this.connection, criteria);
    }
    /**
     * Fetch virtual folder contents for hierarchical browsing.
     *
     * @param params - Virtual folder request parameters
     * @returns Virtual folder contents in XML format
     */
    async getVirtualFoldersContents(params) {
        return (0, virtualFolders_1.getVirtualFoldersContents)(this.connection, params);
    }
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
    async getWhereUsedScope(params) {
        return (0, whereUsed_1.getWhereUsedScope)(this.connection, params);
    }
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
    modifyWhereUsedScope(scopeXml, options) {
        return (0, whereUsed_1.modifyWhereUsedScope)(scopeXml, options);
    }
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
    async getWhereUsed(params) {
        return (0, whereUsed_1.getWhereUsed)(this.connection, params);
    }
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
    async getWhereUsedList(params) {
        return (0, whereUsed_1.getWhereUsedList)(this.connection, params);
    }
    /**
     * Get list of inactive objects (objects that are not yet activated)
     *
     * @param options - Optional parameters
     * @returns List of inactive objects with their metadata
     */
    async getInactiveObjects(options) {
        return (0, getInactiveObjects_1.getInactiveObjects)(this.connection, options);
    }
    /**
     * Activate multiple objects in a group
     *
     * @param objects - Array of object references to activate
     * @param preauditRequested - Whether to request pre-audit
     * @returns Activation result
     */
    async activateObjectsGroup(objects, preauditRequested = false) {
        return (0, groupActivation_1.activateObjectsGroup)(this.connection, objects, preauditRequested);
    }
    /**
     * Check if multiple objects can be deleted (group deletion check)
     *
     * @param objects - Array of object references to check
     * @returns Check result
     */
    async checkDeletionGroup(objects) {
        return (0, groupDeletion_1.checkDeletionGroup)(this.connection, objects);
    }
    /**
     * Delete multiple objects in a group
     *
     * @param objects - Array of object references to delete
     * @param transportRequest - Optional transport request
     * @returns Delete result
     */
    async deleteObjectsGroup(objects, transportRequest) {
        return (0, groupDeletion_1.deleteObjectsGroup)(this.connection, objects, transportRequest);
    }
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
    async readObjectMetadata(objectType, objectName, functionGroup, options) {
        let uri = getObjectMetadataUri(objectType, objectName, functionGroup);
        const params = [];
        if (options?.version) {
            params.push(`version=${options.version}`);
        }
        if (options?.withLongPolling) {
            params.push('withLongPolling=true');
        }
        if (params.length > 0) {
            uri += `?${params.join('&')}`;
        }
        const acceptHeader = options?.accept ?? getMetadataAcceptHeader(objectType);
        return (0, acceptNegotiation_1.makeAdtRequestWithAcceptNegotiation)(this.connection, {
            url: uri,
            method: 'GET',
            timeout: (0, timeouts_1.getTimeout)('default'),
            headers: {
                Accept: acceptHeader,
            },
        }, {
            logger: this.logger,
        });
    }
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
    async readObjectSource(objectType, objectName, functionGroup, version, options) {
        if (!supportsSourceCode(objectType)) {
            throw new Error(`Object type ${objectType} does not support source code reading`);
        }
        let uri = getObjectSourceUri(objectType, objectName, functionGroup, version);
        if (options?.withLongPolling) {
            const separator = uri.includes('?') ? '&' : '?';
            uri += `${separator}withLongPolling=true`;
        }
        const acceptHeader = options?.accept ?? 'text/plain';
        return (0, acceptNegotiation_1.makeAdtRequestWithAcceptNegotiation)(this.connection, {
            url: uri,
            method: 'GET',
            timeout: (0, timeouts_1.getTimeout)('default'),
            headers: {
                Accept: acceptHeader,
            },
        }, {
            logger: this.logger,
        });
    }
    /**
     * Check if object type supports source code reading
     *
     * @param objectType - Object type to check
     * @returns true if object type supports source code reading
     */
    supportsSourceCode(objectType) {
        return supportsSourceCode(objectType);
    }
    /**
     * Get object source URI based on object type
     *
     * @param objectType - Object type
     * @param objectName - Object name
     * @param functionGroup - Function group (required for function modules)
     * @param version - 'active' or 'inactive'
     * @returns Source URI
     */
    getObjectSourceUri(objectType, objectName, functionGroup, version) {
        return getObjectSourceUri(objectType, objectName, functionGroup, version);
    }
    /**
     * Execute SQL query via ADT Data Preview API
     * ⚠️ ABAP Cloud Limitation: Only works on on-premise systems with basic auth
     *
     * @param params - SQL query parameters
     * @returns Query result
     */
    async getSqlQuery(params) {
        return (0, sqlQuery_1.getSqlQuery)(this.connection, params);
    }
    /**
     * Get table contents via ADT Data Preview API
     * ⚠️ ABAP Cloud Limitation: Only works on on-premise systems with basic auth
     *
     * @param params - Table contents parameters
     * @returns Table contents result
     */
    async getTableContents(params) {
        return (0, tableContents_1.getTableContents)(this.connection, params);
    }
    /**
     * Fetch ADT discovery document with endpoint catalog
     *
     * @param params - Optional request/timeout options
     * @returns Axios response with discovery XML
     */
    async discovery(params = {}) {
        return (0, discovery_1.getDiscovery)(this.connection, params);
    }
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
    async getTransaction(transactionName) {
        return (0, transaction_1.getTransaction)(this.connection, transactionName);
    }
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
    async getBdef(bdefName, version = 'active') {
        return (0, read_1.readSource)(this.connection, bdefName, version);
    }
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
    async fetchNodeStructure(parentType, parentName, nodeId, withShortDescriptions = true) {
        return (0, nodeStructure_1.fetchNodeStructure)(this.connection, parentType, parentName, nodeId, withShortDescriptions);
    }
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
    async getEnhancements(objectName, objectType, context) {
        return (0, enhancements_1.getEnhancements)(this.connection, objectName, objectType, context);
    }
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
    async getIncludesList(objectName, objectType, timeout = 30000) {
        return (0, includesList_1.getIncludesList)(this.connection, objectName, objectType, timeout);
    }
    /**
     * List the function modules of a function group.
     *
     * @example
     * const fms = await utils.listFunctionModules('ZMY_FUGR');
     * // Returns: ['Z_MY_FM1', 'Z_MY_FM2']
     */
    async listFunctionModules(functionGroupName) {
        return (0, functionModulesList_1.listFunctionModules)(this.connection, functionGroupName);
    }
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
    async listFunctionGroupIncludes(functionGroupName) {
        return (0, functionGroupIncludesList_1.listFunctionGroupIncludes)(this.connection, functionGroupName);
    }
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
    async getPackageContents(packageName) {
        return (0, nodeStructure_1.fetchNodeStructure)(this.connection, 'DEVC/K', packageName.toUpperCase());
    }
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
    async getPackageContentsList(packageName, options) {
        return (0, packageContentsList_1.getPackageContentsList)(this.connection, packageName, options, this.logger);
    }
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
    async getPackageHierarchy(packageName, options) {
        return (0, packageHierarchy_1.getPackageHierarchy)(this.connection, packageName, options, this.logger);
    }
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
    async getObjectStructure(objectType, objectName) {
        return (0, objectStructure_1.getObjectStructure)(this.connection, objectType, objectName);
    }
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
    async getInclude(includeName) {
        return (0, include_1.getInclude)(this.connection, includeName);
    }
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
    async getTypeInfo(typeName) {
        return (0, typeInfo_1.getTypeInfo)(this.connection, typeName);
    }
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
    async getEnhancementImpl(enhancementSpot, enhancementName) {
        return (0, enhancementImpl_1.getEnhancementImpl)(this.connection, enhancementSpot, enhancementName);
    }
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
    async getEnhancementSpot(enhancementSpot) {
        return (0, read_2.getEnhancementMetadata)(this.connection, 'enhsxsb', enhancementSpot, undefined, this.logger);
    }
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
    async getAllTypes(maxItemCount = 999, name = '*', data = 'usedByProvider') {
        return (0, allTypes_1.getAllTypes)(this.connection, maxItemCount, name, data);
    }
}
exports.AdtUtils = AdtUtils;
function getObjectMetadataUri(objectType, objectName, functionGroup) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(objectName);
    switch (objectType.toLowerCase()) {
        case 'class':
        case 'clas/oc':
            return `/sap/bc/adt/oo/classes/${encodedName}`;
        case 'program':
        case 'prog/p':
            return `/sap/bc/adt/programs/programs/${encodedName}`;
        case 'interface':
        case 'intf/if':
            return `/sap/bc/adt/oo/interfaces/${encodedName}`;
        case 'functionmodule':
        case 'fugr/ff': {
            if (!functionGroup) {
                throw new Error('Function group is required for function module');
            }
            const encodedGroup = (0, internalUtils_1.encodeSapObjectName)(functionGroup);
            return `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedName}`;
        }
        case 'view':
        case 'ddls/df':
            return `/sap/bc/adt/ddic/ddl/sources/${encodedName}`;
        case 'structure':
        case 'stru/dt':
            return `/sap/bc/adt/ddic/structures/${encodedName}`;
        case 'table':
        case 'tabl/dt':
            return `/sap/bc/adt/ddic/tables/${encodedName}`;
        case 'tabletype':
        case 'ttyp/df':
            return `/sap/bc/adt/ddic/tabletypes/${encodedName}`;
        case 'domain':
        case 'doma/dd':
            return `/sap/bc/adt/ddic/domains/${encodedName}`;
        case 'dataelement':
        case 'dtel':
            return `/sap/bc/adt/ddic/dataelements/${encodedName}`;
        case 'functiongroup':
        case 'fugr':
            return `/sap/bc/adt/functions/groups/${encodedName}`;
        case 'package':
        case 'devc/k':
            return `/sap/bc/adt/packages/${encodedName}`;
        default:
            throw new Error(`Unsupported object type for metadata: ${objectType}`);
    }
}
function getMetadataAcceptHeader(objectType) {
    const type = objectType.toLowerCase();
    switch (type) {
        case 'class':
        case 'clas/oc':
            return contentTypes_1.ACCEPT_CLASS;
        case 'interface':
        case 'intf/if':
            return contentTypes_1.ACCEPT_INTERFACE;
        case 'table':
        case 'tabl/dt':
            return contentTypes_1.ACCEPT_TABLE;
        case 'tabletype':
        case 'ttyp/df':
            return contentTypes_1.ACCEPT_TABLE_TYPE;
        case 'domain':
        case 'doma/dd':
            return contentTypes_1.ACCEPT_DOMAIN;
        case 'dataelement':
        case 'dtel':
            return contentTypes_1.ACCEPT_DATA_ELEMENT;
        case 'structure':
        case 'stru/dt':
            return contentTypes_1.ACCEPT_STRUCTURE;
        case 'view':
        case 'ddls/df':
            return contentTypes_1.CT_VIEW;
        case 'program':
        case 'prog/p':
            return contentTypes_1.ACCEPT_PROGRAM;
        case 'functiongroup':
        case 'fugr':
            return contentTypes_1.ACCEPT_FUNCTION_GROUP;
        case 'functionmodule':
        case 'fugr/ff':
            return contentTypes_1.ACCEPT_FUNCTION_MODULE;
        case 'package':
        case 'devc/k':
            return contentTypes_1.ACCEPT_PACKAGE;
        default:
            return 'application/xml';
    }
}
function getObjectSourceUri(objectType, objectName, functionGroup, version) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(objectName);
    const versionParam = version ? `?version=${version}` : '';
    switch (objectType.toLowerCase()) {
        case 'class':
        case 'clas/oc':
            return `/sap/bc/adt/oo/classes/${encodedName}/source/main${versionParam}`;
        case 'program':
        case 'prog/p':
            return `/sap/bc/adt/programs/programs/${encodedName}/source/main${versionParam}`;
        case 'interface':
        case 'intf/if':
            return `/sap/bc/adt/oo/interfaces/${encodedName}/source/main${versionParam}`;
        case 'functionmodule':
        case 'fugr/ff': {
            if (!functionGroup) {
                throw new Error('Function group is required for function module');
            }
            const encodedGroup = (0, internalUtils_1.encodeSapObjectName)(functionGroup);
            return `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedName}/source/main${versionParam}`;
        }
        case 'view':
        case 'ddls/df':
            return `/sap/bc/adt/ddic/ddl/sources/${encodedName}/source/main${versionParam}`;
        case 'structure':
        case 'stru/dt':
            return `/sap/bc/adt/ddic/structures/${encodedName}/source/main${versionParam}`;
        case 'table':
        case 'tabl/dt':
            return `/sap/bc/adt/ddic/tables/${encodedName}/source/main${versionParam}`;
        case 'tabletype':
        case 'ttyp/df':
            return `/sap/bc/adt/ddic/tabletypes/${encodedName}/source/main${versionParam}`;
        default:
            throw new Error(`Object type ${objectType} does not support source code reading`);
    }
}
function supportsSourceCode(objectType) {
    const supportedTypes = [
        'class',
        'clas/oc',
        'program',
        'prog/p',
        'interface',
        'intf/if',
        'functionmodule',
        'fugr/ff',
        'view',
        'ddls/df',
        'structure',
        'stru/dt',
        'table',
        'tabl/dt',
        'tabletype',
        'ttyp/df',
    ];
    return supportedTypes.includes(objectType.toLowerCase());
}
