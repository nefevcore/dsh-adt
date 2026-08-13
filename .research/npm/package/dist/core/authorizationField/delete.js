"use strict";
/**
 * AuthorizationField (SUSO / AUTH) delete operations - Low-level functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDeletion = checkDeletion;
exports.deleteAuthorizationField = deleteAuthorizationField;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
function objectUri(name) {
    return `/sap/bc/adt/aps/iam/auth/${(0, internalUtils_1.encodeSapObjectName)(name.toUpperCase())}`;
}
/**
 * Low-level: Check if authorization field can be deleted
 */
async function checkDeletion(connection, params) {
    if (!params.authorization_field_name) {
        throw new Error('authorization_field_name is required');
    }
    const uri = objectUri(params.authorization_field_name);
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${uri}"/>
</del:checkRequest>`;
    return connection.makeAdtRequest({
        url: '/sap/bc/adt/deletion/check',
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlPayload,
        headers: {
            Accept: contentTypes_1.ACCEPT_DELETION_CHECK,
            'Content-Type': contentTypes_1.CT_DELETION_CHECK,
        },
    });
}
/**
 * Low-level: Delete authorization field
 */
async function deleteAuthorizationField(connection, params) {
    if (!params.authorization_field_name) {
        throw new Error('authorization_field_name is required');
    }
    const uri = objectUri(params.authorization_field_name);
    const transportTag = params.transport_request?.trim()
        ? `<del:transportNumber>${params.transport_request}</del:transportNumber>`
        : '<del:transportNumber/>';
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${uri}">
    ${transportTag}
  </del:object>
</del:deletionRequest>`;
    const response = await connection.makeAdtRequest({
        url: '/sap/bc/adt/deletion/delete',
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlPayload,
        headers: {
            Accept: contentTypes_1.ACCEPT_DELETION,
            'Content-Type': contentTypes_1.CT_DELETION,
        },
    });
    return {
        ...response,
        data: {
            success: true,
            authorization_field_name: params.authorization_field_name,
            object_uri: uri,
            transport_request: params.transport_request || 'local',
            message: `Authorization field ${params.authorization_field_name} deleted successfully`,
        },
    };
}
