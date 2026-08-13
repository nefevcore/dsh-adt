"use strict";
/**
 * Enhancement delete operations - Low-level functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDeletion = checkDeletion;
exports.deleteEnhancement = deleteEnhancement;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const types_1 = require("./types");
/**
 * Low-level: Check if enhancement can be deleted (deletion check)
 *
 * @param connection - SAP connection
 * @param params - Delete parameters
 * @returns Axios response with deletion check result
 */
async function checkDeletion(connection, params) {
    const { enhancement_name, enhancement_type } = params;
    if (!enhancement_name) {
        throw new Error('enhancement_name is required');
    }
    if (!enhancement_type) {
        throw new Error('enhancement_type is required');
    }
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(enhancement_name);
    const objectUri = (0, types_1.getEnhancementUri)(enhancement_type, encodedName);
    const checkUrl = `/sap/bc/adt/deletion/check`;
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
 * Low-level: Delete enhancement using ADT deletion API
 *
 * @param connection - SAP connection
 * @param params - Delete parameters
 * @returns Axios response with deletion result
 */
async function deleteEnhancement(connection, params) {
    const { enhancement_name, enhancement_type, transport_request } = params;
    if (!enhancement_name) {
        throw new Error('enhancement_name is required');
    }
    if (!enhancement_type) {
        throw new Error('enhancement_type is required');
    }
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(enhancement_name);
    const objectUri = (0, types_1.getEnhancementUri)(enhancement_type, encodedName);
    const deletionUrl = `/sap/bc/adt/deletion/delete`;
    // Build transport number tag
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
            enhancement_name,
            enhancement_type,
            object_uri: objectUri,
            transport_request: transport_request || 'local',
            message: `Enhancement ${enhancement_name} deleted successfully`,
        },
    };
}
