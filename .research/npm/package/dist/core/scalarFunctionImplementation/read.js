"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getScalarFunctionImplementation = getScalarFunctionImplementation;
exports.getScalarFunctionImplementationSource = getScalarFunctionImplementationSource;
exports.getScalarFunctionImplementationTransport = getScalarFunctionImplementationTransport;
const contentTypes_1 = require("../../constants/contentTypes");
const acceptNegotiation_1 = require("../../utils/acceptNegotiation");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
function buildQuery(version, options) {
    const q = [];
    if (version)
        q.push(`version=${version}`);
    if (options?.withLongPolling)
        q.push('withLongPolling=true');
    return q.length ? `?${q.join('&')}` : '';
}
async function getScalarFunctionImplementation(connection, name, version = 'inactive', options, logger) {
    const url = `/sap/bc/adt/ddic/dsfi/${(0, internalUtils_1.encodeSapObjectName)(name.toLowerCase())}${buildQuery(version, options)}`;
    return (0, acceptNegotiation_1.makeAdtRequestWithAcceptNegotiation)(connection, {
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: { Accept: options?.accept ?? contentTypes_1.ACCEPT_SCALAR_FUNCTION_IMPL },
    }, { logger });
}
async function getScalarFunctionImplementationSource(connection, name, version = 'inactive', options, logger) {
    const url = `/sap/bc/adt/ddic/dsfi/${(0, internalUtils_1.encodeSapObjectName)(name.toLowerCase())}/source/main${buildQuery(version, options)}`;
    return (0, acceptNegotiation_1.makeAdtRequestWithAcceptNegotiation)(connection, {
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: options?.accept ?? contentTypes_1.ACCEPT_SCALAR_FUNCTION_IMPL_SOURCE,
        },
    }, { logger });
}
async function getScalarFunctionImplementationTransport(connection, name, options) {
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    const url = `/sap/bc/adt/ddic/dsfi/${(0, internalUtils_1.encodeSapObjectName)(name.toLowerCase())}/transport${query}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: { Accept: options?.accept ?? contentTypes_1.ACCEPT_TRANSPORT },
    });
}
