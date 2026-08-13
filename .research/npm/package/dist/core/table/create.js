"use strict";
/**
 * Table create operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTable = createTable;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Create empty ABAP table
 * Low-level function: only creates empty table via POST endpoint
 * DDL code should be added via update() method
 */
async function createTable(connection, params) {
    if (!params.table_name) {
        throw new Error('Table name is required');
    }
    if (!params.package_name) {
        throw new Error('Package name is required');
    }
    const masterSystem = params.masterSystem || '';
    const responsible = params.responsible || '';
    // Description is limited to 60 characters in SAP ADT
    const description = (0, internalUtils_1.limitDescription)(params.table_name);
    const masterSystemAttr = masterSystem
        ? ` adtcore:masterSystem="${masterSystem}"`
        : '';
    const responsibleAttr = responsible
        ? ` adtcore:responsible="${responsible}"`
        : '';
    // Create empty table with POST
    const createUrl = `/sap/bc/adt/ddic/tables${params.transport_request ? `?corrNr=${params.transport_request}` : ''}`;
    const tableXml = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${params.masterLanguage || 'EN'}" adtcore:name="${params.table_name.toUpperCase()}" adtcore:type="TABL/DT" adtcore:masterLanguage="${params.masterLanguage || 'EN'}"${masterSystemAttr}${responsibleAttr}>

  <adtcore:packageRef adtcore:name="${params.package_name.toUpperCase()}"/>

</blue:blueSource>`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_TABLE,
        'Content-Type': contentTypes_1.CT_TABLE,
    };
    try {
        const createResponse = await connection.makeAdtRequest({
            url: createUrl,
            method: 'POST',
            timeout: (0, timeouts_1.getTimeout)('default'),
            data: tableXml,
            headers,
        });
        return createResponse;
    }
    catch (error) {
        const e = error;
        const errorMessage = e.response?.data
            ? typeof e.response.data === 'string'
                ? e.response.data
                : (0, internalUtils_1.safeStringify)(e.response.data)
            : e.message;
        throw new Error(`Failed to create table ${params.table_name}: ${errorMessage}`);
    }
}
