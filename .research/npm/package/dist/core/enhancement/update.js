"use strict";
/**
 * Enhancement update operations - Low-level functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.update = update;
exports.updateEnhancement = updateEnhancement;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const types_1 = require("./types");
const debugEnabled = process.env.DEBUG_ADT_LIBS === 'true';
/**
 * Low-level: Update enhancement source code (PUT)
 * Only available for enhoxhh (Source Code Plugin) type
 *
 * NOTE: Object must be locked before calling this function
 *
 * @param connection - SAP connection
 * @param args - Update parameters
 * @returns Axios response
 */
async function update(connection, args, logger) {
    if (!args.enhancement_name) {
        throw new Error('enhancement_name is required');
    }
    if (!args.enhancement_type) {
        throw new Error('enhancement_type is required');
    }
    if (!args.source_code) {
        throw new Error('source_code is required');
    }
    if (!args.lock_handle) {
        throw new Error('lock_handle is required');
    }
    if (!(0, types_1.supportsSourceCode)(args.enhancement_type)) {
        throw new Error(`Enhancement type '${args.enhancement_type}' does not support source code update. Only 'enhoxhh' supports source code.`);
    }
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(args.enhancement_name).toLowerCase();
    const baseUri = (0, types_1.getEnhancementUri)(args.enhancement_type, encodedName);
    // Build URL with parameters
    const params = new URLSearchParams();
    params.append('lockHandle', args.lock_handle);
    if (args.transport_request) {
        params.append('corrNr', args.transport_request);
    }
    const url = `${baseUri}/source/main?${params.toString()}`;
    const headers = {
        'Content-Type': contentTypes_1.CT_SOURCE,
        Accept: contentTypes_1.ACCEPT_SOURCE,
    };
    if (debugEnabled) {
        logger?.debug?.(`[DEBUG] Updating enhancement - URL: ${url}`);
        logger?.debug?.(`[DEBUG] Updating enhancement - Method: PUT`);
        logger?.debug?.(`[DEBUG] Updating enhancement - Headers: ${JSON.stringify(headers, null, 2)}`);
        logger?.debug?.(`[DEBUG] Updating enhancement - Source code length: ${args.source_code.length}`);
    }
    try {
        const response = await connection.makeAdtRequest({
            url,
            method: 'PUT',
            timeout: (0, timeouts_1.getTimeout)('default'),
            data: args.source_code,
            headers,
        });
        return response;
    }
    catch (error) {
        const e = error;
        if (e.response && debugEnabled) {
            logger?.error?.(`[ERROR] Update enhancement failed - Status: ${e.response.status}`);
            logger?.error?.(`[ERROR] Update enhancement failed - StatusText: ${e.response.statusText}`);
            logger?.error?.(`[ERROR] Update enhancement failed - Response headers: ${JSON.stringify(e.response.headers, null, 2)}`);
            logger?.error?.(`[ERROR] Update enhancement failed - Response data (first 1000 chars):`, typeof e.response.data === 'string'
                ? e.response.data.substring(0, 1000)
                : (0, internalUtils_1.safeStringify)(e.response.data).substring(0, 1000));
        }
        throw error;
    }
}
/**
 * Convenience function: Update enhancement with simpler signature
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type
 * @param enhancementName - Enhancement name
 * @param sourceCode - New source code
 * @param lockHandle - Lock handle
 * @param transportRequest - Optional transport request
 * @returns Axios response
 */
async function updateEnhancement(connection, enhancementType, enhancementName, sourceCode, lockHandle, transportRequest, logger) {
    return update(connection, {
        enhancement_name: enhancementName,
        enhancement_type: enhancementType,
        source_code: sourceCode,
        lock_handle: lockHandle,
        transport_request: transportRequest,
    }, logger);
}
