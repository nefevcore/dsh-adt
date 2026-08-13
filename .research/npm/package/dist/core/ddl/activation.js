"use strict";
/**
 * View activation operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateDDLS = activateDDLS;
const activationUtils_1 = require("../../utils/activationUtils");
const internalUtils_1 = require("../../utils/internalUtils");
/**
 * Activate DDLS
 */
async function activateDDLS(connection, ddlName) {
    const objectUri = `/sap/bc/adt/ddic/ddl/sources/${(0, internalUtils_1.encodeSapObjectName)(ddlName).toLowerCase()}`;
    return await (0, activationUtils_1.activateObjectInSession)(connection, objectUri, ddlName, true);
}
