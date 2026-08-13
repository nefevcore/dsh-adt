"use strict";
/**
 * Feature Toggle activation operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateFeatureToggle = activateFeatureToggle;
const activationUtils_1 = require("../../utils/activationUtils");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
function buildActivationXml(name) {
    const lower = name.toLowerCase();
    const encoded = (0, internalUtils_1.encodeSapObjectName)(lower);
    return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/sfw/featuretoggles/${encoded}" adtcore:name="${name.toUpperCase()}"/>
</adtcore:objectReferences>`;
}
/**
 * Activate a feature toggle.
 */
async function activateFeatureToggle(connection, name) {
    if (!name) {
        throw new Error('Feature toggle name is required');
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
    (0, activationUtils_1.assertActivationSucceeded)('Feature toggle', response.data);
    return response;
}
