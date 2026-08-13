"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateTransformation = activateTransformation;
const activationUtils_1 = require("../../utils/activationUtils");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Build activation XML payload
 */
function buildActivationXml(transformationName) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/xslt/transformations/${(0, internalUtils_1.encodeSapObjectName)(transformationName.toLowerCase())}" adtcore:name="${transformationName.toUpperCase()}"/>
</adtcore:objectReferences>`;
}
/**
 * Parse activation response
 */
/**
 * Activate transformation
 */
async function activateTransformation(connection, transformationName) {
    const url = '/sap/bc/adt/activation?method=activate&preauditRequested=true';
    const xmlBody = buildActivationXml(transformationName);
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
    (0, activationUtils_1.assertActivationSucceeded)('Transformation', response.data);
    return response;
}
