"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockTransformation = unlockTransformation;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Unlock transformation
 * Must use same session and lock handle from lock operation
 */
async function unlockTransformation(connection, transformationName, lockHandle) {
    const transformationNameEncoded = (0, internalUtils_1.encodeSapObjectName)(transformationName.toLowerCase());
    const url = `/sap/bc/adt/xslt/transformations/${transformationNameEncoded}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
    });
}
