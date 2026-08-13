"use strict";
/**
 * DDIC Activation Graph
 *
 * Provides functions for reading DDIC activation dependency graph with logs:
 * - Get activation graph
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActivationGraph = getActivationGraph;
const timeouts_1 = require("../../utils/timeouts");
/**
 * Get DDIC activation graph with logs
 *
 * @param connection - ABAP connection
 * @param options - Optional parameters
 * @returns Axios response with activation graph
 */
async function getActivationGraph(connection, options) {
    const url = `/sap/bc/adt/ddic/logs/activationgraph`;
    const params = {};
    if (options?.objectName)
        params.objectName = options.objectName;
    if (options?.objectType)
        params.objectType = options.objectType;
    if (options?.logName)
        params.logName = options.logName;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/categories/ddic/logs/activation/graph',
        },
    });
}
