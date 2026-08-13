"use strict";
/**
 * Behavior Definition read operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.read = read;
exports.readSource = readSource;
exports.getBehaviorDefinitionTransport = getBehaviorDefinitionTransport;
const contentTypes_1 = require("../../constants/contentTypes");
const acceptNegotiation_1 = require("../../utils/acceptNegotiation");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Read behavior definition metadata
 *
 * Endpoint: GET /sap/bc/adt/bo/behaviordefinitions/{name}?version=inactive
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param version - Version to read (default: inactive)
 * @returns Axios response with behavior definition metadata (XML)
 *
 * @example
 * ```typescript
 * const response = await read(connection, 'Z_MY_BDEF', sessionId);
 * // Response contains metadata in blue:blueSource XML format
 * ```
 */
async function read(connection, name, _sessionId, version = 'inactive', options, logger) {
    const query = options?.withLongPolling ? `&withLongPolling=true` : '';
    const url = `/sap/bc/adt/bo/behaviordefinitions/${(0, internalUtils_1.encodeSapObjectName)(name).toLowerCase()}?version=${version}${query}`;
    const headers = {
        Accept: options?.accept ?? contentTypes_1.CT_BEHAVIOR_DEFINITION,
    };
    return (0, acceptNegotiation_1.makeAdtRequestWithAcceptNegotiation)(connection, {
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers,
    }, { logger });
}
/**
 * Read behavior definition source code
 *
 * Endpoint: GET /sap/bc/adt/bo/behaviordefinitions/{name}/source/main
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param version - Version to read (default: inactive)
 * @returns Axios response with source code (plain text)
 *
 * @example
 * ```typescript
 * const response = await readSource(connection, 'Z_MY_BDEF', sessionId);
 * const sourceCode = response.data; // BDEF source code
 * ```
 */
async function readSource(connection, name, version = 'inactive', options, logger) {
    const query = options?.withLongPolling ? `&withLongPolling=true` : '';
    const url = `/sap/bc/adt/bo/behaviordefinitions/${(0, internalUtils_1.encodeSapObjectName)(name).toLowerCase()}/source/main?version=${version}${query}`;
    const headers = {
        Accept: options?.accept ?? contentTypes_1.ACCEPT_SOURCE,
    };
    return (0, acceptNegotiation_1.makeAdtRequestWithAcceptNegotiation)(connection, {
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers,
    }, { logger });
}
/**
 * Get transport request for ABAP behavior definition
 * @param connection - SAP connection
 * @param name - Behavior definition name
 * @returns Transport request information
 */
async function getBehaviorDefinitionTransport(connection, name, options) {
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    const url = `/sap/bc/adt/bo/behaviordefinitions/${(0, internalUtils_1.encodeSapObjectName)(name).toLowerCase()}/transport${query}`;
    const headers = {
        Accept: options?.accept ?? contentTypes_1.ACCEPT_TRANSPORT,
    };
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers,
    });
}
