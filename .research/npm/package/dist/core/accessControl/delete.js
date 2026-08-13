"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDeletion = checkDeletion;
exports.deleteAccessControl = deleteAccessControl;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Low-level: Check if access control can be deleted
 */
async function checkDeletion(connection, params) {
    const { access_control_name } = params;
    if (!access_control_name) {
        throw new Error('access_control_name is required');
    }
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(access_control_name);
    const objectUri = `/sap/bc/adt/acm/dcl/sources/${encodedName}`;
    const checkUrl = '/sap/bc/adt/deletion/check';
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri}"/>
</del:checkRequest>`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_DELETION_CHECK,
        'Content-Type': contentTypes_1.CT_DELETION_CHECK,
    };
    return await connection.makeAdtRequest({
        url: checkUrl,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlPayload,
        headers,
    });
}
/**
 * Low-level: Delete access control
 */
async function deleteAccessControl(connection, params) {
    const { access_control_name, transport_request } = params;
    if (!access_control_name) {
        throw new Error('access_control_name is required');
    }
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(access_control_name);
    const objectUri = `/sap/bc/adt/acm/dcl/sources/${encodedName}`;
    const deletionUrl = '/sap/bc/adt/deletion/delete';
    // Access Controls require empty transportNumber tag if no transport request
    let transportNumberTag = '';
    if (transport_request?.trim()) {
        transportNumberTag = `<del:transportNumber>${transport_request}</del:transportNumber>`;
    }
    else {
        transportNumberTag = '<del:transportNumber/>';
    }
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri}">
    ${transportNumberTag}
  </del:object>
</del:deletionRequest>`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_DELETION,
        'Content-Type': contentTypes_1.CT_DELETION,
    };
    const response = await connection.makeAdtRequest({
        url: deletionUrl,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlPayload,
        headers,
    });
    return {
        ...response,
        data: {
            success: true,
            access_control_name,
            object_uri: objectUri,
            transport_request: transport_request || 'local',
            message: `Access control ${access_control_name} deleted successfully`,
        },
    };
}
