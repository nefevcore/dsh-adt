"use strict";
/**
 * Interface check operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkInterface = checkInterface;
const checkRun_1 = require("../../utils/checkRun");
/**
 * Check interface syntax
 */
async function checkInterface(connection, interfaceName, version = 'active', sourceCode, artifactContentType) {
    const response = await (0, checkRun_1.runCheckRun)(connection, 'interface', interfaceName, version, 'abapCheckRun', sourceCode, artifactContentType);
    const checkResult = (0, checkRun_1.parseCheckRunResponse)(response);
    if (checkResult.has_errors) {
        const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
        throw new Error(`Interface check failed: ${errorMessages}`);
    }
    return response;
}
