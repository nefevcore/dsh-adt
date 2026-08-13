"use strict";
/**
 * FunctionInclude (FUGR/I) activation operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateFunctionInclude = activateFunctionInclude;
const activationUtils_1 = require("../../utils/activationUtils");
const internalUtils_1 = require("../../utils/internalUtils");
/**
 * Activate function include.
 */
async function activateFunctionInclude(connection, groupName, includeName) {
    const groupLower = (0, internalUtils_1.encodeSapObjectName)(groupName).toLowerCase();
    const encodedInclude = (0, internalUtils_1.encodeSapObjectName)(includeName.toUpperCase());
    const objectUri = `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}`;
    return await (0, activationUtils_1.activateObjectInSession)(connection, objectUri, includeName.toUpperCase(), true);
}
