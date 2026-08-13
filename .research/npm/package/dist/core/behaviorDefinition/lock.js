"use strict";
/**
 * Behavior Definition lock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.lock = lock;
exports.lockForUpdate = lockForUpdate;
const fast_xml_parser_1 = require("fast-xml-parser");
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Lock behavior definition for modification
 *
 * Endpoint: POST /sap/bc/adt/bo/behaviordefinitions/{name}?_action=LOCK&accessMode=MODIFY
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param accessMode - Access mode (default: MODIFY)
 * @returns Lock handle that must be used in subsequent update/unlock requests
 *
 * @example
 * ```typescript
 * const lockHandle = await lock(connection, 'Z_MY_BDEF', sessionId);
 * // Use lockHandle for update operations
 * ```
 */
async function lock(connection, name, accessMode = 'MODIFY') {
    const url = `/sap/bc/adt/bo/behaviordefinitions/${(0, internalUtils_1.encodeSapObjectName)(name).toLowerCase()}?_action=LOCK&accessMode=${accessMode}`;
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
    <DATA>
      <LOCK_HANDLE/>
      <CORRNR/>
      <CORRUSER/>
      <CORRTEXT/>
      <IS_LOCAL>X</IS_LOCAL>
      <IS_LINK_UP/>
      <MODIFICATION_SUPPORT/>
      <SCOPE_MESSAGES/>
    </DATA>
  </asx:values>
</asx:abap>`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_LOCK,
        'Content-Type': 'application/xml',
    };
    const response = await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
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
        throw new Error(`Failed to obtain lock handle for behavior definition ${name}. Object may be locked by another user.`);
    }
    return lockHandle;
}
/**
 * Lock behavior definition for editing (returns full response)
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param accessMode - Access mode (default: MODIFY)
 * @returns Object containing response, lockHandle, and optional transport number
 *
 * @example
 * ```typescript
 * const { response, lockHandle, corrNr } = await lockForUpdate(connection, 'Z_MY_BDEF', sessionId);
 * ```
 */
async function lockForUpdate(connection, name, _sessionId, accessMode = 'MODIFY') {
    const url = `/sap/bc/adt/bo/behaviordefinitions/${(0, internalUtils_1.encodeSapObjectName)(name).toLowerCase()}?_action=LOCK&accessMode=${accessMode}`;
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
    <DATA>
      <LOCK_HANDLE/>
      <CORRNR/>
      <CORRUSER/>
      <CORRTEXT/>
      <IS_LOCAL>X</IS_LOCAL>
      <IS_LINK_UP/>
      <MODIFICATION_SUPPORT/>
      <SCOPE_MESSAGES/>
    </DATA>
  </asx:values>
</asx:abap>`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_LOCK,
        'Content-Type': 'application/xml',
    };
    const response = await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
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
        throw new Error(`Failed to obtain lock handle for behavior definition ${name}. Object may be locked by another user.`);
    }
    return { response, lockHandle, corrNr };
}
