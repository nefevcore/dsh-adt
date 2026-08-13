"use strict";
/**
 * Package lock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockPackage = lockPackage;
const fast_xml_parser_1 = require("fast-xml-parser");
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
async function lockPackage(connection, packageName) {
    const url = `/sap/bc/adt/packages/${(0, internalUtils_1.encodeSapObjectName)(packageName.toLowerCase())}?_action=LOCK&accessMode=MODIFY`;
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
    const data = result?.['asx:abap']?.['asx:values']?.DATA;
    const lockHandle = data?.LOCK_HANDLE;
    if (!lockHandle) {
        throw new Error('Failed to obtain lock handle from SAP. Package may be locked by another user.');
    }
    const corrNr = data?.CORR_NUMBER || undefined;
    return { lockHandle, corrNr };
}
