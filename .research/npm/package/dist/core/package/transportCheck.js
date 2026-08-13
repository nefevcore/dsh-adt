"use strict";
/**
 * Package transport check operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkTransportRequirements = checkTransportRequirements;
const fast_xml_parser_1 = require("fast-xml-parser");
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Step 2: Check transport requirements
 */
async function checkTransportRequirements(connection, args, transportLayer) {
    const qs = (0, internalUtils_1.buildQueryString)({ transportLayer });
    const url = `/sap/bc/adt/cts/transportchecks?${qs}`;
    const encodedPackageName = (0, internalUtils_1.encodeSapObjectName)(args.package_name.toLowerCase());
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
    <DATA>
      <PGMID/>
      <OBJECT/>
      <OBJECTNAME/>
      <DEVCLASS>${args.package_name}</DEVCLASS>
      <SUPER_PACKAGE>${args.super_package}</SUPER_PACKAGE>
      <RECORD_CHANGES/>
      <OPERATION>I</OPERATION>
      <URI>/sap/bc/adt/packages/${encodedPackageName}</URI>
    </DATA>
  </asx:values>
</asx:abap>`;
    const response = await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
        headers: {
            Accept: contentTypes_1.ACCEPT_TRANSPORT_CHECK,
            'Content-Type': contentTypes_1.CT_TRANSPORT_CHECK,
        },
    });
    const parser = new fast_xml_parser_1.XMLParser({ ignoreAttributes: false });
    const result = parser.parse(response.data);
    const data = result['asx:abap']?.['asx:values']?.DATA;
    if (data?.RESULT !== 'S') {
        throw new Error('Transport check failed');
    }
    const requests = data?.REQUESTS?.CTS_REQUEST || [];
    const transportList = Array.isArray(requests) ? requests : [requests];
    const transportNumbers = transportList
        .map((req) => req.REQ_HEADER?.TRKORR)
        .filter((trkorr) => trkorr);
    return transportNumbers;
}
