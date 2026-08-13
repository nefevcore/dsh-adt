"use strict";
/**
 * Program lock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockProgram = lockProgram;
exports.lockProgramForUpdate = lockProgramForUpdate;
const fast_xml_parser_1 = require("fast-xml-parser");
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Lock program for modification
 * Returns lock handle that must be used in subsequent requests
 */
async function lockProgram(connection, programName) {
    const url = `/sap/bc/adt/programs/programs/${(0, internalUtils_1.encodeSapObjectName)(programName).toLowerCase()}?_action=LOCK&accessMode=MODIFY`;
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
        throw new Error('Failed to obtain lock handle from SAP. Program may be locked by another user.');
    }
    return lockHandle;
}
/**
 * Lock program for editing (for update)
 * Returns lock handle and transport number
 */
async function lockProgramForUpdate(connection, programName, _sessionId) {
    const url = `/sap/bc/adt/programs/programs/${(0, internalUtils_1.encodeSapObjectName)(programName).toLowerCase()}?_action=LOCK&accessMode=MODIFY`;
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
    // Parse lock handle and transport number from XML response
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
    });
    const result = parser.parse(response.data);
    const lockHandle = result?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
    const corrNr = result?.['asx:abap']?.['asx:values']?.DATA?.CORRNR;
    if (!lockHandle) {
        throw new Error('Failed to obtain lock handle from SAP. Program may be locked by another user.');
    }
    return { response, lockHandle, corrNr };
}
