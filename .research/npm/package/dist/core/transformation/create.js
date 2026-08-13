"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = create;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Low-level: Create transformation (POST)
 * Does NOT activate - just creates the object
 */
async function create(connection, args) {
    const url = `/sap/bc/adt/xslt/transformations${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;
    const username = args.responsible || '';
    const masterSystem = args.masterSystem || '';
    // Description is limited to 60 characters in SAP ADT
    const description = (0, internalUtils_1.limitDescription)(args.description || args.transformation_name);
    const transformationName = args.transformation_name.toUpperCase();
    const masterSystemAttr = masterSystem
        ? ` adtcore:masterSystem="${masterSystem}"`
        : '';
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><trans:transformation xmlns:trans="http://www.sap.com/adt/transformation" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${args.masterLanguage || 'EN'}" adtcore:name="${transformationName}" adtcore:type="XSLT/VT" adtcore:masterLanguage="${args.masterLanguage || 'EN'}"${masterSystemAttr} adtcore:responsible="${username}" trans:transformationType="${args.transformation_type}">
  <adtcore:packageRef adtcore:name="${args.package_name.toUpperCase()}"/>
</trans:transformation>`;
    const headers = {
        Accept: contentTypes_1.CT_TRANSFORMATION,
        'Content-Type': contentTypes_1.CT_TRANSFORMATION,
    };
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
        headers,
    });
}
