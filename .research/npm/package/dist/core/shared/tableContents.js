"use strict";
/**
 * Table contents operations via ADT DDIC Data Preview API
 *
 * Retrieves table metadata to build field list, then uses the DDIC Data Preview
 * endpoint with POST and SQL query in body (TABLE~FIELD syntax, same as Eclipse ADT).
 *
 * ⚠️ ABAP Cloud Limitation: Direct access to table data through ADT Data Preview
 * is blocked by SAP BTP backend policies when using JWT/XSUAA authentication.
 * This function works only for on-premise systems with basic authentication.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTableContents = getTableContents;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const ACCEPT_HEADER = contentTypes_1.ACCEPT_DATA_PREVIEW;
/**
 * Get column names for a DDIC entity via metadata endpoint
 */
async function getColumnNames(connection, tableName) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(tableName);
    const url = `/sap/bc/adt/datapreview/ddic/${encodedName}/metadata`;
    const response = await connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: ACCEPT_HEADER,
        },
    });
    const xml = response.data;
    const fields = [];
    const fieldMatches = xml.match(/dataPreview:name="([^"]+)"/g);
    if (fieldMatches) {
        for (const match of fieldMatches) {
            const nameMatch = match.match(/dataPreview:name="([^"]+)"/);
            if (nameMatch) {
                fields.push(nameMatch[1]);
            }
        }
    }
    return fields;
}
/**
 * Get table contents via ADT DDIC Data Preview API
 *
 * @param connection - ABAP connection
 * @param params - Table contents parameters
 * @returns Table contents
 */
async function getTableContents(connection, params) {
    if (!params.table_name) {
        throw new Error('Table name is required');
    }
    const maxRows = params.max_rows || 100;
    const tableName = params.table_name.toUpperCase();
    // Get column names via metadata endpoint (as Eclipse ADT does)
    const fields = await getColumnNames(connection, tableName);
    if (fields.length === 0) {
        throw new Error('Could not retrieve column names from table metadata');
    }
    // Build SQL with TABLE~FIELD syntax (as Eclipse ADT does)
    const fieldList = fields.map((f) => `${tableName}~${f}`).join(', ');
    const sqlQuery = `SELECT ${fieldList} FROM ${tableName}`;
    const url = `/sap/bc/adt/datapreview/ddic?rowNumber=${maxRows}&ddicEntityName=${encodeURIComponent(tableName)}`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('long'),
        data: sqlQuery,
        headers: {
            'Content-Type': 'text/plain',
            Accept: ACCEPT_HEADER,
        },
    });
}
