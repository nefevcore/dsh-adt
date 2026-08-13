"use strict";
/**
 * ServiceDefinition read operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServiceDefinition = getServiceDefinition;
exports.getServiceDefinitionSource = getServiceDefinitionSource;
exports.getServiceDefinitionTransport = getServiceDefinitionTransport;
const contentTypes_1 = require("../../constants/contentTypes");
const acceptNegotiation_1 = require("../../utils/acceptNegotiation");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Get ABAP service definition
 */
async function getServiceDefinition(connection, serviceDefinitionName, version = 'inactive', options, logger) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(serviceDefinitionName.toLowerCase());
    const queryParams = [];
    if (version) {
        queryParams.push(`version=${version}`);
    }
    if (options?.withLongPolling) {
        queryParams.push('withLongPolling=true');
    }
    const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    const url = `/sap/bc/adt/ddic/srvd/sources/${encodedName}${query}`;
    return (0, acceptNegotiation_1.makeAdtRequestWithAcceptNegotiation)(connection, {
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.CT_SERVICE_DEFINITION,
        },
    }, { logger });
}
/**
 * Get service definition source code
 */
async function getServiceDefinitionSource(connection, serviceDefinitionName, version = 'inactive', options, logger) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(serviceDefinitionName.toLowerCase());
    const queryParams = [];
    if (version) {
        queryParams.push(`version=${version}`);
    }
    if (options?.withLongPolling) {
        queryParams.push('withLongPolling=true');
    }
    const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    const url = `/sap/bc/adt/ddic/srvd/sources/${encodedName}/source/main${query}`;
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
 * Get transport request for ABAP service definition
 * @param connection - SAP connection
 * @param serviceDefinitionName - Service definition name
 * @returns Transport request information
 */
async function getServiceDefinitionTransport(connection, serviceDefinitionName, options) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(serviceDefinitionName.toLowerCase());
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    const url = `/sap/bc/adt/ddic/srvd/sources/${encodedName}/transport${query}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_TRANSPORT,
        },
    });
}
