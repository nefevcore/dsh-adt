"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTransformationName = validateTransformationName;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Validate transformation name
 * Returns raw response from ADT - consumer decides how to interpret it
 */
async function validateTransformationName(connection, transformationName, packageName, description) {
    const url = '/sap/bc/adt/xslt/validation';
    const queryParams = new URLSearchParams({
        objname: transformationName,
    });
    if (packageName) {
        queryParams.append('packagename', packageName);
    }
    if (description) {
        queryParams.append('description', description);
    }
    return connection.makeAdtRequest({
        url: `${url}?${queryParams.toString()}`,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_VALIDATION,
        },
    });
}
