"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockScalarFunction = unlockScalarFunction;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
async function unlockScalarFunction(connection, name, lockHandle) {
    const encoded = (0, internalUtils_1.encodeSapObjectName)(name.toLowerCase());
    const url = `/sap/bc/adt/ddic/dsfd/sources/${encoded}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
    });
}
