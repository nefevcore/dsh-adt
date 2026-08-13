"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateAppendStructure = activateAppendStructure;
const activationUtils_1 = require("../../utils/activationUtils");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
function buildActivationXml(name) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/ddic/structures/${(0, internalUtils_1.encodeSapObjectName)(name.toLowerCase())}" adtcore:name="${name.toUpperCase()}"/>
</adtcore:objectReferences>`;
}
async function activateAppendStructure(connection, name) {
    const url = `/sap/bc/adt/activation?method=activate&preauditRequested=true`;
    const response = await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: buildActivationXml(name),
        headers: { Accept: 'application/xml', 'Content-Type': 'application/xml' },
    });
    (0, activationUtils_1.assertActivationSucceeded)('Append structure', response.data);
    return response;
}
