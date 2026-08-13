"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = create;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Low-level: Create access control (POST)
 * Does NOT activate - just creates the object
 */
async function create(connection, args) {
    const url = `/sap/bc/adt/acm/dcl/sources${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;
    const username = args.responsible || '';
    const masterSystem = args.masterSystem || '';
    // Description is limited to 60 characters in SAP ADT
    const description = (0, internalUtils_1.limitDescription)(args.description || args.access_control_name);
    const accessControlName = args.access_control_name.toUpperCase();
    const masterSystemAttr = masterSystem
        ? ` adtcore:masterSystem="${masterSystem}"`
        : '';
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><dcl:dclSource xmlns:dcl="http://www.sap.com/adt/acm/dclsources" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${args.masterLanguage || 'EN'}" adtcore:name="${accessControlName}" adtcore:type="DCLS/DL" adtcore:masterLanguage="${args.masterLanguage || 'EN'}"${masterSystemAttr} adtcore:responsible="${username}">
  <adtcore:packageRef adtcore:name="${args.package_name.toUpperCase()}"/>
</dcl:dclSource>`;
    const headers = {
        Accept: contentTypes_1.CT_ACCESS_CONTROL,
        'Content-Type': contentTypes_1.CT_ACCESS_CONTROL,
    };
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
        headers,
    });
}
