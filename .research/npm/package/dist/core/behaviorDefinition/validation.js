"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Validate behavior definition parameters before creation
 *
 * Endpoint: POST /sap/bc/adt/bo/behaviordefinitions/validation
 *
 * @param connection - ABAP connection instance
 * @param params - Validation parameters
 * @param sessionId - Session ID for request tracking
 * @returns Axios response with validation result
 *
 * @example
 * ```typescript
 * const result = await validate(connection, {
 *   objname: 'Z_MY_BDEF',
 *   rootEntity: 'Z_MY_ENTITY',
 *   description: 'Test Behavior Definition',
 *   package: 'Z_PACKAGE',
 *   implementationType: 'Managed'
 * }, sessionId);
 *
 * // Check validation result
 * const severity = result.data.match(/<SEVERITY>([^<]+)<\/SEVERITY>/)?.[1];
 * if (severity === 'OK') {
 * }
 * ```
 */
async function validate(connection, params) {
    try {
        const queryParams = new URLSearchParams({
            objname: params.objname,
            rootEntity: params.rootEntity,
            description: params.description,
            package: params.package,
            implementationType: params.implementationType,
        });
        const url = `/sap/bc/adt/bo/behaviordefinitions/validation?${queryParams.toString()}`;
        const response = await connection.makeAdtRequest({
            url,
            method: 'POST',
            timeout: (0, timeouts_1.getTimeout)('default'),
            headers: {
                Accept: contentTypes_1.ACCEPT_VALIDATION,
            },
        });
        return response;
    }
    catch (error) {
        const e = error;
        throw new Error(`Failed to validate behavior definition ${params.objname}: ${e.message}`);
    }
}
