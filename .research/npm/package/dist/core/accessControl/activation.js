"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateAccessControl = activateAccessControl;
const activationUtils_1 = require("../../utils/activationUtils");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Build activation XML payload
 */
function buildActivationXml(accessControlName) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/acm/dcl/sources/${(0, internalUtils_1.encodeSapObjectName)(accessControlName.toLowerCase())}" adtcore:name="${accessControlName.toUpperCase()}"/>
</adtcore:objectReferences>`;
}
/**
 * Parse activation response
 */
/**
 * Activate access control
 */
async function activateAccessControl(connection, accessControlName) {
    const url = '/sap/bc/adt/activation?method=activate&preauditRequested=true';
    const xmlBody = buildActivationXml(accessControlName);
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
    (0, activationUtils_1.assertActivationSucceeded)('Access control', response.data);
    return response;
}
