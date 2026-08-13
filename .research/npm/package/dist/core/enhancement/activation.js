"use strict";
/**
 * Enhancement activation operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateEnhancement = activateEnhancement;
const activationUtils_1 = require("../../utils/activationUtils");
const internalUtils_1 = require("../../utils/internalUtils");
const types_1 = require("./types");
/**
 * Activate enhancement
 * Makes enhancement active and usable in SAP system
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type (enhoxh, enhoxhb, enhoxhh, enhsxs, enhsxsb)
 * @param enhancementName - Enhancement name
 * @returns Axios response with activation result
 */
async function activateEnhancement(connection, enhancementType, enhancementName) {
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(enhancementName).toLowerCase();
    const objectUri = (0, types_1.getEnhancementUri)(enhancementType, encodedName);
    return await (0, activationUtils_1.activateObjectInSession)(connection, objectUri, enhancementName.toUpperCase(), true);
}
