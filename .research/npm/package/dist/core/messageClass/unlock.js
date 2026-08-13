"use strict";
/**
 * Message class unlock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockMessageClass = unlockMessageClass;
exports.unlockAllMessages = unlockAllMessages;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const BASE = '/sap/bc/adt/messageclass';
/**
 * Unlock a message class after modification.
 *
 * NOTE: Caller should call connection.setSessionType('stateless') after this.
 */
async function unlockMessageClass(connection, name, lockHandle) {
    const encoded = (0, internalUtils_1.encodeSapObjectName)(name.toLowerCase());
    const url = `${BASE}/${encoded}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: null,
    });
}
/**
 * Release all message-level locks for a specific message number.
 * Must be called after the class PUT to release the LOCK_MSG handle.
 */
async function unlockAllMessages(connection, name, no) {
    const encoded = (0, internalUtils_1.encodeSapObjectName)(name.toLowerCase());
    const url = `${BASE}/${encoded}/messages/${encodeURIComponent(no)}?_action=UNLOCK_ALL`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: `[${no}]`,
    });
}
