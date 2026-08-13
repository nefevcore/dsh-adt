"use strict";
/**
 * Table lock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.acquireTableLockHandle = acquireTableLockHandle;
const fast_xml_parser_1 = require("fast-xml-parser");
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Acquire lock handle for the table by locking it for modification
 */
async function acquireTableLockHandle(connection, tableName) {
    const url = `/sap/bc/adt/ddic/tables/${(0, internalUtils_1.encodeSapObjectName)(tableName)}?_action=LOCK&accessMode=MODIFY`;
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
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
    });
    const result = parser.parse(response.data);
    const lockHandle = result?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
    if (!lockHandle) {
        throw new Error('Failed to obtain lock handle from SAP response');
    }
    return lockHandle;
}
