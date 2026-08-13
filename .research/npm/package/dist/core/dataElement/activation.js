"use strict";
/**
 * DataElement activation operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateDataElement = activateDataElement;
const activationUtils_1 = require("../../utils/activationUtils");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Build activation XML payload
 */
function buildActivationXml(dataElementName) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/ddic/dataelements/${(0, internalUtils_1.encodeSapObjectName)(dataElementName.toLowerCase())}" adtcore:name="${dataElementName.toUpperCase()}"/>
</adtcore:objectReferences>`;
}
/**
 * Parse activation response
 */
/**
 * Activate data element
 * Makes data element active and usable in SAP system
 */
async function activateDataElement(connection, dataElementName) {
    const url = `/sap/bc/adt/activation?method=activate&preauditRequested=true`;
    const xmlBody = buildActivationXml(dataElementName);
    const headers = {
        Accept: 'application/xml',
        'Content-Type': 'application/xml',
    };
    const response = await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
        headers,
    });
    (0, activationUtils_1.assertActivationSucceeded)('Data element', response.data);
    return response;
}
