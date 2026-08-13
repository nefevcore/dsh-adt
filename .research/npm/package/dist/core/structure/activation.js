"use strict";
/**
 * Structure activation operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateStructure = activateStructure;
const activationUtils_1 = require("../../utils/activationUtils");
const internalUtils_1 = require("../../utils/internalUtils");
/**
 * Activate the structure after creation
 */
async function activateStructure(connection, structureName) {
    const objectUri = `/sap/bc/adt/ddic/structures/${(0, internalUtils_1.encodeSapObjectName)(structureName)}`;
    return await (0, activationUtils_1.activateObjectInSession)(connection, objectUri, structureName, true);
}
