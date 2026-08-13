"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAppendStructure = checkAppendStructure;
const checkRun_1 = require("../../utils/checkRun");
async function checkAppendStructure(connection, name, version = 'inactive', sourceCode) {
    const response = await (0, checkRun_1.runCheckRun)(connection, 'append_structure', name, version, 'abapCheckRun', sourceCode);
    const checkResult = (0, checkRun_1.parseCheckRunResponse)(response);
    if (checkResult.has_errors) {
        const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
        throw new Error(`Append structure check failed: ${errorMessages}`);
    }
    return response;
}
