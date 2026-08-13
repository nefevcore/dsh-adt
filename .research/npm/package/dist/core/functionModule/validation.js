"use strict";
/**
 * Function Module validation
 * Uses ADT validation endpoint: /sap/bc/adt/functions/validation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFunctionModuleName = validateFunctionModuleName;
exports.validateFunctionModuleSource = validateFunctionModuleSource;
const timeouts_1 = require("../../utils/timeouts");
/**
 * Validate function module name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/functions/validation
 *
 * Query parameters:
 * - objtype: FUGR/FF
 * - objname: function module name
 * - fugrname: function group name
 * - description: optional description
 *
 * Response format:
 * - Success: <SEVERITY>OK</SEVERITY>
 * - Error: <SEVERITY>ERROR</SEVERITY> with <SHORT_TEXT> message (e.g., "Function module ... already exists")
 */
async function validateFunctionModuleName(connection, functionGroupName, functionModuleName, description) {
    const url = `/sap/bc/adt/functions/validation`;
    const queryParams = new URLSearchParams({
        objtype: 'FUGR/FF',
        objname: functionModuleName,
        fugrname: functionGroupName,
    });
    if (description) {
        queryParams.append('description', description);
    }
    return connection.makeAdtRequest({
        url: `${url}?${queryParams.toString()}`,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.StatusMessage',
        },
    });
}
/**
 * Validate function module source code.
 *
 * If sourceCode is provided: validates unsaved code (live validation with artifacts)
 * If sourceCode is not provided: validates existing FM code in SAP system (without artifacts)
 *
 * @param connection - SAP connection
 * @param functionGroupName - Function group name
 * @param functionModuleName - Function module name
 * @param sourceCode - Optional: source code to validate. If omitted, validates existing FM in SAP
 * @param version - 'active' (default) or 'inactive' - version context for validation
 * @param sessionId - Optional session ID
 * @returns Check result with errors/warnings
 * @throws Error if validation finds syntax errors
 */
async function validateFunctionModuleSource(connection, functionGroupName, functionModuleName, sourceCode, version = 'active') {
    const { runCheckRun, runCheckRunWithSource, parseCheckRunResponse } = await Promise.resolve().then(() => __importStar(require('../../utils/checkRun')));
    // Build object type path for function module
    const objectType = 'function_module';
    const objectName = `${functionGroupName}/${functionModuleName}`;
    let response;
    if (sourceCode) {
        // Live validation with artifacts (code not saved to SAP)
        response = await runCheckRunWithSource(connection, objectType, objectName, sourceCode, version, 'abapCheckRun');
    }
    else {
        // Validate existing object in SAP (without artifacts)
        response = await runCheckRun(connection, objectType, objectName, version, 'abapCheckRun');
    }
    const checkResult = parseCheckRunResponse(response);
    if (checkResult.has_errors) {
        const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
        throw new Error(`Source validation failed: ${errorMessages}`);
    }
    if (checkResult.warnings.length > 0) {
        throw new Error(`Source validation failed: ${checkResult.message || 'Warnings found'}`);
    }
    // If status is 'notProcessed', it's an error
    if (checkResult.status === 'notProcessed') {
        throw new Error(`Source validation failed: ${checkResult.message || 'Object could not be processed'}`);
    }
    return response;
}
