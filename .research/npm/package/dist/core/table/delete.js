"use strict";
/**
 * Table delete operations - Low-level functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDeletion = checkDeletion;
exports.deleteTable = deleteTable;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Low-level: Check if table can be deleted
 */
async function checkDeletion(connection, params) {
    const { table_name } = params;
    if (!table_name) {
        throw new Error('table_name is required');
    }
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(table_name);
    const objectUri = `/sap/bc/adt/ddic/tables/${encodedName}`;
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
 * Low-level: Delete table
 */
async function deleteTable(connection, params) {
    const { table_name, transport_request } = params;
    if (!table_name) {
        throw new Error('table_name is required');
    }
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(table_name);
    const objectUri = `/sap/bc/adt/ddic/tables/${encodedName}`;
    const deletionUrl = `/sap/bc/adt/deletion/delete`;
    // Tables require empty transportNumber tag if no transport request
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
            table_name,
            object_uri: objectUri,
            transport_request: transport_request || 'local',
            message: `Table ${table_name} deleted successfully`,
        },
    };
}
