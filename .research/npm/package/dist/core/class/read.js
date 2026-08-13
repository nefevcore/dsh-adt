"use strict";
/**
 * Class read operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClassMetadata = getClassMetadata;
exports.getClassSource = getClassSource;
exports.getClass = getClass;
exports.getClassTransport = getClassTransport;
exports.getClassDefinitionsInclude = getClassDefinitionsInclude;
exports.getClassMacrosInclude = getClassMacrosInclude;
exports.getClassTestClassesInclude = getClassTestClassesInclude;
exports.getClassImplementationsInclude = getClassImplementationsInclude;
const contentTypes_1 = require("../../constants/contentTypes");
const acceptNegotiation_1 = require("../../utils/acceptNegotiation");
const internalUtils_1 = require("../../utils/internalUtils");
const noopLogger_1 = require("../../utils/noopLogger");
const timeouts_1 = require("../../utils/timeouts");
const AdtUtils_1 = require("../shared/AdtUtils");
function getUtils(connection) {
    return new AdtUtils_1.AdtUtils(connection, noopLogger_1.noopLogger);
}
/**
 * Get ABAP class metadata (without source code)
 * @param connection - SAP connection
 * @param className - Class name
 */
async function getClassMetadata(connection, className, options) {
    return getUtils(connection).readObjectMetadata('class', className, undefined, options);
}
/**
 * Get ABAP class source code
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
async function getClassSource(connection, className, version, options) {
    return getUtils(connection).readObjectSource('class', className, undefined, version, options);
}
/**
 * Get ABAP class (source code by default for backward compatibility)
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 * @deprecated Use getClassSource() or getClassMetadata() instead
 */
async function getClass(connection, className, version = 'active') {
    return getClassSource(connection, className, version);
}
/**
 * Get transport request for ABAP class
 * @param connection - SAP connection
 * @param className - Class name
 * @returns Transport request information
 */
async function getClassTransport(connection, className, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(className);
    let url = `/sap/bc/adt/oo/classes/${encodedName}/transport`;
    if (options?.withLongPolling) {
        url += '?withLongPolling=true';
    }
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_TRANSPORT,
        },
    });
}
/**
 * Get ABAP class definitions include (local types in private section)
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
async function getClassDefinitionsInclude(connection, className, version = 'active', logger, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(className);
    const versionParam = version === 'inactive' ? 'workingArea' : 'active';
    const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/definitions?version=${versionParam}`;
    return (0, acceptNegotiation_1.makeAdtRequestWithAcceptNegotiation)(connection, {
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_SOURCE,
        },
    }, { logger });
}
/**
 * Get ABAP class macros include
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
async function getClassMacrosInclude(connection, className, version = 'active', logger, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(className);
    const versionParam = version === 'inactive' ? 'workingArea' : 'active';
    const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/macros?version=${versionParam}`;
    return (0, acceptNegotiation_1.makeAdtRequestWithAcceptNegotiation)(connection, {
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_SOURCE,
        },
    }, { logger });
}
/**
 * Get ABAP class testclasses include (local test classes)
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
async function getClassTestClassesInclude(connection, className, version = 'active', logger, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(className);
    const versionParam = version === 'inactive' ? 'workingArea' : 'active';
    const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/testclasses?version=${versionParam}`;
    return (0, acceptNegotiation_1.makeAdtRequestWithAcceptNegotiation)(connection, {
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_SOURCE,
        },
    }, { logger });
}
/**
 * Get ABAP class implementations include (local types, helper classes, interfaces)
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
async function getClassImplementationsInclude(connection, className, version = 'active', logger, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(className);
    const versionParam = version === 'inactive' ? 'workingArea' : 'active';
    const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/implementations?version=${versionParam}`;
    return (0, acceptNegotiation_1.makeAdtRequestWithAcceptNegotiation)(connection, {
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_SOURCE,
        },
    }, { logger });
}
