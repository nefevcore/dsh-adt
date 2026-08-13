"use strict";
/**
 * AuthorizationField (SUSO / AUTH) name validation
 * Endpoint: POST /sap/bc/adt/aps/iam/auth/validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAuthorizationFieldName = validateAuthorizationFieldName;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Validate authorization field name against SAP naming rules.
 * Returns raw response — consumer interprets SEVERITY/SHORT_TEXT fields.
 */
async function validateAuthorizationFieldName(connection, name, packageName, description) {
    if (!name) {
        throw new Error('Authorization field name is required');
    }
    const url = '/sap/bc/adt/aps/iam/auth/validation';
    const queryParams = new URLSearchParams({
        objname: name,
    });
    if (packageName) {
        queryParams.append('packagename', packageName);
    }
    queryParams.append('description', description || '');
    return connection.makeAdtRequest({
        url: `${url}?${queryParams.toString()}`,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_VALIDATION,
        },
    });
}
