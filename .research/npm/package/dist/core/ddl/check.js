"use strict";
/**
 * View check operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDdl = checkDdl;
const checkRun_1 = require("../../utils/checkRun");
/**
 * Check view (DDLS) syntax
 */
function shouldRetryMissingVersion(checkResult) {
    if (checkResult.status !== 'notProcessed') {
        return false;
    }
    const message = (checkResult.message || '').toLowerCase();
    return (message.includes('does not exist') ||
        message.includes('missing data definition'));
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function checkDdl(connection, ddlName, version = 'active', sourceCode, logger) {
    let attempt = 0;
    // Allow one retry when system did not materialize inactive version yet
    while (attempt < 2) {
        const response = await (0, checkRun_1.runCheckRun)(connection, 'view', ddlName, version, 'abapCheckRun', sourceCode);
        const checkResult = (0, checkRun_1.parseCheckRunResponse)(response);
        if (!checkResult.success && checkResult.has_errors) {
            const errorMessage = checkResult.message || '';
            if (attempt === 0 && shouldRetryMissingVersion(checkResult)) {
                if (process.env.DEBUG_ADT_LIBS === 'true') {
                    logger?.warn?.(`Check retry for view ${ddlName}: ${errorMessage} (waiting for inactive version)`);
                }
                attempt += 1;
                await delay(2000);
                continue;
            }
            if (shouldRetryMissingVersion(checkResult)) {
                if (process.env.DEBUG_ADT_LIBS === 'true') {
                    logger?.warn?.(`Check warning for view ${ddlName}: ${errorMessage} (version not available, continue)`);
                }
                return response;
            }
            const errorMessages = checkResult.errors
                .map((err) => err.text)
                .join('; ');
            throw new Error(`View check failed: ${errorMessages}`);
        }
        return response;
    }
    // Should not reach here because loop returns on success
    throw new Error(`View check failed: Version ${version} not available for ${ddlName}`);
}
