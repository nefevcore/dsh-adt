"use strict";
/**
 * AuthorizationField (SUSO / AUTH) lock operation
 * NOTE: Caller should call connection.setSessionType("stateful") before locking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockAuthorizationField = lockAuthorizationField;
const fast_xml_parser_1 = require("fast-xml-parser");
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Lock authorization field for modification.
 * Returns LOCK_HANDLE that must be passed to update/unlock.
 */
async function lockAuthorizationField(connection, name, logger) {
    if (!name) {
        throw new Error('Authorization field name is required');
    }
    const encoded = (0, internalUtils_1.encodeSapObjectName)(name.toUpperCase());
    const url = `/sap/bc/adt/aps/iam/auth/${encoded}?_action=LOCK&accessMode=MODIFY`;
    const response = await connection.makeAdtRequest({
        method: 'POST',
        url,
        headers: { Accept: contentTypes_1.ACCEPT_LOCK },
        timeout: (0, timeouts_1.getTimeout)('default'),
    });
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
    });
    const parsed = parser.parse(response.data);
    const lockHandle = parsed['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
    if (!lockHandle) {
        logger?.error?.('Failed to extract lock handle from response');
        throw new Error('Failed to extract lock handle from response');
    }
    return lockHandle;
}
