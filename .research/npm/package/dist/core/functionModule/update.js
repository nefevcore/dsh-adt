"use strict";
/**
 * FunctionModule update operations - low-level functions for AdtFunctionModule
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.update = update;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Upload function module source code (low-level - uses existing lockHandle)
 * This function does NOT lock/unlock - it assumes the object is already locked
 * Used internally by AdtFunctionModule
 */
async function update(connection, params, contentTypes) {
    const encodedGroupName = (0, internalUtils_1.encodeSapObjectName)(params.functionGroupName).toLowerCase();
    const encodedModuleName = (0, internalUtils_1.encodeSapObjectName)(params.functionModuleName).toLowerCase();
    let url = `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules/${encodedModuleName}/source/main?lockHandle=${encodeURIComponent(params.lockHandle)}`;
    if (params.transportRequest) {
        url += `&corrNr=${params.transportRequest}`;
    }
    const sourceContentType = contentTypes?.sourceArtifactContentType();
    const headers = {
        'Content-Type': sourceContentType || contentTypes_1.CT_SOURCE,
        Accept: contentTypes_1.ACCEPT_SOURCE,
    };
    const response = await connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: params.sourceCode,
        headers,
    });
    return response;
}
