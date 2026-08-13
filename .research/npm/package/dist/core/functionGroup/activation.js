"use strict";
/**
 * FunctionGroup activation operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateFunctionGroup = activateFunctionGroup;
const internalUtils_1 = require("../../utils/internalUtils");
/**
 * Activate function group
 */
async function activateFunctionGroup(connection, functionGroupName) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(functionGroupName).toLowerCase();
    const objectUri = `/sap/bc/adt/functions/groups/${encodedName}`;
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="${objectUri}" adtcore:name="${functionGroupName}"/>
</adtcore:objectReferences>`;
    const url = `/sap/bc/adt/activation?method=activate&preauditRequested=true`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: 30000, // 30 seconds for activation
        data: xmlPayload,
        headers: {
            'Content-Type': 'application/xml',
            Accept: 'application/xml',
        },
    });
}
