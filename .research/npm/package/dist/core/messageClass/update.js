"use strict";
/**
 * Message class update operations
 *
 * Uses read-modify-write pattern: GET current XML → apply description override
 * → rebuild full XML (messages preserved) → PUT with lock handle.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMessageClass = updateMessageClass;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const read_1 = require("./read");
const xml_1 = require("./xml");
const BASE = '/sap/bc/adt/messageclass';
/**
 * Update a message class description.
 * Reads the current XML first to preserve all existing messages and attributes,
 * then rebuilds the full XML with the description override and PUTs it back.
 *
 * NOTE: Caller must enable stateful session and hold a valid lockHandle.
 */
async function updateMessageClass(connection, name, lockHandle, description, transportRequest) {
    // 1. Read current state to preserve existing messages and all SAP-managed attrs
    const currentResponse = await (0, read_1.getMessageClassSource)(connection, name);
    const current = (0, xml_1.parseMessageClass)(String(currentResponse.data));
    // 2. Apply only the description override; everything else is preserved
    const updated = {
        ...current,
        ...(description !== undefined ? { description } : {}),
    };
    // 3. Rebuild full XML (round-trip preserving rawAttrs)
    const xmlBody = (0, xml_1.buildMessageClassXml)(updated);
    // 4. PUT with lock handle
    const encoded = (0, internalUtils_1.encodeSapObjectName)(name.toLowerCase());
    const corrNrParam = transportRequest?.trim()
        ? `&corrNr=${encodeURIComponent(transportRequest)}`
        : '';
    const url = `${BASE}/${encoded}?lockHandle=${encodeURIComponent(lockHandle)}${corrNrParam}`;
    return connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
        headers: { 'Content-Type': contentTypes_1.MESSAGE_CLASS_UPDATE_CONTENT_TYPE },
    });
}
