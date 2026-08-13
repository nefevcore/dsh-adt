"use strict";
/**
 * Behavior Definition activation operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const activationUtils_1 = require("../../utils/activationUtils");
const internalUtils_1 = require("../../utils/internalUtils");
/**
 * Activate behavior definition
 *
 * Makes behavior definition active and usable in SAP system
 *
 * Endpoint: POST /sap/bc/adt/activation?method=activate&preauditRequested=true
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param preauditRequested - Request preaudit (default: true)
 * @returns Axios response with activation result
 *
 * @example
 * ```typescript
 * await activate(connection, 'Z_MY_BDEF', sessionId);
 * ```
 */
async function activate(connection, name, preauditRequested = true) {
    const objectUri = `/sap/bc/adt/bo/behaviordefinitions/${(0, internalUtils_1.encodeSapObjectName)(name).toLowerCase()}`;
    return await (0, activationUtils_1.activateObjectInSession)(connection, objectUri, name.toUpperCase(), preauditRequested);
}
