"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDeletion = checkDeletion;
exports.deleteAppendStructure = deleteAppendStructure;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
function objectUri(name) {
    return `/sap/bc/adt/ddic/structures/${(0, internalUtils_1.encodeSapObjectName)(name.toLowerCase())}`;
}
async function checkDeletion(connection, params) {
    if (!params.append_structure_name)
        throw new Error('append_structure_name is required');
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri(params.append_structure_name)}"/>
</del:checkRequest>`;
    return connection.makeAdtRequest({
        url: `/sap/bc/adt/deletion/check`,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlPayload,
        headers: {
            Accept: contentTypes_1.ACCEPT_DELETION_CHECK,
            'Content-Type': contentTypes_1.CT_DELETION_CHECK,
        },
    });
}
async function deleteAppendStructure(connection, params) {
    if (!params.append_structure_name)
        throw new Error('append_structure_name is required');
    const transportNumberTag = params.transport_request?.trim()
        ? `<del:transportNumber>${params.transport_request}</del:transportNumber>`
        : '<del:transportNumber/>';
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri(params.append_structure_name)}">
    ${transportNumberTag}
  </del:object>
</del:deletionRequest>`;
    const response = await connection.makeAdtRequest({
        url: `/sap/bc/adt/deletion/delete`,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlPayload,
        headers: { Accept: contentTypes_1.ACCEPT_DELETION, 'Content-Type': contentTypes_1.CT_DELETION },
    });
    return {
        ...response,
        data: {
            success: true,
            append_structure_name: params.append_structure_name,
            object_uri: objectUri(params.append_structure_name),
            transport_request: params.transport_request || 'local',
            message: `Append structure ${params.append_structure_name} deleted successfully`,
        },
    };
}
