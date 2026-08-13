"use strict";
/**
 * TableType lock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.acquireTableTypeLockHandle = acquireTableTypeLockHandle;
const fast_xml_parser_1 = require("fast-xml-parser");
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Acquire lock handle for the table type by locking it for modification
 */
async function acquireTableTypeLockHandle(connection, tableTypeName) {
    const url = `/sap/bc/adt/ddic/tabletypes/${(0, internalUtils_1.encodeSapObjectName)(tableTypeName)}?_action=LOCK&accessMode=MODIFY`;
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
