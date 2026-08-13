"use strict";
/**
 * Object structure operations for ABAP objects
 *
 * Retrieves ADT object structure as compact JSON tree.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getObjectStructure = getObjectStructure;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Get object structure from ADT repository
 *
 * Endpoint: GET /sap/bc/adt/repository/objectstructure?objecttype={type}&objectname={name}
 *
 * @param connection - ABAP connection instance
 * @param objectType - Object type (e.g., 'CLAS/OC', 'PROG/P', 'DEVC/K')
 * @param objectName - Object name
 * @returns Axios response with XML containing object structure tree
 *
 * @example
 * ```typescript
 * const response = await getObjectStructure(connection, 'CLAS/OC', 'ZMY_CLASS');
 * // Response contains XML with object structure
 * ```
 */
async function getObjectStructure(connection, objectType, objectName) {
    if (!objectType) {
        throw new Error('Object type is required');
    }
    if (!objectName) {
        throw new Error('Object name is required');
    }
    const encodedType = encodeURIComponent(objectType);
    const encodedName = encodeURIComponent((0, internalUtils_1.encodeSapObjectName)(objectName));
    const url = `/sap/bc/adt/repository/objectstructure?objecttype=${encodedType}&objectname=${encodedName}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/vnd.sap.adt.projectexplorer.objectstructure+xml, application/xml',
        },
    });
}
