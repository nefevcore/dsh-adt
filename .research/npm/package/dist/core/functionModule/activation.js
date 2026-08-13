"use strict";
/**
 * FunctionModule activation operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateFunctionModule = activateFunctionModule;
const activationUtils_1 = require("../../utils/activationUtils");
const internalUtils_1 = require("../../utils/internalUtils");
/**
 * Activate function module
 */
async function activateFunctionModule(connection, functionGroupName, functionModuleName) {
    const encodedGroupName = (0, internalUtils_1.encodeSapObjectName)(functionGroupName).toLowerCase();
    const encodedModuleName = (0, internalUtils_1.encodeSapObjectName)(functionModuleName).toLowerCase();
    const objectUri = `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules/${encodedModuleName}`;
    return await (0, activationUtils_1.activateObjectInSession)(connection, objectUri, functionModuleName, true);
}
