"use strict";
/**
 * Include operations for ABAP objects
 *
 * Retrieves source code of specific ABAP include files.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInclude = getInclude;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Get include source code
 *
 * Endpoint: GET /sap/bc/adt/programs/includes/{name}/source/main
 *
 * @param connection - ABAP connection instance
 * @param includeName - Include name
 * @returns Axios response with source code (plain text)
 *
 * @example
 * ```typescript
 * const response = await getInclude(connection, 'ZMY_INCLUDE');
 * const sourceCode = response.data; // Include source code
 * ```
 */
async function getInclude(connection, includeName) {
    if (!includeName) {
        throw new Error('Include name is required');
    }
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(includeName.toLowerCase());
    const url = `/sap/bc/adt/programs/includes/${encodedName}/source/main`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_SOURCE,
        },
    });
}
