"use strict";
/**
 * Table activation operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateTable = activateTable;
const activationUtils_1 = require("../../utils/activationUtils");
const internalUtils_1 = require("../../utils/internalUtils");
/**
 * Activate the table after creation
 */
async function activateTable(connection, tableName) {
    const objectUri = `/sap/bc/adt/ddic/tables/${(0, internalUtils_1.encodeSapObjectName)(tableName)}`;
    return await (0, activationUtils_1.activateObjectInSession)(connection, objectUri, tableName, true);
}
