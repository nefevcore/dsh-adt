"use strict";
/**
 * Class check operations
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
exports.checkClass = checkClass;
exports.checkClassLocalTestClass = checkClassLocalTestClass;
exports.checkClassLocalTypes = checkClassLocalTypes;
exports.checkClassDefinitions = checkClassDefinitions;
exports.checkClassMacros = checkClassMacros;
const contentTypes_1 = require("../../constants/contentTypes");
/**
 * Check class code (syntax, compilation, rules)
 *
 * CheckRun validates everything: syntax, compilation errors, warnings, code quality rules.
 *
 * Can check:
 * - Existing active class: provide className, version='active', omit sourceCode
 * - Existing inactive class: provide className, version='inactive', omit sourceCode
 * - Hypothetical code: provide className, sourceCode, version (object doesn't need to exist)
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param sourceCode - Optional: source code to validate. If provided, validates hypothetical code without creating object
 * @returns Check result with errors/warnings
 */
async function checkClass(connection, className, version, sourceCode, artifactContentType) {
    const { runCheckRun, runCheckRunWithSource, parseCheckRunResponse } = await Promise.resolve().then(() => __importStar(require('../../utils/checkRun')));
    let response;
    if (sourceCode) {
        // Validate hypothetical code (object doesn't need to exist)
        response = await runCheckRunWithSource(connection, 'class', className, sourceCode, version, 'abapCheckRun', artifactContentType);
    }
    else {
        // Validate existing object in SAP (reads from system)
        response = await runCheckRun(connection, 'class', className, version, 'abapCheckRun');
    }
    const checkResult = parseCheckRunResponse(response);
    if (checkResult.has_errors) {
        const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
        throw new Error(`Class check failed: ${errorMessages}`);
    }
    return response;
}
/**
 * Check class local test class code (syntax, compilation, rules)
 *
 * Validates ABAP Unit test classes in the testclasses include.
 * This is separate from main class check because test classes use a different URI.
 *
 * @param connection - SAP connection
 * @param className - Class name (container class for the test)
 * @param testClassSource - Test class source code to validate
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @returns Check result with errors/warnings
 * @throws Error if check finds errors (chkrun:type="E")
 */
async function checkClassLocalTestClass(connection, className, testClassSource, version = 'inactive', artifactContentType = 'text/plain; charset=utf-8') {
    return checkClassInclude(connection, className, testClassSource, 'testclasses', version, 'Test class', artifactContentType);
}
/**
 * Check class local types (implementations include)
 *
 * Validates local helper classes, interface definitions and type declarations
 * in the implementations include file.
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param localTypesSource - Local types source code to validate
 * @param version - 'active' or 'inactive'
 * @returns Check result with errors/warnings
 * @throws Error if check finds errors (chkrun:type="E")
 */
async function checkClassLocalTypes(connection, className, localTypesSource, version = 'inactive', artifactContentType = 'text/plain; charset=utf-8') {
    return checkClassInclude(connection, className, localTypesSource, 'implementations', version, 'Local types', artifactContentType);
}
/**
 * Check class-relevant local types (definitions include)
 *
 * Validates type declarations needed for components in the private section
 * in the definitions include file.
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param definitionsSource - Definitions source code to validate
 * @param version - 'active' or 'inactive'
 * @returns Check result with errors/warnings
 * @throws Error if check finds errors (chkrun:type="E")
 */
async function checkClassDefinitions(connection, className, definitionsSource, version = 'inactive', artifactContentType = 'text/plain; charset=utf-8') {
    return checkClassInclude(connection, className, definitionsSource, 'definitions', version, 'Definitions', artifactContentType);
}
/**
 * Check class macros
 *
 * Validates macro definitions needed in the implementation part of the class.
 * Note: Macros are supported in older ABAP versions but not in newer ones.
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param macrosSource - Macros source code to validate
 * @param version - 'active' or 'inactive'
 * @returns Check result with errors/warnings
 * @throws Error if check finds errors (chkrun:type="E")
 */
async function checkClassMacros(connection, className, macrosSource, version = 'inactive', artifactContentType = 'text/plain; charset=utf-8') {
    return checkClassInclude(connection, className, macrosSource, 'macros', version, 'Macros', artifactContentType);
}
/**
 * Generic function to check any class include file
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param includeSource - Include source code to validate
 * @param includeType - Type of include (implementations, definitions, macros, testclasses)
 * @param version - 'active' or 'inactive'
 * @param includeName - Human-readable name for error messages
 * @returns Check result with errors/warnings
 * @throws Error if check finds errors (chkrun:type="E")
 */
async function checkClassInclude(connection, className, includeSource, includeType, version = 'inactive', includeName, artifactContentType = 'text/plain; charset=utf-8') {
    const { getTimeout } = await Promise.resolve().then(() => __importStar(require('../../utils/timeouts')));
    const { encodeSapObjectName } = await Promise.resolve().then(() => __importStar(require('../../utils/internalUtils')));
    const { parseCheckRunResponse } = await Promise.resolve().then(() => __importStar(require('../../utils/checkRun')));
    const encodedName = encodeSapObjectName(className.toLowerCase());
    const objectUri = `/sap/bc/adt/oo/classes/${encodedName}`;
    const includeUri = `${objectUri}/includes/${includeType}`;
    // Encode source to base64
    const base64Source = Buffer.from(includeSource, 'utf-8').toString('base64');
    // Build XML with include artifact
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}">
    <chkrun:artifacts>
      <chkrun:artifact chkrun:contentType="${artifactContentType}" chkrun:uri="${includeUri}">
        <chkrun:content>${base64Source}</chkrun:content>
      </chkrun:artifact>
    </chkrun:artifacts>
  </chkrun:checkObject>
</chkrun:checkObjectList>`;
    const headers = {
        Accept: contentTypes_1.ACCEPT_CHECK_MESSAGES,
        'Content-Type': contentTypes_1.CT_CHECK_OBJECTS,
    };
    const url = `/sap/bc/adt/checkruns?reporters=abapCheckRun`;
    const response = await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: getTimeout('default'),
        data: xmlBody,
        headers,
    });
    const checkResult = parseCheckRunResponse(response);
    if (checkResult.has_errors) {
        const errorMessages = checkResult.errors.length > 0
            ? checkResult.errors
                .map((err) => err.text)
                .join('; ')
            : `status=${checkResult.status}, message=${checkResult.message || 'none'}`;
        throw new Error(`${includeName} check failed: ${errorMessages}`);
    }
    return response;
}
