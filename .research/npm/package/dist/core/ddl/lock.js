"use strict";
/**
 * View lock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockDDLS = lockDDLS;
exports.lockDDLSForUpdate = lockDDLSForUpdate;
const fast_xml_parser_1 = require("fast-xml-parser");
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Lock DDLS for modification
 */
async function lockDDLS(connection, ddlName) {
    const url = `/sap/bc/adt/ddic/ddl/sources/${(0, internalUtils_1.encodeSapObjectName)(ddlName).toLowerCase()}?_action=LOCK&accessMode=MODIFY`;
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
        throw new Error('Failed to obtain lock handle from SAP');
    }
    return lockHandle;
}
/**
 * Lock DDLS for editing (for update)
 */
async function lockDDLSForUpdate(connection, ddlName) {
    const url = `/sap/bc/adt/ddic/ddl/sources/${(0, internalUtils_1.encodeSapObjectName)(ddlName).toLowerCase()}?_action=LOCK&accessMode=MODIFY`;
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
        throw new Error('Failed to obtain lock handle from SAP. View may be locked by another user.');
    }
    return { response, lockHandle, corrNr };
}
