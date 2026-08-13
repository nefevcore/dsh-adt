"use strict";
/**
 * ServiceDefinition unlock operations
 * NOTE: Caller should call connection.setSessionType("stateless") after unlocking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockServiceDefinition = unlockServiceDefinition;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Unlock service definition
 * Must use same session and lock handle from lock operation
 */
async function unlockServiceDefinition(connection, serviceDefinitionName, lockHandle) {
    const serviceDefinitionNameEncoded = (0, internalUtils_1.encodeSapObjectName)(serviceDefinitionName.toLowerCase());
    const url = `/sap/bc/adt/ddic/srvd/sources/${serviceDefinitionNameEncoded}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
    });
}
