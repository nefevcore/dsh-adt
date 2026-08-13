"use strict";
/**
 * FunctionModule create operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = create;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Create function module metadata
 * Low-level function - creates metadata without workflow logic
 */
async function create(connection, params) {
    const encodedGroupName = (0, internalUtils_1.encodeSapObjectName)(params.functionGroupName).toLowerCase();
    const url = `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules${params.transportRequest ? `?corrNr=${params.transportRequest}` : ''}`;
    const masterSystem = params.masterSystem || undefined;
    const username = params.responsible || undefined;
    // Description is limited to 60 characters in SAP ADT
    const limitedDescription = (0, internalUtils_1.limitDescription)(params.description);
    const masterSystemAttr = masterSystem
        ? ` adtcore:masterSystem="${masterSystem}"`
        : '';
    const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<fmodule:abapFunctionModule xmlns:fmodule="http://www.sap.com/adt/functions/fmodules" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${limitedDescription}" adtcore:name="${params.functionModuleName}" adtcore:type="FUGR/FF"${masterSystemAttr}${responsibleAttr}>
  <adtcore:containerRef adtcore:name="${params.functionGroupName}" adtcore:type="FUGR/F" adtcore:uri="/sap/bc/adt/functions/groups/${encodedGroupName}"/>
</fmodule:abapFunctionModule>`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlPayload,
        headers: {
            'Content-Type': contentTypes_1.CT_FUNCTION_MODULE,
            Accept: contentTypes_1.CT_FUNCTION_MODULE,
        },
    });
}
