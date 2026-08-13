"use strict";
/**
 * SystemMessages - Low-level read functions
 *
 * Provides access to system messages (SM02):
 * - List system messages with optional filtering
 * - Get individual system message by ID
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSystemMessages = listSystemMessages;
exports.getSystemMessage = getSystemMessage;
const timeouts_1 = require("../../utils/timeouts");
const read_1 = require("../feeds/read");
/**
 * List system messages
 *
 * @param connection - ABAP connection
 * @param options - Query options
 * @returns Axios response with system messages feed
 */
async function listSystemMessages(connection, options) {
    const url = `/sap/bc/adt/runtime/systemmessages${(0, read_1.buildFeedQueryParams)(options)}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/atom+xml;type=feed',
        },
    });
}
/**
 * Get a single system message by ID
 *
 * @param connection - ABAP connection
 * @param messageId - System message ID
 * @returns Axios response with system message details
 */
async function getSystemMessage(connection, messageId) {
    const url = `/sap/bc/adt/runtime/systemmessages/${messageId}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
        },
    });
}
