"use strict";
/**
 * TableType unlock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockTableType = unlockTableType;
exports.deleteTableTypeLock = deleteTableTypeLock;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Unlock the table type after DDL content is added
 * Must use same session and lock handle from lock operation
 */
async function unlockTableType(connection, tableTypeName, lockHandle) {
    const url = `/sap/bc/adt/ddic/tabletypes/${(0, internalUtils_1.encodeSapObjectName)(tableTypeName)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: null,
        headers: {},
    });
}
/**
 * Delete table type lock (cleanup)
 */
async function deleteTableTypeLock(connection, tableTypeName) {
    const url = `/sap/bc/adt/ddic/ddlock/locks?lockAction=DELETE&name=${(0, internalUtils_1.encodeSapObjectName)(tableTypeName)}`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: '',
        headers: {},
    });
}
