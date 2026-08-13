"use strict";
/**
 * Program activation operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateProgram = activateProgram;
const activationUtils_1 = require("../../utils/activationUtils");
const internalUtils_1 = require("../../utils/internalUtils");
/**
 * Activate program
 * Makes program active and usable in SAP system
 */
async function activateProgram(connection, programName) {
    const objectUri = `/sap/bc/adt/programs/programs/${(0, internalUtils_1.encodeSapObjectName)(programName).toLowerCase()}`;
    return await (0, activationUtils_1.activateObjectInSession)(connection, objectUri, programName, true);
}
