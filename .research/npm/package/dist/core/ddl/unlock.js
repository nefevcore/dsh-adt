"use strict";
/**
 * View unlock operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockDDLS = unlockDDLS;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Unlock DDLS
 */
async function unlockDDLS(connection, ddlName, lockHandle) {
    const url = `/sap/bc/adt/ddic/ddl/sources/${(0, internalUtils_1.encodeSapObjectName)(ddlName).toLowerCase()}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: null,
    });
}
