"use strict";
/**
 * ABAP Unit test run operations for legacy systems (BASIS < 7.50)
 *
 * Legacy systems use:
 * - /sap/bc/adt/abapunit/testruns instead of /sap/bc/adt/abapunit/runs
 * - application/xml for Content-Type and Accept (not versioned vnd.sap.adt.api.abapunit.* types)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startClassUnitTestRunLegacy = startClassUnitTestRunLegacy;
exports.getClassUnitTestStatusLegacy = getClassUnitTestStatusLegacy;
exports.getClassUnitTestResultLegacy = getClassUnitTestResultLegacy;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const CT_XML = 'application/xml';
const ACCEPT_XML = 'application/xml';
/**
 * Start ABAP Unit test run on legacy systems
 * Uses /sap/bc/adt/abapunit/testruns endpoint with aunit:runConfiguration format
 *
 * Legacy format differs from modern:
 * - Root element: aunit:runConfiguration (not aunit:run)
 * - Namespace: http://www.sap.com/adt/aunit (not http://www.sap.com/adt/api/aunit)
 * - Objects via adtcore:objectReferences with URI (not aunit:tests with containerClass/class)
 * - Content-Type/Accept: application/xml (not versioned vnd.sap.adt.api.abapunit.*)
 */
async function startClassUnitTestRunLegacy(connection, tests, _options) {
    if (!tests.length) {
        throw new Error('At least one test definition is required');
    }
    const objectRefs = tests
        .map((test) => {
        const className = (0, internalUtils_1.encodeSapObjectName)(test.containerClass).toLowerCase();
        return `        <adtcore:objectReference adtcore:uri="/sap/bc/adt/oo/classes/${className}"/>`;
    })
        .join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?><aunit:runConfiguration xmlns:aunit="http://www.sap.com/adt/aunit">
  <external>
    <coverage active="false"/>
  </external>
  <adtcore:objectSets xmlns:adtcore="http://www.sap.com/adt/core">
    <objectSet kind="inclusive">
      <adtcore:objectReferences>
${objectRefs}
      </adtcore:objectReferences>
    </objectSet>
  </adtcore:objectSets>
</aunit:runConfiguration>`;
    return connection.makeAdtRequest({
        url: '/sap/bc/adt/abapunit/testruns',
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xml,
        headers: {
            'Content-Type': CT_XML,
            Accept: ACCEPT_XML,
        },
    });
}
async function getClassUnitTestStatusLegacy(connection, runId, withLongPolling = true) {
    if (!runId) {
        throw new Error('runId is required');
    }
    const query = withLongPolling ? '?withLongPolling=true' : '';
    return connection.makeAdtRequest({
        url: `/sap/bc/adt/abapunit/testruns/${runId}${query}`,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: ACCEPT_XML,
        },
    });
}
async function getClassUnitTestResultLegacy(connection, runId, options) {
    if (!runId) {
        throw new Error('runId is required');
    }
    const params = [];
    if (options?.withNavigationUris === false) {
        params.push('withNavigationUris=false');
    }
    const query = params.length ? `?${params.join('&')}` : '';
    return connection.makeAdtRequest({
        url: `/sap/bc/adt/abapunit/testruns/${runId}/results${query}`,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: ACCEPT_XML,
        },
    });
}
