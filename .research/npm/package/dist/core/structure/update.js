"use strict";
/**
 * Structure update operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = upload;
exports.updateStructure = updateStructure;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Upload structure DDL code (low-level - uses existing lockHandle)
 * This function does NOT lock/unlock - it assumes the object is already locked
 * Used internally by AdtStructure
 */
async function upload(connection, params, lockHandle) {
    const structureNameEncoded = (0, internalUtils_1.encodeSapObjectName)(params.structureName);
    const url = `/sap/bc/adt/ddic/structures/${structureNameEncoded}/source/main?lockHandle=${encodeURIComponent(lockHandle)}${params.transportRequest ? `&corrNr=${params.transportRequest}` : ''}`;
    const headers = {
        Accept: 'application/xml, application/json, text/plain, */*',
        'Content-Type': contentTypes_1.CT_SOURCE,
    };
    return connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: params.ddlCode,
        headers,
    });
}
/**
 * Update structure with DDL code (alias for upload with lockHandle in params)
 */
async function updateStructure(connection, params) {
    return upload(connection, params, params.lockHandle);
}
