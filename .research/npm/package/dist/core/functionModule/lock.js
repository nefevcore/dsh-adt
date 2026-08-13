"use strict";
/**
 * FunctionModule lock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockFunctionModule = lockFunctionModule;
exports.lockFunctionModuleForUpdate = lockFunctionModuleForUpdate;
const fast_xml_parser_1 = require("fast-xml-parser");
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Lock function module for editing
 */
async function lockFunctionModule(connection, functionGroupName, functionModuleName) {
    const encodedGroupName = (0, internalUtils_1.encodeSapObjectName)(functionGroupName).toLowerCase();
    const encodedModuleName = (0, internalUtils_1.encodeSapObjectName)(functionModuleName).toLowerCase();
    const url = `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules/${encodedModuleName}?_action=LOCK&accessMode=MODIFY`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_LOCK,
    };
    const response = await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers,
    });
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
    });
    const lockData = parser.parse(response.data);
    const lockHandle = lockData['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
    if (!lockHandle) {
        throw new Error('Failed to acquire lock handle from response');
    }
    return lockHandle;
}
/**
 * Lock function module for editing (for update)
 */
async function lockFunctionModuleForUpdate(connection, functionGroupName, functionModuleName, _sessionId) {
    const encodedGroupName = (0, internalUtils_1.encodeSapObjectName)(functionGroupName).toLowerCase();
    const encodedModuleName = (0, internalUtils_1.encodeSapObjectName)(functionModuleName).toLowerCase();
    const url = `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules/${encodedModuleName}?_action=LOCK&accessMode=MODIFY`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_LOCK,
    };
    const response = await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
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
        throw new Error('Failed to obtain lock handle from SAP. Function module may be locked by another user.');
    }
    return { response, lockHandle, corrNr };
}
