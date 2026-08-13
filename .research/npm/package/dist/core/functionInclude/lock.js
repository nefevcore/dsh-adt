"use strict";
/**
 * FunctionInclude (FUGR/I) lock operation
 * NOTE: Caller should call connection.setSessionType("stateful") before locking.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockFunctionInclude = lockFunctionInclude;
const fast_xml_parser_1 = require("fast-xml-parser");
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Lock function include for modification.
 * Returns LOCK_HANDLE that must be passed to update/unlock.
 */
async function lockFunctionInclude(connection, groupName, includeName, logger) {
    if (!groupName) {
        throw new Error('Function group name is required');
    }
    if (!includeName) {
        throw new Error('Include name is required');
    }
    const groupLower = (0, internalUtils_1.encodeSapObjectName)(groupName).toLowerCase();
    const encodedInclude = (0, internalUtils_1.encodeSapObjectName)(includeName.toUpperCase());
    const url = `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}?_action=LOCK&accessMode=MODIFY`;
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
