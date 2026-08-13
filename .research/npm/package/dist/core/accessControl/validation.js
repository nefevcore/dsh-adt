"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAccessControlName = validateAccessControlName;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Validate access control name
 * Returns raw response from ADT - consumer decides how to interpret it
 */
async function validateAccessControlName(connection, accessControlName, packageName, description) {
    const url = '/sap/bc/adt/acm/dcl/validation';
    const queryParams = new URLSearchParams({
        objname: accessControlName,
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
