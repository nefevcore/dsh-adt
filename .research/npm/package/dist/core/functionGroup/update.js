"use strict";
/**
 * FunctionGroup update operations
 *
 * Note: Function groups are containers for function modules.
 * They don't have source code to update directly, but metadata can be updated.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateFunctionGroup = updateFunctionGroup;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const xmlPatch_1 = require("../../utils/xmlPatch");
const lock_1 = require("./lock");
const read_1 = require("./read");
const unlock_1 = require("./unlock");
/**
 * Update function group metadata via PUT (read-modify-write pattern)
 */
async function updateFunctionGroupMetadata(connection, functionGroupName, currentXml, newDescription, lockHandle, transportRequest, contentTypes) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(functionGroupName);
    const url = `/sap/bc/adt/functions/groups/${encodedName}${lockHandle ? `?lockHandle=${encodeURIComponent(lockHandle)}` : ''}${transportRequest ? `${lockHandle ? '&' : '?'}corrNr=${transportRequest}` : ''}`;
    const limitedDescription = (0, internalUtils_1.limitDescription)(newDescription);
    const updatedXml = (0, xmlPatch_1.patchXmlAttribute)(currentXml, 'adtcore:description', limitedDescription);
    const ct = contentTypes?.functionGroupUpdate();
    const headers = {
        'Content-Type': ct?.contentType ||
            'application/vnd.sap.adt.functions.groups.v3+xml; charset=utf-8',
        Accept: ct?.accept || contentTypes_1.CT_FUNCTION_GROUP,
    };
    return connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: updatedXml,
        headers,
    });
}
/**
 * Update function group metadata (description)
 * Full workflow: lock -> get current -> update -> unlock
 */
async function updateFunctionGroup(connection, params, contentTypes) {
    if (!params.function_group_name) {
        throw new Error('function_group_name is required');
    }
    if (!params.description) {
        throw new Error('description is required for update');
    }
    let lockHandle = params.lock_handle;
    let shouldUnlock = false;
    try {
        // Lock if not already locked
        if (!lockHandle) {
            lockHandle = await (0, lock_1.lockFunctionGroup)(connection, params.function_group_name);
            shouldUnlock = true;
        }
        if (!lockHandle) {
            throw new Error('Failed to acquire lock handle');
        }
        // Get current XML
        const currentResponse = await (0, read_1.getFunctionGroup)(connection, params.function_group_name, undefined);
        const currentXml = (0, xmlPatch_1.extractXmlString)(currentResponse.data, `function group ${params.function_group_name}`);
        // Update metadata
        const updateResponse = await updateFunctionGroupMetadata(connection, params.function_group_name, currentXml, params.description, lockHandle, params.transport_request, contentTypes);
        // Unlock if we locked it
        if (shouldUnlock && lockHandle) {
            await (0, unlock_1.unlockFunctionGroup)(connection, params.function_group_name, lockHandle);
        }
        return updateResponse;
    }
    catch (error) {
        const e = error;
        // Unlock on error if we locked it
        if (shouldUnlock && lockHandle) {
            try {
                await (0, unlock_1.unlockFunctionGroup)(connection, params.function_group_name, lockHandle);
            }
            catch (_unlockError) {
                // Ignore unlock errors
            }
        }
        let errorMessage = `Failed to update function group: ${error}`;
        if (e.response?.status === 400) {
            errorMessage = `Bad request. Check parameters.`;
        }
        else if (e.response?.status === 404) {
            errorMessage = `Function group ${params.function_group_name} not found.`;
        }
        else if (e.response?.data && typeof e.response.data === 'string') {
            try {
                const { XMLParser } = require('fast-xml-parser');
                const parser = new XMLParser({
                    ignoreAttributes: false,
                    attributeNamePrefix: '@_',
                });
                const errorData = parser.parse(e.response.data);
                const errorMsg = errorData['exc:exception']?.message?.['#text'] ||
                    errorData['exc:exception']?.message;
                if (errorMsg) {
                    errorMessage = `SAP Error: ${errorMsg}`;
                }
            }
            catch (_parseError) {
                // Keep original error message
            }
        }
        throw new Error(errorMessage);
    }
}
