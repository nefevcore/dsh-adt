"use strict";
/**
 * View create operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDdl = createDdl;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Create DDLS object with metadata
 */
async function createDDLSObject(connection, args) {
    // Description is limited to 60 characters in SAP ADT
    const description = (0, internalUtils_1.limitDescription)(args.description || args.ddl_name);
    // Check if transport_request is provided and not empty
    // Handle both string and undefined/null cases safely
    const transportRequest = args.transport_request?.trim();
    const hasTransportRequest = transportRequest && transportRequest.length > 0;
    const url = `/sap/bc/adt/ddic/ddl/sources${hasTransportRequest ? `?corrNr=${encodeURIComponent(transportRequest)}` : ''}`;
    const masterSystem = args.masterSystem || '';
    const responsible = args.responsible || '';
    const masterSystemAttr = masterSystem
        ? ` adtcore:masterSystem="${masterSystem}"`
        : '';
    const responsibleAttr = responsible
        ? ` adtcore:responsible="${responsible}"`
        : '';
    const metadataXml = `<?xml version="1.0" encoding="UTF-8"?><ddl:ddlSource xmlns:ddl="http://www.sap.com/adt/ddic/ddlsources" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${args.masterLanguage || 'EN'}" adtcore:name="${args.ddl_name}" adtcore:type="DDLS/DF" adtcore:masterLanguage="${args.masterLanguage || 'EN'}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${args.package_name}"/>
</ddl:ddlSource>`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_VIEW,
        'Content-Type': contentTypes_1.CT_VIEW,
    };
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: metadataXml,
        headers,
    });
}
/**
 * Create ABAP view (CDS DDLS object)
 * Low-level: Only creates the DDLS object metadata, does NOT lock/upload/activate
 * For complete workflow, use AdtDdl
 */
async function createDdl(connection, params) {
    if (!params.ddl_name || !params.package_name) {
        throw new Error('Missing required parameters: ddl_name and package_name');
    }
    return createDDLSObject(connection, params);
}
