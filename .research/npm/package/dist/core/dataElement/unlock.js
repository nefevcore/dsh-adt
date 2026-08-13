"use strict";
/**
 * DataElement unlock operations
 * NOTE: Caller should call connection.setSessionType("stateless") after unlocking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockDataElement = unlockDataElement;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Unlock data element
 * Must use same session and lock handle from lock operation
 */
async function unlockDataElement(connection, dataElementName, lockHandle) {
    const dataElementNameEncoded = (0, internalUtils_1.encodeSapObjectName)(dataElementName.toLowerCase());
    const url = `/sap/bc/adt/ddic/dataelements/${dataElementNameEncoded}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
    });
}
