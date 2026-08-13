"use strict";
/**
 * Structure lock operations
 * NOTE: Caller should call connection.setSessionType("stateful") before locking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockStructure = lockStructure;
const fast_xml_parser_1 = require("fast-xml-parser");
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Lock structure for modification
 * Returns lock handle that must be used in subsequent requests
 */
async function lockStructure(connection, structureName) {
    const url = `/sap/bc/adt/ddic/structures/${(0, internalUtils_1.encodeSapObjectName)(structureName).toLowerCase()}?_action=LOCK&accessMode=MODIFY`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_LOCK,
    };
    const response = await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: null,
        headers,
    });
    // Parse lock handle from XML response
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
    });
    const result = parser.parse(response.data);
    const lockHandle = result?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
    if (!lockHandle) {
        throw new Error('Failed to obtain lock handle from SAP. Structure may be locked by another user.');
    }
    return lockHandle;
}
