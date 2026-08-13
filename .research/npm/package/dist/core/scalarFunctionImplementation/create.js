"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildServerDrivenContent = buildServerDrivenContent;
exports.create = create;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const xml_1 = require("../../utils/xml");
/** base64 of {"scalarFunctionName":<upper>,"engineValue":<engine>} (key order fixed). */
function buildServerDrivenContent(scalarFunctionName, engineValue) {
    const json = JSON.stringify({
        scalarFunctionName: scalarFunctionName.toUpperCase(),
        engineValue,
    });
    return Buffer.from(json, 'utf-8').toString('base64');
}
async function create(connection, args) {
    if (!args.implementation_name ||
        !args.scalar_function_name ||
        !args.package_name) {
        throw new Error('Missing required parameters: implementation_name, scalar_function_name and package_name');
    }
    const transport = args.transport_request?.trim();
    const url = `/sap/bc/adt/ddic/dsfi${transport ? `?corrNr=${encodeURIComponent(transport)}` : ''}`;
    const lang = args.masterLanguage || 'EN';
    const name = (0, xml_1.escapeXmlAttr)(args.implementation_name.toUpperCase());
    const pkg = (0, xml_1.escapeXmlAttr)(args.package_name.toUpperCase());
    const description = (0, xml_1.escapeXmlAttr)((0, internalUtils_1.limitDescription)(args.description || args.implementation_name));
    const masterSystemAttr = args.masterSystem
        ? ` adtcore:masterSystem="${(0, xml_1.escapeXmlAttr)(args.masterSystem)}"`
        : '';
    const responsibleAttr = args.responsible
        ? ` adtcore:responsible="${(0, xml_1.escapeXmlAttr)(args.responsible)}"`
        : '';
    const content = buildServerDrivenContent(args.scalar_function_name, args.engine_value || 'sqlEngine');
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${lang}" adtcore:name="${name}" adtcore:type="DSFI/SFI" adtcore:masterLanguage="${lang}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${pkg}"/>
  <blue:additionalCreationProperties>
    <adtcore:content adtcore:encoding="base64" adtcore:type="application/vnd.sap.adt.serverdriven.content.v1+json">${content}</adtcore:content>
  </blue:additionalCreationProperties>
</blue:blueSource>`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
        headers: {
            Accept: contentTypes_1.ACCEPT_SCALAR_FUNCTION_IMPL,
            'Content-Type': contentTypes_1.CT_SCALAR_FUNCTION_IMPL,
        },
    });
}
