"use strict";
/**
 * Metadata Extension Validation
 *
 * Validates parameters before creating a metadata extension (DDLX)
 * Uses ADT validation endpoint: /sap/bc/adt/ddic/ddlx/sources/validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateMetadataExtension = validateMetadataExtension;
const axios_1 = require("axios");
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Validate metadata extension parameters
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/ddic/ddlx/sources/validation
 *
 * @param connection - ABAP connection instance
 * @param params - Validation parameters
 * @returns Raw IAdtResponse from ADT validation endpoint (returns error response if object already exists)
 *
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <exc:exception> with message about existing object or validation failure
 */
async function validateMetadataExtension(connection, params) {
    const url = `/sap/bc/adt/ddic/ddlx/sources/validation`;
    const queryParams = new URLSearchParams({
        objtype: 'ddlxex',
        objname: params.name,
        description: params.description || params.name,
        packagename: params.packageName,
    });
    try {
        return await connection.makeAdtRequest({
            url: `${url}?${queryParams.toString()}`,
            method: 'POST',
            timeout: (0, timeouts_1.getTimeout)('default'),
            headers: {
                Accept: contentTypes_1.ACCEPT_VALIDATION,
            },
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
