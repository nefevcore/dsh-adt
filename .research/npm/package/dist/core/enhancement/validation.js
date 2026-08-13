"use strict";
/**
 * Enhancement validation operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnhancementName = validateEnhancementName;
exports.validate = validate;
const timeouts_1 = require("../../utils/timeouts");
const types_1 = require("./types");
/**
 * Validate enhancement name
 * Uses ADT validation endpoint: /sap/bc/adt/enhancements/{type}/validation
 *
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * @param connection - SAP connection
 * @param params - Validation parameters
 * @returns Axios response with validation result
 */
async function validateEnhancementName(connection, params) {
    const { enhancement_name, enhancement_type, package_name, description } = params;
    if (!enhancement_name) {
        throw new Error('enhancement_name is required');
    }
    if (!enhancement_type) {
        throw new Error('enhancement_type is required');
    }
    const typeCode = types_1.ENHANCEMENT_TYPE_CODES[enhancement_type];
    // Build query parameters for validation
    const queryParams = new URLSearchParams({
        objname: enhancement_name,
        objtype: typeCode,
    });
    if (package_name) {
        queryParams.append('packagename', package_name);
    }
    if (description) {
        queryParams.append('description', description);
    }
    const url = `${(0, types_1.getEnhancementBaseUrl)(enhancement_type)}/validation?${queryParams.toString()}`;
    const headers = {
        Accept: 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.validation.objectname',
    };
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers,
    });
}
/**
 * Convenience function: Validate enhancement name with simpler signature
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type
 * @param enhancementName - Enhancement name
 * @param packageName - Optional package name
 * @param description - Optional description
 * @returns Axios response
 */
async function validate(connection, enhancementType, enhancementName, packageName, description) {
    return validateEnhancementName(connection, {
        enhancement_name: enhancementName,
        enhancement_type: enhancementType,
        package_name: packageName,
        description,
    });
}
