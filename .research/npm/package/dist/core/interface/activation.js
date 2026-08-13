"use strict";
/**
 * Interface activation operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateInterface = activateInterface;
const activationUtils_1 = require("../../utils/activationUtils");
const internalUtils_1 = require("../../utils/internalUtils");
/**
 * Activate interface
 * Makes interface active and usable in SAP system
 */
async function activateInterface(connection, interfaceName) {
    const objectUri = `/sap/bc/adt/oo/interfaces/${(0, internalUtils_1.encodeSapObjectName)(interfaceName).toLowerCase()}`;
    return await (0, activationUtils_1.activateObjectInSession)(connection, objectUri, interfaceName, true);
}
