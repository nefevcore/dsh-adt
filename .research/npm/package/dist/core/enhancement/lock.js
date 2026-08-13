"use strict";
/**
 * Enhancement lock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockEnhancement = lockEnhancement;
exports.lockEnhancementForUpdate = lockEnhancementForUpdate;
const fast_xml_parser_1 = require("fast-xml-parser");
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const types_1 = require("./types");
/**
 * Lock enhancement for modification
 * Returns lock handle that must be used in subsequent requests
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type (enhoxh, enhoxhb, enhoxhh, enhsxs, enhsxsb)
 * @param enhancementName - Enhancement name
 * @returns Lock handle string
 */
async function lockEnhancement(connection, enhancementType, enhancementName) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(enhancementName).toLowerCase();
    const url = `${(0, types_1.getEnhancementUri)(enhancementType, encodedName)}?_action=LOCK&accessMode=MODIFY`;
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
        throw new Error(`Failed to obtain lock handle for enhancement ${enhancementName}. Object may be locked by another user.`);
    }
    return lockHandle;
}
/**
 * Lock enhancement for editing (for update)
 * Returns lock handle and transport number
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type
 * @param enhancementName - Enhancement name
 * @returns Object containing response, lockHandle, and optional corrNr
 */
async function lockEnhancementForUpdate(connection, enhancementType, enhancementName) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(enhancementName).toLowerCase();
    const url = `${(0, types_1.getEnhancementUri)(enhancementType, encodedName)}?_action=LOCK&accessMode=MODIFY`;
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
        throw new Error(`Failed to obtain lock handle for enhancement ${enhancementName}. Object may be locked by another user.`);
    }
    return { response, lockHandle, corrNr };
}
