"use strict";
/**
 * Class update operations
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
exports.updateClassWithCheck = updateClassWithCheck;
exports.updateClass = updateClass;
exports.updateClassImplementations = updateClassImplementations;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Update class source code with validation (high-level function)
 *
 * This function:
 * 1. Validates source code using check operation
 * 2. Only updates if validation passes (no errors)
 * 3. Allows warnings to pass through
 *
 * Requires class to be locked first
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param sourceCode - Source code to validate and update
 * @param lockHandle - Lock handle from lock operation
 * @param transportRequest - Optional transport request
 * @returns Update result
 * @throws Error if check finds errors or update fails
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
async function updateClassWithCheck(connection, className, sourceCode, lockHandle, transportRequest, sourceContentType) {
    if (!sourceCode) {
        throw new Error('source_code is required');
    }
    if (!lockHandle) {
        throw new Error('lockHandle is required');
    }
    // Import check function
    const { checkClass } = await Promise.resolve().then(() => __importStar(require('./check')));
    const { parseCheckRunResponse } = await Promise.resolve().then(() => __importStar(require('../../utils/checkRun')));
    // Check source code before update
    const checkResponse = await checkClass(connection, className, 'inactive', sourceCode);
    const checkResult = parseCheckRunResponse(checkResponse);
    // Block update if there are errors
    if (checkResult.has_errors) {
        const errorMessages = checkResult.errors
            .map((err) => err.text)
            .join('; ');
        throw new Error(`Class check failed, update blocked: ${errorMessages}`);
    }
    // Proceed with update (warnings are allowed)
    return await updateClass(connection, className, sourceCode, lockHandle, transportRequest, sourceContentType);
}
/**
 * Update class source code (low-level function)
 * Requires class to be locked first
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
async function updateClass(connection, className, sourceCode, lockHandle, transportRequest, sourceContentType) {
    if (!sourceCode) {
        throw new Error('source_code is required');
    }
    if (!lockHandle) {
        throw new Error('lockHandle is required');
    }
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(className).toLowerCase();
    let url = `/sap/bc/adt/oo/classes/${encodedName}/source/main?lockHandle=${encodeURIComponent(lockHandle)}`;
    if (transportRequest) {
        url += `&corrNr=${transportRequest}`;
    }
    const contentType = sourceContentType || contentTypes_1.CT_SOURCE;
    const headers = {
        'Content-Type': contentType,
        Accept: contentTypes_1.ACCEPT_SOURCE,
    };
    return await connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: sourceCode,
        headers,
    });
}
/**
 * Update class implementations include (low-level function)
 * Requires class to be locked first
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
async function updateClassImplementations(connection, className, implementationCode, lockHandle, transportRequest, sourceContentType) {
    if (!implementationCode) {
        throw new Error('implementationCode is required');
    }
    if (!lockHandle) {
        throw new Error('lockHandle is required');
    }
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(className).toLowerCase();
    let url = `/sap/bc/adt/oo/classes/${encodedName}/includes/implementations?lockHandle=${encodeURIComponent(lockHandle)}`;
    if (transportRequest) {
        url += `&corrNr=${transportRequest}`;
    }
    const contentType = sourceContentType || contentTypes_1.CT_SOURCE;
    const headers = {
        'Content-Type': contentType,
        Accept: contentTypes_1.ACCEPT_SOURCE,
    };
    return await connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: implementationCode,
        headers,
    });
}
