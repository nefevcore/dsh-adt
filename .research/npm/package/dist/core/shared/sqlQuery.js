"use strict";
/**
 * SQL query operations via ADT Data Preview API
 *
 * ⚠️ ABAP Cloud Limitation: Direct execution of SQL queries through ADT Data Preview
 * is blocked by SAP BTP backend policies when using JWT/XSUAA authentication.
 * This function works only for on-premise systems with basic authentication.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSqlQuery = getSqlQuery;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Execute freestyle SQL query via SAP ADT Data Preview API
 *
 * @param connection - ABAP connection
 * @param params - SQL query parameters
 * @returns Query results
 */
async function getSqlQuery(connection, params) {
    if (!params.sql_query) {
        throw new Error('SQL query is required');
    }
    const rowNumber = params.row_number || 100;
    const url = `/sap/bc/adt/datapreview/freestyle?rowNumber=${rowNumber}`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('long'),
        data: params.sql_query,
        headers: {
            'Content-Type': contentTypes_1.CT_SOURCE,
            Accept: contentTypes_1.ACCEPT_DATA_PREVIEW,
        },
    });
}
