"use strict";
/**
 * ServiceDefinition activation operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateServiceDefinition = activateServiceDefinition;
const activationUtils_1 = require("../../utils/activationUtils");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Build activation XML payload
 */
function buildActivationXml(serviceDefinitionName) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/ddic/srvd/sources/${(0, internalUtils_1.encodeSapObjectName)(serviceDefinitionName.toLowerCase())}" adtcore:name="${serviceDefinitionName.toUpperCase()}"/>
</adtcore:objectReferences>`;
}
/**
 * Parse activation response
 */
/**
 * Activate service definition
 * Makes service definition active and usable in SAP system
 */
async function activateServiceDefinition(connection, serviceDefinitionName) {
    const url = `/sap/bc/adt/activation?method=activate&preauditRequested=true`;
    const xmlBody = buildActivationXml(serviceDefinitionName);
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
    (0, activationUtils_1.assertActivationSucceeded)('Service definition', response.data);
    return response;
}
