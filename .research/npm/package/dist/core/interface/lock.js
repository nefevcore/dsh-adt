"use strict";
/**
 * Interface lock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockInterface = lockInterface;
exports.lockInterfaceForUpdate = lockInterfaceForUpdate;
const fast_xml_parser_1 = require("fast-xml-parser");
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Lock interface for modification
 * Returns lock handle and transport number
 */
async function lockInterface(connection, interfaceName) {
    const url = `/sap/bc/adt/oo/interfaces/${(0, internalUtils_1.encodeSapObjectName)(interfaceName).toLowerCase()}?_action=LOCK&accessMode=MODIFY`;
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
    const lockData = parser.parse(response.data);
    const lockHandle = lockData['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
    const corrNr = lockData['asx:abap']?.['asx:values']?.DATA?.CORRNR;
    if (!lockHandle) {
        throw new Error('Failed to acquire lock handle from response');
    }
    return { lockHandle, corrNr };
}
/**
 * Lock interface for editing (for update)
 * Returns lock handle and transport number
 */
async function lockInterfaceForUpdate(connection, interfaceName, _sessionId) {
    const url = `/sap/bc/adt/oo/interfaces/${(0, internalUtils_1.encodeSapObjectName)(interfaceName).toLowerCase()}?_action=LOCK&accessMode=MODIFY`;
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
        attributeNamePrefix: '@_',
    });
    const result = parser.parse(response.data);
    const lockHandle = result?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
    const corrNr = result?.['asx:abap']?.['asx:values']?.DATA?.CORRNR;
    if (!lockHandle) {
        throw new Error('Failed to obtain lock handle from SAP. Interface may be locked by another user.');
    }
    return { response, lockHandle, corrNr };
}
