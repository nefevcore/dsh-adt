"use strict";
/**
 * Behavior Implementation validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBehaviorImplementationName = validateBehaviorImplementationName;
const axios_1 = require("axios");
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Validate behavior implementation class name
 * Uses ADT validation endpoint: /sap/bc/adt/oo/validation/objectname
 *
 * @param connection - SAP connection
 * @param className - Behavior implementation class name (e.g., ZBP_OK_I_CDS_TEST)
 * @param packageName - Package name
 * @param description - Description
 * @param behaviorDefinition - Behavior definition name (root entity)
 * @returns Validation response (returns error response if object already exists)
 */
async function validateBehaviorImplementationName(connection, className, packageName, description, behaviorDefinition) {
    // Build query parameters for behavior implementation validation
    const params = new URLSearchParams({
        objname: className,
        objtype: 'CLAS/OC',
    });
    if (packageName) {
        params.append('packagename', packageName);
    }
    if (description) {
        // Description is limited to 60 characters in SAP ADT
        params.append('description', (0, internalUtils_1.limitDescription)(description));
    }
    if (behaviorDefinition) {
        params.append('behaviorDefinition', behaviorDefinition);
    }
    const url = `/sap/bc/adt/oo/validation/objectname?${params.toString()}`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_VALIDATION_CLASS_NAME,
    };
    try {
        return await connection.makeAdtRequest({
            url,
            method: 'POST',
            timeout: (0, timeouts_1.getTimeout)('default'),
            headers,
        });
    }
    catch (error) {
        // If validation returns 400 and object already exists, return error response instead of throwing
        if (error instanceof axios_1.AxiosError && error.response?.status === 400) {
            return error.response;
        }
        throw error;
    }
}
