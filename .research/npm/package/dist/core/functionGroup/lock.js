"use strict";
/**
 * Lock Function Group operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockFunctionGroup = lockFunctionGroup;
exports.unlockFunctionGroup = unlockFunctionGroup;
const fast_xml_parser_1 = require("fast-xml-parser");
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Lock a function group for editing
 *
 * @param connection - ABAP connection
 * @param functionGroupName - Name of the function group (e.g., 'Z_FUGR_TEST_0001')
 * @param sessionId - Optional session ID for tracking
 * @returns Lock handle string
 */
async function lockFunctionGroup(connection, functionGroupName, _sessionId = '') {
    const url = `/sap/bc/adt/functions/groups/${functionGroupName.toLowerCase()}?_action=LOCK&accessMode=MODIFY`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_LOCK,
    };
    const response = await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers,
    });
    // Extract lock handle from response header
    const lockHandle = (0, internalUtils_1.headerValueToString)(response.headers['sap-adt-lm-handle']);
    if (!lockHandle) {
        // Try parsing from XML body if header not present
        const parser = new fast_xml_parser_1.XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
        });
        const result = parser.parse(response.data);
        const xmlLockHandle = result?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
        if (!xmlLockHandle) {
            throw new Error('Failed to acquire lock: no lock handle in response');
        }
        return xmlLockHandle;
    }
    return lockHandle;
}
/**
 * Unlock a function group
 *
 * @param connection - ABAP connection
 * @param functionGroupName - Name of the function group
 * @param lockHandle - Lock handle from lockFunctionGroup
 * @param sessionId - Optional session ID for tracking
 * @returns IAdtResponse from unlock request
 */
async function unlockFunctionGroup(connection, functionGroupName, lockHandle, _sessionId = '') {
    const url = `/sap/bc/adt/functions/groups/${functionGroupName.toLowerCase()}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
    });
}
