"use strict";
/**
 * Class activation operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateClass = activateClass;
const activationUtils_1 = require("../../utils/activationUtils");
const internalUtils_1 = require("../../utils/internalUtils");
/**
 * Activate class
 * Makes class active and usable in SAP system
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
async function activateClass(connection, className) {
    const objectUri = `/sap/bc/adt/oo/classes/${(0, internalUtils_1.encodeSapObjectName)(className).toLowerCase()}`;
    return await (0, activationUtils_1.activateObjectInSession)(connection, objectUri, className, true);
}
