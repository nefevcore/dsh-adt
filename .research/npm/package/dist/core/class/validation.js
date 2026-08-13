"use strict";
/**
 * Class validation
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
exports.validateClassName = validateClassName;
exports.validateClassSource = validateClassSource;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Validate class name and superclass
 * Uses ADT validation endpoint: /sap/bc/adt/oo/validation/objectname
 */
/**
 * Validate class name and superclass
 * Uses ADT validation endpoint: /sap/bc/adt/oo/validation/objectname
 * Returns raw response from ADT - consumer decides how to interpret it
 */
async function validateClassName(connection, className, packageName, description, superClass) {
    // Build query parameters for class validation
    const params = new URLSearchParams({
        objname: className,
        objtype: 'CLAS/OC',
    });
    if (packageName) {
        params.append('packagename', packageName);
    }
    if (description) {
        params.append('description', description);
    }
    if (superClass) {
        params.append('superClass', superClass);
    }
    const url = `/sap/bc/adt/oo/validation/objectname?${params.toString()}`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_VALIDATION_CLASS_NAME,
    };
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers,
    });
}
/**
 * Validate class source code.
 *
 * If sourceCode is provided: validates unsaved code (live validation with artifacts)
 * If sourceCode is not provided: validates existing class code in SAP system (without artifacts)
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param sourceCode - Optional: source code to validate. If omitted, validates existing class in SAP
 * @param version - 'active' (default) or 'inactive' - version context for validation
 * @param sessionId - Optional session ID
 * @returns Check result with errors/warnings
 * @throws Error if validation finds syntax errors
 */
async function validateClassSource(connection, className, sourceCode, version = 'active') {
    const { runCheckRun, runCheckRunWithSource, parseCheckRunResponse } = await Promise.resolve().then(() => __importStar(require('../../utils/checkRun')));
    let response;
    if (sourceCode) {
        // Live validation with artifacts (code not saved to SAP)
        response = await runCheckRunWithSource(connection, 'class', className, sourceCode, version, 'abapCheckRun');
    }
    else {
        // Validate existing object in SAP (without artifacts)
        response = await runCheckRun(connection, 'class', className, version, 'abapCheckRun');
    }
    const checkResult = parseCheckRunResponse(response);
    if (!checkResult.success || checkResult.has_errors) {
        throw new Error(`Source validation failed: ${checkResult.message}`);
    }
    return response;
}
