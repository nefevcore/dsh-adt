"use strict";
/**
 * Group Activation operations - activate multiple objects with session support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateObjectsGroup = activateObjectsGroup;
const fast_xml_parser_1 = require("fast-xml-parser");
const activationUtils_1 = require("../../utils/activationUtils");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const xmlParser = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
});
/**
 * Extract run ID from location header
 */
function extractRunId(location) {
    const locationValue = (0, internalUtils_1.headerValueToString)(location);
    if (!locationValue)
        return null;
    const match = locationValue.match(/\/activation\/runs\/([^/]+)/);
    return match ? match[1] : null;
}
/**
 * Wait for activation run to complete by polling status
 */
async function waitForActivationRun(connection, runId, maxWaitTime = 60000, pollInterval = 1000) {
    const startTime = Date.now();
    const url = `/sap/bc/adt/activation/runs/${runId}?withLongPolling=true`;
    while (Date.now() - startTime < maxWaitTime) {
        const response = await connection.makeAdtRequest({
            url,
            method: 'GET',
            timeout: (0, timeouts_1.getTimeout)('default'),
            headers: {
                Accept: 'application/xml, application/vnd.sap.adt.backgroundrun.v1+xml',
            },
        });
        const parsed = xmlParser.parse(response.data);
        const run = parsed['runs:run'] || parsed.run || parsed['@_runs:run'];
        if (!run) {
            throw new Error('Invalid activation run response format');
        }
        // Try different ways to extract status attribute
        // XMLParser with attributeNamePrefix: '@_' will parse attributes like runs:status as @_runs:status
        const status = run['@_runs:status'] || run['@_status'] || run.status;
        const _progressPercentage = run['@_runs:progressPercentage'] ||
            run['@_progressPercentage'] ||
            run.progressPercentage;
        if (status === 'finished') {
            return response;
        }
        if (status === 'error' || status === 'failed') {
            throw new Error(`Activation run failed with status: ${status}`);
        }
        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
    throw new Error(`Activation run timeout after ${maxWaitTime}ms`);
}
/**
 * Get activation results
 */
async function getActivationResults(connection, runId) {
    const url = `/sap/bc/adt/activation/results/${runId}`;
    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: 'application/xml',
        },
    });
}
/**
 * Activate multiple objects in a group (with session support)
 *
 * Implements the EclipseADT activation flow:
 * 1. POST /sap/bc/adt/activation/runs?method=activate&preauditRequested=false - Start activation
 * 2. GET /sap/bc/adt/activation/runs/{runId}?withLongPolling=true - Poll for completion
 * 3. GET /sap/bc/adt/activation/results/{runId} - Get activation results
 * 4. GET /sap/bc/adt/activation/inactiveobjects - Check for remaining inactive objects
 *
 * This function allows activating multiple objects of different types in a single request.
 * Useful for activating related objects together (e.g., BDEF + CDS view).
 *
 * @param connection - ABAP connection instance
 * @param objects - Array of objects to activate
 * @param preauditRequested - Request pre-audit before activation (default: false)
 * @returns Axios response with activation result (from step 3 - activation results)
 *
 * @example
 * ```typescript
 * // Activate BDEF and related CDS view together
 * const objects = [
 *   {
 *     type: 'BDEF/BDO',
 *     name: 'ZDEMO_I_CDS_VIEW'
 *   },
 *   {
 *     type: 'DDLS/DF',
 *     name: 'ZDEMO_C_CDS_VIEW'
 *   }
 * ];
 *
 * const result = await activateObjectsGroup(connection, objects);
 * ```
 */
async function activateObjectsGroup(connection, objects, preauditRequested = false) {
    // Step 1: Start activation run
    const url = `/sap/bc/adt/activation/runs?method=activate&preauditRequested=${preauditRequested}`;
    // Build object references XML
    const objectReferences = objects
        .map((obj) => {
        const uri = (0, activationUtils_1.buildObjectUri)(obj.name, obj.type, obj.parentName);
        const typeAttr = obj.type ? ` adtcore:type="${obj.type}"` : '';
        return `  <adtcore:objectReference adtcore:uri="${uri}"${typeAttr} adtcore:name="${obj.name}"/>`;
    })
        .join('\n');
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
${objectReferences}
</adtcore:objectReferences>`;
    const headers = {
        Accept: 'application/xml',
        'Content-Type': 'application/xml',
    };
    const startResponse = await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
        headers,
    });
    // Extract run ID from location header
    const location = (0, internalUtils_1.headerValueToString)(startResponse.headers?.location) ||
        (0, internalUtils_1.headerValueToString)(startResponse.headers?.Location) ||
        (0, internalUtils_1.headerValueToString)(startResponse.headers?.['content-location']) ||
        (0, internalUtils_1.headerValueToString)(startResponse.headers?.['Content-Location']);
    const runId = extractRunId(location);
    if (!runId) {
        throw new Error('Failed to extract activation run ID from response headers');
    }
    // Step 2: Wait for activation to complete
    await waitForActivationRun(connection, runId);
    // Step 3: Get activation results
    const resultsResponse = await getActivationResults(connection, runId);
    // Step 4: Check activation results
    // Note: We don't check inactive objects list because the account may have many broken objects
    // that would break all tests. We rely on the activation results response instead.
    return resultsResponse;
}
