"use strict";
/**
 * AMDP Debugger Data Preview
 *
 * Provides functions for data preview during AMDP debugging:
 * - Data preview for variables
 * - Cell substring retrieval
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAmdpDataPreview = getAmdpDataPreview;
exports.getAmdpCellSubstring = getAmdpCellSubstring;
const timeouts_1 = require("../../utils/timeouts");
/**
 * Get AMDP debugger data preview
 *
 * @param connection - ABAP connection
 * @param options - Data preview options
 * @returns Axios response with data preview
 */
async function getAmdpDataPreview(connection, options) {
    const url = `/sap/bc/adt/datapreview/amdpdebugger`;
    const params = {};
    if (options?.rowNumber !== undefined)
        params.rowNumber = options.rowNumber;
    if (options?.colNumber !== undefined)
        params.colNumber = options.colNumber;
    if (options?.sessionId)
        params.sessionId = options.sessionId;
    if (options?.debuggerId)
        params.debuggerId = options.debuggerId;
    if (options?.debuggeeId)
        params.debuggeeId = options.debuggeeId;
    if (options?.variableName)
        params.variableName = options.variableName;
    if (options?.schema)
        params.schema = options.schema;
    if (options?.provideRowId !== undefined)
        params.provideRowId = options.provideRowId;
    if (options?.action)
        params.action = options.action;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/categories/datapreview/amdpdebugger',
        },
    });
}
/**
 * Get cell substring from AMDP debugger data preview
 *
 * @param connection - ABAP connection
 * @param options - Cell substring options
 * @returns Axios response with cell substring
 */
async function getAmdpCellSubstring(connection, options) {
    const url = `/sap/bc/adt/datapreview/amdpdebugger/cellsubstring`;
    const params = {};
    if (options?.rowNumber !== undefined)
        params.rowNumber = options.rowNumber;
    if (options?.columnName)
        params.columnName = options.columnName;
    if (options?.sessionId)
        params.sessionId = options.sessionId;
    if (options?.debuggerId)
        params.debuggerId = options.debuggerId;
    if (options?.debuggeeId)
        params.debuggeeId = options.debuggeeId;
    if (options?.variableName)
        params.variableName = options.variableName;
    if (options?.valueOffset !== undefined)
        params.valueOffset = options.valueOffset;
    if (options?.valueLength !== undefined)
        params.valueLength = options.valueLength;
    if (options?.schema)
        params.schema = options.schema;
    if (options?.action)
        params.action = options.action;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        params,
        headers: {
            Accept: 'application/xml',
            'X-sap-adt-relation': 'http://www.sap.com/adt/categories/datapreview/amdpdebugger/cellsubstring',
        },
    });
}
