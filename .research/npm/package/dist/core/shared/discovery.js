"use strict";
/**
 * ADT discovery endpoint access
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDiscovery = getDiscovery;
const node_crypto_1 = require("node:crypto");
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Fetch ADT discovery document (endpoint catalog)
 *
 * @param connection - ABAP connection
 * @param params - Optional request/timeout options
 * @returns Discovery XML response
 */
async function getDiscovery(connection, params = {}) {
    const requestId = params.requestId ?? (0, node_crypto_1.randomUUID)().replace(/-/g, '');
    const timeout = params.timeout ?? (0, timeouts_1.getTimeout)('default');
    return connection.makeAdtRequest({
        url: '/sap/bc/adt/discovery',
        method: 'GET',
        timeout,
        headers: {
            Accept: contentTypes_1.ACCEPT_DISCOVERY,
            'sap-adt-request-id': requestId,
        },
    });
}
