"use strict";
/**
 * ATC (ABAP Test Cockpit) Logs
 *
 * Provides functions for reading ATC check failure logs and execution logs:
 * - Get check failure logs
 * - Get execution log
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCheckFailureLogs = getCheckFailureLogs;
exports.getExecutionLog = getExecutionLog;
const timeouts_1 = require("../../utils/timeouts");
/**
 * Get ATC check failure logs
 *
 * @param connection - ABAP connection
 * @param options - Optional filters
 * @returns Axios response with check failure logs
 */
async function getCheckFailureLogs(connection, options) {
    const url = `/sap/bc/adt/atc/checkfailures/logs`;
    const params = {};
    if (options?.displayId)
        params.displayId = options.displayId;
    if (options?.objName)
        params.objName = options.objName;
    if (options?.objType)
        params.objType = options.objType;
    if (options?.moduleId)
        params.moduleId = options.moduleId;
    if (options?.phaseKey)
        params.phaseKey = options.phaseKey;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/atc/relations/checkfailures/logs',
        },
    });
}
/**
 * Get ATC execution log
 *
 * @param connection - ABAP connection
 * @param executionId - Execution ID
 * @returns Axios response with execution log
 */
async function getExecutionLog(connection, executionId) {
    const url = `/sap/bc/adt/atc/results/${executionId}/log`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/atc/relations/results/log',
        },
    });
}
