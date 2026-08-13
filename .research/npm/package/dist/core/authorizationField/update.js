"use strict";
/**
 * AuthorizationField (SUSO / AUTH) update operations
 *
 * Requires a valid lockHandle (acquired via lockAuthorizationField).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAuthorizationField = updateAuthorizationField;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const xmlBuilder_1 = require("./xmlBuilder");
const debugEnabled = process.env.DEBUG_ADT_LIBS === 'true';
/**
 * Update authorization field via PUT.
 * The payload has the same shape as create; only unspecified optional fields
 * are omitted (server preserves their prior values).
 */
async function updateAuthorizationField(connection, params, lockHandle, logger) {
    if (!params.authorization_field_name) {
        throw new Error('authorization_field_name is required');
    }
    if (!lockHandle) {
        throw new Error('lockHandle is required for update');
    }
    const encoded = (0, internalUtils_1.encodeSapObjectName)(params.authorization_field_name.toUpperCase());
    const corrNr = params.transport_request
        ? `&corrNr=${encodeURIComponent(params.transport_request)}`
        : '';
    const url = `/sap/bc/adt/aps/iam/auth/${encoded}?lockHandle=${encodeURIComponent(lockHandle)}${corrNr}`;
    const xmlBody = (0, xmlBuilder_1.buildAuthorizationFieldXml)(params);
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
            Accept: contentTypes_1.ACCEPT_AUTHORIZATION_FIELD,
            'Content-Type': contentTypes_1.CT_AUTHORIZATION_FIELD,
        },
    });
}
