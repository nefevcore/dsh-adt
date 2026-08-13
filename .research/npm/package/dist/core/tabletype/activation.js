"use strict";
/**
 * TableType activation operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateTableType = activateTableType;
const activationUtils_1 = require("../../utils/activationUtils");
const internalUtils_1 = require("../../utils/internalUtils");
/**
 * Activate the table type after creation
 */
async function activateTableType(connection, tableTypeName) {
    const objectUri = `/sap/bc/adt/ddic/tabletypes/${(0, internalUtils_1.encodeSapObjectName)(tableTypeName)}`;
    return await (0, activationUtils_1.activateObjectInSession)(connection, objectUri, tableTypeName, true);
}
