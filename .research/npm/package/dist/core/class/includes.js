"use strict";
/**
 * Class include files operations (local types, definitions, macros)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateClassLocalTypes = updateClassLocalTypes;
exports.updateClassDefinitions = updateClassDefinitions;
exports.updateClassMacros = updateClassMacros;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Update class local types include (implementations)
 *
 * Local helper classes, interface definitions and type declarations.
 * Requires the class to be locked (lock handle) before calling.
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param localTypesSource - Local types source code
 * @param lockHandle - Lock handle from lock operation
 * @param transportRequest - Optional transport request
 * @returns Update result
 */
async function updateClassLocalTypes(connection, className, localTypesSource, lockHandle, transportRequest, sourceContentType) {
    return updateClassInclude(connection, className, localTypesSource, 'implementations', lockHandle, transportRequest, sourceContentType);
}
/**
 * Update class-relevant local types include (definitions)
 *
 * Type declarations needed for components in the private section.
 * Requires the class to be locked (lock handle) before calling.
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param definitionsSource - Definitions source code
 * @param lockHandle - Lock handle from lock operation
 * @param transportRequest - Optional transport request
 * @returns Update result
 */
async function updateClassDefinitions(connection, className, definitionsSource, lockHandle, transportRequest, sourceContentType) {
    return updateClassInclude(connection, className, definitionsSource, 'definitions', lockHandle, transportRequest, sourceContentType);
}
/**
 * Update class macros include
 *
 * Macro definitions needed in the implementation part of the class.
 * Note: Macros are supported in older ABAP versions but not in newer ones.
 * Requires the class to be locked (lock handle) before calling.
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param macrosSource - Macros source code
 * @param lockHandle - Lock handle from lock operation
 * @param transportRequest - Optional transport request
 * @returns Update result
 */
async function updateClassMacros(connection, className, macrosSource, lockHandle, transportRequest, sourceContentType) {
    return updateClassInclude(connection, className, macrosSource, 'macros', lockHandle, transportRequest, sourceContentType);
}
/**
 * Generic function to update any class include file
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param includeSource - Include source code
 * @param includeType - Type of include (implementations, definitions, macros)
 * @param lockHandle - Lock handle from lock operation
 * @param transportRequest - Optional transport request
 * @returns Update result
 */
async function updateClassInclude(connection, className, includeSource, includeType, lockHandle, transportRequest, sourceContentType) {
    if (!includeSource) {
        throw new Error(`${includeType} source code is required`);
    }
    if (!lockHandle) {
        throw new Error(`lockHandle is required to update ${includeType}`);
    }
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(className).toLowerCase();
    let url = `/sap/bc/adt/oo/classes/${encodedName}/includes/${includeType}?lockHandle=${encodeURIComponent(lockHandle)}`;
    if (transportRequest) {
        url += `&corrNr=${transportRequest}`;
    }
    const contentType = sourceContentType || contentTypes_1.CT_SOURCE;
    const headers = {
        'Content-Type': contentType,
        Accept: contentTypes_1.ACCEPT_SOURCE,
    };
    return await connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: includeSource,
        headers,
    });
}
