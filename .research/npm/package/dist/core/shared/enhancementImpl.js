"use strict";
/**
 * Enhancement implementation operations
 *
 * Retrieves source code of specific enhancement implementations.
 * Uses different URL format: /sap/bc/adt/enhancements/{spot}/{name}/source/main
 * where spot is the enhancement spot name (not type).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnhancementImpl = getEnhancementImpl;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Get enhancement implementation source code
 *
 * Endpoint: GET /sap/bc/adt/enhancements/{spot}/{name}/source/main
 *
 * Note: This uses spot name in URL instead of enhancement type.
 * Different from standard enhancement operations which use type in URL.
 *
 * @param connection - ABAP connection instance
 * @param enhancementSpot - Enhancement spot name (e.g., 'enhoxhh')
 * @param enhancementName - Enhancement implementation name
 * @returns Axios response with XML containing enhancement source code
 *
 * @example
 * ```typescript
 * const response = await getEnhancementImpl(connection, 'enhoxhh', 'zpartner_update_pai');
 * // Response contains XML with enhancement source code
 * ```
 */
async function getEnhancementImpl(connection, enhancementSpot, enhancementName) {
    if (!enhancementSpot) {
        throw new Error('Enhancement spot is required');
    }
    if (!enhancementName) {
        throw new Error('Enhancement name is required');
    }
    const encodedSpot = (0, internalUtils_1.encodeSapObjectName)(enhancementSpot.toLowerCase());
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(enhancementName.toLowerCase());
    const url = `/sap/bc/adt/enhancements/${encodedSpot}/${encodedName}/source/main`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml, text/plain',
        },
    });
}
