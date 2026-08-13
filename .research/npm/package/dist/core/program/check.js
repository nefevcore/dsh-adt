"use strict";
/**
 * Program check operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkProgram = checkProgram;
const checkRun_1 = require("../../utils/checkRun");
/**
 * Check program syntax
 */
async function checkProgram(connection, programName, version = 'active', sourceCode, artifactContentType) {
    const response = await (0, checkRun_1.runCheckRun)(connection, 'program', programName, version, 'abapCheckRun', sourceCode, artifactContentType);
    const checkResult = (0, checkRun_1.parseCheckRunResponse)(response);
    if (checkResult.has_errors) {
        const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
        throw new Error(`Program check failed: ${errorMessages}`);
    }
    return response;
}
