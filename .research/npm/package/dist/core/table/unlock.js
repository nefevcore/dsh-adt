"use strict";
/**
 * Table unlock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockTable = unlockTable;
exports.deleteTableLock = deleteTableLock;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Unlock the table after DDL content is added
 * Must use same session and lock handle from lock operation
 */
async function unlockTable(connection, tableName, lockHandle) {
    const url = `/sap/bc/adt/ddic/tables/${(0, internalUtils_1.encodeSapObjectName)(tableName)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: null,
        headers: {},
    });
}
/**
 * Delete table lock (cleanup)
 */
async function deleteTableLock(connection, tableName) {
    const url = `/sap/bc/adt/ddic/ddlock/locks?lockAction=DELETE&name=${(0, internalUtils_1.encodeSapObjectName)(tableName)}`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: '',
        headers: {},
    });
}
