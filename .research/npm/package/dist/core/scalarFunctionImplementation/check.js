"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkScalarFunctionImplementation = checkScalarFunctionImplementation;
const checkRun_1 = require("../../utils/checkRun");
async function checkScalarFunctionImplementation(connection, name, version = 'inactive', sourceCode) {
    const response = await (0, checkRun_1.runCheckRun)(connection, 'scalar_function_implementation', name, version, 'abapCheckRun', sourceCode);
    const checkResult = (0, checkRun_1.parseCheckRunResponse)(response);
    if (checkResult.has_errors) {
        const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
        throw new Error(`Scalar function implementation check failed: ${errorMessages}`);
    }
    return response;
}
