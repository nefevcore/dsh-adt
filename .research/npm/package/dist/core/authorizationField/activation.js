"use strict";
/**
 * AuthorizationField (SUSO / AUTH) activation operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateAuthorizationField = activateAuthorizationField;
const activationUtils_1 = require("../../utils/activationUtils");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
function buildActivationXml(name) {
    const upper = name.toUpperCase();
    const encoded = (0, internalUtils_1.encodeSapObjectName)(upper);
    return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/aps/iam/auth/${encoded}" adtcore:name="${upper}"/>
</adtcore:objectReferences>`;
}
/**
 * Activate an authorization field.
 */
async function activateAuthorizationField(connection, name) {
    if (!name) {
        throw new Error('Authorization field name is required');
    }
    const url = `/sap/bc/adt/activation?method=activate&preauditRequested=true`;
    const xmlBody = buildActivationXml(name);
    const response = await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
        headers: {
            Accept: 'application/xml',
            'Content-Type': 'application/xml',
        },
    });
    (0, activationUtils_1.assertActivationSucceeded)('Authorization field', response.data);
    return response;
}
