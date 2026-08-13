"use strict";
/**
 * Domain activation operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateDomain = activateDomain;
const activationUtils_1 = require("../../utils/activationUtils");
const internalUtils_1 = require("../../utils/internalUtils");
/**
 * Activate domain
 * Makes domain active and usable in SAP system
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
async function activateDomain(connection, domainName) {
    const objectUri = `/sap/bc/adt/ddic/domains/${(0, internalUtils_1.encodeSapObjectName)(domainName.toLowerCase())}`;
    return await (0, activationUtils_1.activateObjectInSession)(connection, objectUri, domainName.toUpperCase(), true);
}
