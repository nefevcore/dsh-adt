"use strict";
/**
 * Enhancement read operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnhancementMetadata = getEnhancementMetadata;
exports.getEnhancementSource = getEnhancementSource;
exports.getEnhancementTransport = getEnhancementTransport;
const contentTypes_1 = require("../../constants/contentTypes");
const acceptNegotiation_1 = require("../../utils/acceptNegotiation");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const types_1 = require("./types");
/**
 * Get enhancement metadata (without source code)
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type (enhoxh, enhoxhb, enhoxhh, enhsxs, enhsxsb)
 * @param enhancementName - Enhancement name
 * @param options - Optional parameters including withLongPolling
 * @returns Axios response with enhancement metadata XML
 */
async function getEnhancementMetadata(connection, enhancementType, enhancementName, options, logger) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(enhancementName).toLowerCase();
    let url = (0, types_1.getEnhancementUri)(enhancementType, encodedName);
    if (options?.withLongPolling) {
        url += '?withLongPolling=true';
    }
    return (0, acceptNegotiation_1.makeAdtRequestWithAcceptNegotiation)(connection, {
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_ENHANCEMENT,
        },
    }, { logger });
}
/**
 * Get enhancement source code
 * Only available for enhoxhh (Source Code Plugin) type
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type (should be enhoxhh for source code)
 * @param enhancementName - Enhancement name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 * @param options - Optional parameters including withLongPolling
 * @returns Axios response with source code as text/plain
 */
async function getEnhancementSource(connection, enhancementType, enhancementName, version = 'active', options, logger) {
    if (!(0, types_1.supportsSourceCode)(enhancementType)) {
        throw new Error(`Enhancement type '${enhancementType}' does not support source code operations. Only 'enhoxhh' supports source code.`);
    }
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(enhancementName).toLowerCase();
    const versionParam = version === 'inactive' ? 'workingArea' : 'active';
    let url = `${(0, types_1.getEnhancementUri)(enhancementType, encodedName)}/source/main?version=${versionParam}`;
    if (options?.withLongPolling) {
        url += '&withLongPolling=true';
    }
    return (0, acceptNegotiation_1.makeAdtRequestWithAcceptNegotiation)(connection, {
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_SOURCE_UTF8,
        },
    }, { logger });
}
/**
 * Get transport request for enhancement
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type
 * @param enhancementName - Enhancement name
 * @param options - Optional parameters including withLongPolling
 * @returns Transport request information
 */
async function getEnhancementTransport(connection, enhancementType, enhancementName, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(enhancementName).toLowerCase();
    let url = `${(0, types_1.getEnhancementUri)(enhancementType, encodedName)}/transport`;
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
