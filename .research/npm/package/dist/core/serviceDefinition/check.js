"use strict";
/**
 * ServiceDefinition check operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkServiceDefinition = checkServiceDefinition;
const checkRun_1 = require("../../utils/checkRun");
/**
 * Check service definition syntax
 */
async function checkServiceDefinition(connection, serviceDefinitionName, version = 'inactive', sourceCode) {
    const response = await (0, checkRun_1.runCheckRun)(connection, 'service_definition', serviceDefinitionName, version, 'abapCheckRun', sourceCode);
    const checkResult = (0, checkRun_1.parseCheckRunResponse)(response);
    if (checkResult.has_errors) {
        const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
        throw new Error(`Service definition check failed: ${errorMessages}`);
    }
    return response;
}
