"use strict";
/**
 * FunctionInclude (FUGR/I) metadata update operations.
 *
 * Requires a valid lockHandle (acquired via lockFunctionInclude).
 * Body is identical to create; only the URL differs (PUT to single-object URL
 * with ?lockHandle=...).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateFunctionInclude = updateFunctionInclude;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const xmlBuilder_1 = require("./xmlBuilder");
const debugEnabled = process.env.DEBUG_ADT_LIBS === 'true';
/**
 * Update function include metadata via PUT.
 */
async function updateFunctionInclude(connection, params, lockHandle, logger) {
    if (!params.function_group_name) {
        throw new Error('function_group_name is required');
    }
    if (!params.include_name) {
        throw new Error('include_name is required');
    }
    if (!lockHandle) {
        throw new Error('lockHandle is required for update');
    }
    const groupLower = (0, internalUtils_1.encodeSapObjectName)(params.function_group_name).toLowerCase();
    const encodedInclude = (0, internalUtils_1.encodeSapObjectName)(params.include_name.toUpperCase());
    const corrNr = params.transport_request
        ? `&corrNr=${encodeURIComponent(params.transport_request)}`
        : '';
    const url = `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}?lockHandle=${encodeURIComponent(lockHandle)}${corrNr}`;
    const xmlBody = (0, xmlBuilder_1.buildFunctionIncludeXml)(params);
    if (debugEnabled) {
        logger?.debug?.('[UPDATE XML]');
        logger?.debug?.(xmlBody);
    }
    await connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
        headers: {
            Accept: contentTypes_1.ACCEPT_FUNCTION_INCLUDE,
            'Content-Type': contentTypes_1.CT_FUNCTION_INCLUDE,
        },
    });
}
