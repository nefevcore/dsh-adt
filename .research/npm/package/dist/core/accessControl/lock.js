"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockAccessControl = lockAccessControl;
const fast_xml_parser_1 = require("fast-xml-parser");
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Lock access control for modification
 * Returns lock handle that must be used in subsequent requests
 */
async function lockAccessControl(connection, accessControlName) {
    const accessControlNameEncoded = (0, internalUtils_1.encodeSapObjectName)(accessControlName.toLowerCase());
    const url = `/sap/bc/adt/acm/dcl/sources/${accessControlNameEncoded}?_action=LOCK&accessMode=MODIFY`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_LOCK,
    };
    const response = await connection.makeAdtRequest({
        method: 'POST',
        url,
        headers,
        timeout: (0, timeouts_1.getTimeout)('default'),
    });
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
    });
    const result = parser.parse(response.data);
    const lockHandle = result['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
    if (!lockHandle) {
        throw new Error('Failed to extract lock handle from response');
    }
    return lockHandle;
}
