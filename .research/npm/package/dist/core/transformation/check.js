"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkTransformation = checkTransformation;
const checkRun_1 = require("../../utils/checkRun");
/**
 * Check transformation syntax
 */
async function checkTransformation(connection, transformationName, version = 'inactive', sourceCode) {
    const response = await (0, checkRun_1.runCheckRun)(connection, 'transformation', transformationName, version, 'abapCheckRun', sourceCode);
    const checkResult = (0, checkRun_1.parseCheckRunResponse)(response);
    if (checkResult.has_errors) {
        const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
        throw new Error(`Transformation check failed: ${errorMessages}`);
    }
    return response;
}
