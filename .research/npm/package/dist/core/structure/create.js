"use strict";
/**
 * Structure create operations
 * NOTE: Caller should call connection.setSessionType("stateful") before creating
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = create;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Create empty structure metadata via POST
 * Low-level function - creates metadata without DDL content
 */
async function create(connection, params) {
    const createUrl = `/sap/bc/adt/ddic/structures${params.transportRequest ? `?corrNr=${params.transportRequest}` : ''}`;
    const masterSystem = params.masterSystem || '';
    const responsible = params.responsible || '';
    // Description is limited to 60 characters in SAP ADT
    const limitedDescription = (0, internalUtils_1.limitDescription)(params.description);
    const masterSystemAttr = masterSystem
        ? ` adtcore:masterSystem="${masterSystem}"`
        : '';
    const responsibleAttr = responsible
        ? ` adtcore:responsible="${responsible}"`
        : '';
    const structureXml = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${limitedDescription}" adtcore:language="${params.masterLanguage || 'EN'}" adtcore:name="${params.structureName.toUpperCase()}" adtcore:type="TABL/DS" adtcore:masterLanguage="${params.masterLanguage || 'EN'}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${params.packageName.toUpperCase()}"/>
</blue:blueSource>`;
    const headers = {
        Accept: 'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.structures.v2+xml',
        'Content-Type': contentTypes_1.CT_STRUCTURE,
    };
    return connection.makeAdtRequest({
        url: createUrl,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: structureXml,
        headers,
    });
}
