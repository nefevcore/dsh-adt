"use strict";
/**
 * Core read operations - private implementations
 * All read-only methods are implemented here once and reused by clients
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProgram = getProgram;
exports.getClass = getClass;
exports.getTable = getTable;
exports.getStructure = getStructure;
exports.getDomain = getDomain;
exports.getDataElement = getDataElement;
exports.getInterface = getInterface;
exports.getFunctionGroup = getFunctionGroup;
exports.getFunction = getFunction;
exports.getPackage = getPackage;
exports.getDdl = getDdl;
exports.fetchNodeStructure = fetchNodeStructure;
exports.getSystemInformation = getSystemInformation;
const contentTypes_1 = require("../constants/contentTypes");
const internalUtils_1 = require("../utils/internalUtils");
const timeouts_1 = require("./timeouts");
/**
 * Internal helper to make ADT request
 */
async function makeAdtRequest(connection, url, method = 'GET', timeout = 'default', data, params, headers) {
    const timeoutValue = (0, timeouts_1.getTimeout)(timeout);
    return connection.makeAdtRequest({
        url,
        method,
        timeout: timeoutValue,
        data,
        params,
        headers,
    });
}
/**
 * Get base URL from connection
 */
/**
 * Get ABAP program source code
 */
async function getProgram(connection, programName) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(programName);
    const url = `/sap/bc/adt/programs/programs/${encodedName}/source/main`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
/**
 * Get ABAP class source code
 */
async function getClass(connection, className) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(className);
    const url = `/sap/bc/adt/oo/classes/${encodedName}/source/main`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
/**
 * Get ABAP table structure
 */
async function getTable(connection, tableName) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(tableName);
    const url = `/sap/bc/adt/ddic/tables/${encodedName}/source/main`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
/**
 * Get ABAP structure
 */
async function getStructure(connection, structureName) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(structureName);
    const url = `/sap/bc/adt/ddic/structures/${encodedName}/source/main`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
/**
 * Get ABAP domain
 */
async function getDomain(connection, domainName) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(domainName);
    const url = `/sap/bc/adt/ddic/domains/${encodedName}`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
/**
 * Get ABAP data element
 */
async function getDataElement(connection, dataElementName) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(dataElementName);
    const url = `/sap/bc/adt/ddic/dataelements/${encodedName}`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
/**
 * Get ABAP interface
 */
async function getInterface(connection, interfaceName) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(interfaceName);
    const url = `/sap/bc/adt/oo/interfaces/${encodedName}/source/main`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
/**
 * Get ABAP function group
 */
async function getFunctionGroup(connection, functionGroupName) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(functionGroupName);
    const url = `/sap/bc/adt/functions/groups/${encodedName}`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
/**
 * Get ABAP function module
 */
async function getFunction(connection, functionName, functionGroup) {
    const encodedGroup = (0, internalUtils_1.encodeSapObjectName)(functionGroup);
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(functionName);
    const url = `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedName}`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
/**
 * Get ABAP package
 */
async function getPackage(connection, packageName) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(packageName);
    const url = `/sap/bc/adt/packages/${encodedName}`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
/**
 * Get ABAP view (CDS or Classic)
 */
async function getDdl(connection, ddlName) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(ddlName);
    const url = `/sap/bc/adt/ddic/ddl/sources/${encodedName}/source/main`;
    return makeAdtRequest(connection, url, 'GET', 'default');
}
/**
 * Fetches node structure from SAP ADT repository
 */
async function fetchNodeStructure(connection, parentName, parentTechName, parentType, nodeKey, withShortDescriptions = true) {
    const qs = (0, internalUtils_1.buildQueryString)({
        parent_name: parentName,
        parent_tech_name: parentTechName,
        parent_type: parentType,
        withShortDescriptions: withShortDescriptions.toString(),
    });
    const url = `/sap/bc/adt/repository/nodestructure?${qs}`;
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
<asx:values>
<DATA>
<TV_NODEKEY>${nodeKey}</TV_NODEKEY>
</DATA>
</asx:values>
</asx:abap>`;
    return makeAdtRequest(connection, url, 'POST', 'default', xmlBody, undefined, {
        Accept: contentTypes_1.ACCEPT_NODE_STRUCTURE,
    });
}
/**
 * Get system information from SAP ADT (for cloud systems)
 * Returns systemID and userName if available
 */
async function getSystemInformation(connection) {
    try {
        const url = `/sap/bc/adt/core/http/systeminformation`;
        const headers = {
            Accept: 'application/json',
        };
        const response = await makeAdtRequest(connection, url, 'GET', 'default', undefined, undefined, headers);
        if (response.data && typeof response.data === 'object') {
            return {
                systemID: response.data.systemID,
                userName: response.data.userName,
            };
        }
        return null;
    }
    catch (_error) {
        // If endpoint doesn't exist (on-premise), return null
        return null;
    }
}
// TODO: Add more read operations as needed
// - getInclude
// - getIncludesList
// - getTypeInfo
// - getObjectInfo
// - getObjectStructure
// - getTransaction
// - getTableContents
// - getObjectsList
// - getObjectsByType
// - getProgFullCode
// - getSqlQuery
// - getWhereUsed
// - searchObject
// - getEnhancements
// - getTransport
// etc.
