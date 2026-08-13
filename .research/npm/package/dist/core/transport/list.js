"use strict";
/**
 * Transport list operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransports = listTransports;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
/**
 * List ABAP transport requests
 *
 * Calls GET /sap/bc/adt/cts/transportrequests with query parameters.
 * Goes through standard connection.makeAdtRequest() so Accept negotiation works.
 */
async function listTransports(connection, params) {
    const query = new URLSearchParams({ user: params.user });
    if (params.status)
        query.append('status', params.status);
    if (params.date_range)
        query.append('dateRange', params.date_range);
    if (params.target_system)
        query.append('targetSystem', params.target_system);
    if (params.request_type)
        query.append('type', params.request_type);
    const url = `/sap/bc/adt/cts/transportrequests?${query.toString()}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: { Accept: contentTypes_1.ACCEPT_TRANSPORT_LIST },
    });
}
