"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransformation = getTransformation;
exports.getTransformationSource = getTransformationSource;
exports.getTransformationTransport = getTransformationTransport;
const contentTypes_1 = require("../../constants/contentTypes");
const acceptNegotiation_1 = require("../../utils/acceptNegotiation");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Get transformation metadata
 */
async function getTransformation(connection, transformationName, version = 'inactive', options, logger) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(transformationName.toLowerCase());
    const queryParams = [];
    if (version) {
        queryParams.push(`version=${version}`);
    }
    if (options?.withLongPolling) {
        queryParams.push('withLongPolling=true');
    }
    const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    const url = `/sap/bc/adt/xslt/transformations/${encodedName}${query}`;
    return (0, acceptNegotiation_1.makeAdtRequestWithAcceptNegotiation)(connection, {
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_TRANSFORMATION,
        },
    }, { logger });
}
/**
 * Get transformation source code
 */
async function getTransformationSource(connection, transformationName, version = 'inactive', options, logger) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(transformationName.toLowerCase());
    const queryParams = [];
    if (version) {
        queryParams.push(`version=${version}`);
    }
    if (options?.withLongPolling) {
        queryParams.push('withLongPolling=true');
    }
    const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    const url = `/sap/bc/adt/xslt/transformations/${encodedName}/source/main${query}`;
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
 * Get transformation transport info
 */
async function getTransformationTransport(connection, transformationName, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(transformationName.toLowerCase());
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    const url = `/sap/bc/adt/xslt/transformations/${encodedName}/transport${query}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_TRANSPORT,
        },
    });
}
