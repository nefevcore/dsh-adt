"use strict";
/**
 * All types operations for ABAP objects
 *
 * Retrieves all valid ADT object types from the repository.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllTypes = getAllTypes;
const timeouts_1 = require("../../utils/timeouts");
/**
 * Get all valid ADT object types
 *
 * Endpoint: GET /sap/bc/adt/repository/informationsystem/objecttypes
 *
 * @param connection - ABAP connection instance
 * @param maxItemCount - Maximum number of items to return (default: 999)
 * @param name - Name filter pattern (default: '*')
 * @param data - Data filter (default: 'usedByProvider')
 * @returns Axios response with XML containing all object types
 *
 * @example
 * ```typescript
 * const response = await getAllTypes(connection);
 * // Response contains XML with all ADT object types
 * ```
 */
async function getAllTypes(connection, maxItemCount = 999, name = '*', data = 'usedByProvider') {
    const params = new URLSearchParams({
        maxItemCount: String(maxItemCount),
        name: name,
        data: data,
    });
    const url = `/sap/bc/adt/repository/informationsystem/objecttypes?${params.toString()}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
        },
    });
}
