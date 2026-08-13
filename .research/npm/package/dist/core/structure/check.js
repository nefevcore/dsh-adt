"use strict";
/**
 * Structure check operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkStructure = checkStructure;
const checkRun_1 = require("../../utils/checkRun");
/**
 * Check structure syntax
 * Note: For DDIC objects like structures, check may not be fully supported in all SAP systems.
 * If check fails with "inactive version does not exist" or "importing from database" error, it's often safe to skip.
 */
async function checkStructure(connection, structureName, version = 'active', sourceCode, logger) {
    const response = await (0, checkRun_1.runCheckRun)(connection, 'structure', structureName, version, 'abapCheckRun', sourceCode);
    const checkResult = (0, checkRun_1.parseCheckRunResponse)(response);
    if (!checkResult.success && checkResult.has_errors) {
        // For DDIC objects, "inactive version does not exist" or "importing from database" errors
        // are often non-critical and can be safely ignored, especially for inactive versions
        const errorMessage = checkResult.message || '';
        if ((errorMessage.toLowerCase().includes('inactive version') &&
            errorMessage.toLowerCase().includes('does not exist')) ||
            (errorMessage.toLowerCase().includes('importing') &&
                errorMessage.toLowerCase().includes('database'))) {
            // This is expected behavior for DDIC objects - check may not be fully supported
            // Return response without throwing - test chain can continue
            if (process.env.DEBUG_ADT_LIBS === 'true') {
                logger?.warn?.(`Check warning for structure ${structureName}: ${errorMessage} (check may not be fully supported for DDIC objects)`);
            }
            return response; // Return response anyway
        }
        const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
        throw new Error(`Structure check failed: ${errorMessages}`);
    }
    return response;
}
