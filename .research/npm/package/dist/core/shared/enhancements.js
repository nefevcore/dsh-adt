"use strict";
/**
 * Enhancement operations for ABAP objects
 *
 * Retrieves enhancement implementations for programs, includes, and classes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnhancements = getEnhancements;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Get enhancement implementations for ABAP object
 *
 * Supports three object types:
 * - Classes: `/sap/bc/adt/oo/classes/{name}/source/main/enhancements/elements`
 * - Programs: `/sap/bc/adt/programs/programs/{name}/source/main/enhancements/elements`
 * - Includes: `/sap/bc/adt/programs/includes/{name}/source/main/enhancements/elements?context={program}`
 *
 * @param connection - ABAP connection instance
 * @param objectName - Object name (program, include, or class)
 * @param objectType - Object type: 'program' | 'include' | 'class'
 * @param context - Optional program context for includes (required when objectType is 'include')
 * @returns Axios response with XML containing enhancement implementations
 *
 * @example
 * ```typescript
 * // For a program
 * const response = await getEnhancements(connection, 'ZMY_PROGRAM', 'program');
 *
 * // For an include
 * const response = await getEnhancements(connection, 'ZMY_INCLUDE', 'include', 'ZMY_PROGRAM');
 *
 * // For a class
 * const response = await getEnhancements(connection, 'ZMY_CLASS', 'class');
 * ```
 */
async function getEnhancements(connection, objectName, objectType, context) {
    if (!objectName) {
        throw new Error('Object name is required');
    }
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(objectName.toLowerCase());
    let url;
    switch (objectType) {
        case 'class':
            url = `/sap/bc/adt/oo/classes/${encodedName}/source/main/enhancements/elements`;
            break;
        case 'program':
            url = `/sap/bc/adt/programs/programs/${encodedName}/source/main/enhancements/elements`;
            break;
        case 'include': {
            if (!context) {
                throw new Error('Program context is required for includes');
            }
            const encodedContext = encodeURIComponent(context);
            url = `/sap/bc/adt/programs/includes/${encodedName}/source/main/enhancements/elements?context=${encodedContext}`;
            break;
        }
        default:
            throw new Error(`Unsupported object type: ${objectType}`);
    }
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
        },
    });
}
