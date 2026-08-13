"use strict";
/**
 * AuthorizationField (SUSO / AUTH) read operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.readAuthorizationField = readAuthorizationField;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Read an authorization field (metadata-only, no source).
 */
async function readAuthorizationField(connection, name, version = 'active', options) {
    if (!name) {
        throw new Error('Authorization field name is required');
    }
    const encoded = (0, internalUtils_1.encodeSapObjectName)(name.toUpperCase());
    const params = new URLSearchParams();
    params.append('version', version);
    if (options?.withLongPolling) {
        params.append('withLongPolling', 'true');
    }
    const url = `/sap/bc/adt/aps/iam/auth/${encoded}?${params.toString()}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_AUTHORIZATION_FIELD,
        },
    });
}
