"use strict";
/**
 * Message class read operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessageClassSource = getMessageClassSource;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const BASE = '/sap/bc/adt/messageclass';
/** Accept header covering both the dedicated MC content type and plain XML fallback. */
const ACCEPT_MESSAGE_CLASS = 'application/vnd.sap.adt.mc.messageclass+xml, application/xml';
/**
 * Read message class metadata and messages.
 * GET /sap/bc/adt/messageclass/{name}
 */
async function getMessageClassSource(connection, name, options) {
    const encoded = (0, internalUtils_1.encodeSapObjectName)(name.toLowerCase());
    // No ADT operation that changes system state guarantees when the change
    // becomes visible, so a read straight after a create can legitimately find
    // nothing. `withLongPolling=true` is how ADT is asked to wait for the object
    // instead of answering from whatever is there right now.
    const query = options?.withLongPolling ? '?withLongPolling=true' : '';
    return connection.makeAdtRequest({
        url: `${BASE}/${encoded}${query}`,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: { Accept: ACCEPT_MESSAGE_CLASS },
    });
}
