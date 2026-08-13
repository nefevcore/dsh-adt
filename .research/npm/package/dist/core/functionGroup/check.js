"use strict";
/**
 * FunctionGroup check operations
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
exports.checkFunctionGroup = checkFunctionGroup;
/**
 * Check function group code (syntax, compilation, rules)
 *
 * CheckRun validates everything: syntax, compilation errors, warnings, code quality rules.
 *
 * Can check:
 * - Existing active function group: provide functionGroupName, version='active', omit sourceCode
 * - Existing inactive function group: provide functionGroupName, version='inactive', omit sourceCode
 * - Hypothetical code: provide functionGroupName, sourceCode, version (object doesn't need to exist)
 *
 * @param connection - SAP connection
 * @param functionGroupName - Function group name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param sourceCode - Optional: source code to validate. If provided, validates hypothetical code without creating object
 * @returns Check result with errors/warnings
 */
async function checkFunctionGroup(connection, functionGroupName, version, sourceCode) {
    const { runCheckRun, runCheckRunWithSource, parseCheckRunResponse } = await Promise.resolve().then(() => __importStar(require('../../utils/checkRun')));
    let response;
    if (sourceCode) {
        // Validate hypothetical code (object doesn't need to exist)
        response = await runCheckRunWithSource(connection, 'function_group', functionGroupName, sourceCode, version, 'abapCheckRun');
    }
    else {
        // Validate existing object in SAP (reads from system)
        response = await runCheckRun(connection, 'function_group', functionGroupName, version, 'abapCheckRun');
    }
    const checkResult = parseCheckRunResponse(response);
    // Check only for type E messages - HTTP 200 is normal, errors are in XML response
    if (checkResult.has_errors) {
        const errorTexts = checkResult.errors
            .map((err) => err.text || '')
            .join(' ')
            .toLowerCase();
        // WORKAROUND: Ignore Kerberos library not loaded error (test cloud issue)
        // This is a known issue in test environments where Kerberos library is not available
        const isKerberosError = errorTexts.includes('kerberos library not loaded');
        // For newly created empty function groups (no function modules), these errors are expected
        // until function modules are added to the function group
        const isEmptyFunctionGroupError = (errorTexts.includes('report') &&
            errorTexts.includes('program statement is missing')) ||
            errorTexts.includes('program type is include') ||
            errorTexts.includes('report/program statement is missing');
        const shouldIgnore = isKerberosError || isEmptyFunctionGroupError;
        if (!shouldIgnore) {
            const errorMessages = checkResult.errors
                .map((err) => err.text)
                .join('; ');
            throw new Error(`Function group check failed: ${errorMessages}`);
        }
    }
    return response;
}
