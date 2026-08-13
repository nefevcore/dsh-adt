"use strict";
/**
 * FunctionInclude (FUGR/I) source upload operations.
 *
 * Requires a valid lockHandle (acquired via lockFunctionInclude).
 * Does NOT lock/unlock — assumes the object is already locked.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFunctionIncludeSource = uploadFunctionIncludeSource;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Upload function include source code (low-level; uses an existing lockHandle).
 *
 * @param unicode when true, Content-Type is "text/plain; charset=utf-8";
 *                when false, plain "text/plain" (for legacy non-unicode systems).
 */
async function uploadFunctionIncludeSource(connection, groupName, includeName, sourceCode, lockHandle, unicode, transportRequest) {
    if (!groupName) {
        throw new Error('Function group name is required');
    }
    if (!includeName) {
        throw new Error('Include name is required');
    }
    if (!lockHandle) {
        throw new Error('lockHandle is required');
    }
    const groupLower = (0, internalUtils_1.encodeSapObjectName)(groupName).toLowerCase();
    const encodedInclude = (0, internalUtils_1.encodeSapObjectName)(includeName.toUpperCase());
    let url = `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}/source/main?lockHandle=${encodeURIComponent(lockHandle)}`;
    if (transportRequest) {
        url += `&corrNr=${encodeURIComponent(transportRequest)}`;
    }
    const contentType = unicode ? contentTypes_1.ACCEPT_SOURCE_UTF8 : contentTypes_1.ACCEPT_SOURCE;
    await connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: sourceCode,
        headers: {
            'Content-Type': contentType,
            Accept: contentTypes_1.ACCEPT_SOURCE,
            'X-sap-adt-sessiontype': 'stateful',
        },
    });
}
