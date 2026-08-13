"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = create;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const xml_1 = require("../../utils/xml");
async function create(connection, args) {
    if (!args.scalar_function_name || !args.package_name) {
        throw new Error('Missing required parameters: scalar_function_name and package_name');
    }
    const transport = args.transport_request?.trim();
    const url = `/sap/bc/adt/ddic/dsfd/sources${transport ? `?corrNr=${encodeURIComponent(transport)}` : ''}`;
    const lang = args.masterLanguage || 'EN';
    const name = (0, xml_1.escapeXmlAttr)(args.scalar_function_name.toUpperCase());
    const pkg = (0, xml_1.escapeXmlAttr)(args.package_name.toUpperCase());
    const description = (0, xml_1.escapeXmlAttr)((0, internalUtils_1.limitDescription)(args.description || args.scalar_function_name));
    const masterSystemAttr = args.masterSystem
        ? ` adtcore:masterSystem="${(0, xml_1.escapeXmlAttr)(args.masterSystem)}"`
        : '';
    const responsibleAttr = args.responsible
        ? ` adtcore:responsible="${(0, xml_1.escapeXmlAttr)(args.responsible)}"`
        : '';
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${lang}" adtcore:name="${name}" adtcore:type="DSFD/SCF" adtcore:masterLanguage="${lang}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${pkg}"/>
</blue:blueSource>`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
        headers: {
            Accept: contentTypes_1.ACCEPT_SCALAR_FUNCTION,
            'Content-Type': contentTypes_1.CT_SCALAR_FUNCTION,
        },
    });
}
