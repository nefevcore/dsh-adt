"use strict";
/**
 * TableType create operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTableType = createTableType;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Create empty ABAP table type (XML-based entity like Domain/DataElement)
 * Low-level function: creates empty table type via POST endpoint
 * rowType should be added via update() method
 */
async function createTableType(connection, params) {
    if (!params.tabletype_name) {
        throw new Error('TableType name is required');
    }
    if (!params.package_name) {
        throw new Error('Package name is required');
    }
    const masterSystem = params.masterSystem || '';
    const responsible = params.responsible || '';
    // Description is limited to 60 characters in SAP ADT
    const description = (0, internalUtils_1.limitDescription)(params.description || params.tabletype_name);
    const masterSystemAttr = masterSystem
        ? ` adtcore:masterSystem="${masterSystem}"`
        : '';
    const responsibleAttr = responsible
        ? ` adtcore:responsible="${responsible}"`
        : '';
    // Create empty table type with POST using XML format (ttyp:tableType)
    const createUrl = `/sap/bc/adt/ddic/tabletypes${params.transport_request ? `?corrNr=${params.transport_request}` : ''}`;
    // Empty table type XML (rowType added via update)
    const tableTypeXml = `<?xml version="1.0" encoding="UTF-8"?><ttyp:tableType xmlns:ttyp="http://www.sap.com/dictionary/tabletype" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${params.masterLanguage || 'EN'}" adtcore:name="${params.tabletype_name.toUpperCase()}" adtcore:type="TTYP/DA" adtcore:masterLanguage="${params.masterLanguage || 'EN'}"${masterSystemAttr}${responsibleAttr}>
    
  <adtcore:packageRef adtcore:name="${params.package_name.toUpperCase()}"/>
  
</ttyp:tableType>`;
    const headers = {
        Accept: contentTypes_1.CT_TABLE_TYPE,
        'Content-Type': contentTypes_1.CT_TABLE_TYPE,
    };
    try {
        const createResponse = await connection.makeAdtRequest({
            url: createUrl,
            method: 'POST',
            timeout: (0, timeouts_1.getTimeout)('default'),
            data: tableTypeXml,
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
        throw new Error(`Failed to create table type ${params.tabletype_name}: ${errorMessage}`);
    }
}
