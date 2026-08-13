"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkScalarFunction = checkScalarFunction;
const checkRun_1 = require("../../utils/checkRun");
async function checkScalarFunction(connection, name, version = 'inactive', sourceCode) {
    const response = await (0, checkRun_1.runCheckRun)(connection, 'scalar_function', name, version, 'abapCheckRun', sourceCode);
    const checkResult = (0, checkRun_1.parseCheckRunResponse)(response);
    if (checkResult.has_errors) {
        const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
        throw new Error(`Scalar function check failed: ${errorMessages}`);
    }
    return response;
}
