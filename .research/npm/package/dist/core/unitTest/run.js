"use strict";
/**
 * ABAP Unit test run operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startClassUnitTestRun = startClassUnitTestRun;
exports.startClassUnitTestRunByObject = startClassUnitTestRunByObject;
exports.getClassUnitTestStatus = getClassUnitTestStatus;
exports.getClassUnitTestResult = getClassUnitTestResult;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
function boolAttr(value, fallback) {
    return (value ?? fallback) ? 'true' : 'false';
}
/**
 * Start ABAP Unit test run for specific test classes
 * Uses aunit:tests format (for regular class unit tests)
 */
async function startClassUnitTestRun(connection, tests, options) {
    if (!tests.length) {
        throw new Error('At least one test definition is required');
    }
    const scope = options?.scope ?? {
        ownTests: true,
        foreignTests: false,
        addForeignTestsAsPreview: true,
    };
    const risk = options?.riskLevel ?? {
        harmless: true,
        dangerous: true,
        critical: true,
    };
    const duration = options?.duration ?? {
        short: true,
        medium: true,
        long: true,
    };
    const testsXml = tests
        .map((test) => `<aunit:test containerClass="${(0, internalUtils_1.encodeSapObjectName)(test.containerClass).toUpperCase()}" class="${test.testClass}"/>`)
        .join('');
    const xml = `<?xml version="1.0" encoding="UTF-8"?><aunit:run xmlns:aunit="http://www.sap.com/adt/api/aunit" title="${options?.title || tests[0].testClass}" context="${options?.context || 'MCP ABAP ADT Client'}">
  <aunit:options>
    <aunit:scope ownTests="${boolAttr(scope.ownTests, true)}" foreignTests="${boolAttr(scope.foreignTests, false)}" addForeignTestsAsPreview="${boolAttr(scope.addForeignTestsAsPreview, true)}"/>
    <aunit:riskLevel harmless="${boolAttr(risk.harmless, true)}" dangerous="${boolAttr(risk.dangerous, true)}" critical="${boolAttr(risk.critical, true)}"/>
    <aunit:duration short="${boolAttr(duration.short, true)}" medium="${boolAttr(duration.medium, true)}" long="${boolAttr(duration.long, true)}"/>
  </aunit:options>
  <aunit:tests>
    ${testsXml}
  </aunit:tests>
</aunit:run>`;
    return connection.makeAdtRequest({
        url: '/sap/bc/adt/abapunit/runs',
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xml,
        headers: {
            'Content-Type': contentTypes_1.CT_UNIT_TEST_RUN,
        },
    });
}
/**
 * Start ABAP Unit test run by object (for CDS unit tests)
 * Uses osl:objectSet instead of aunit:tests
 */
async function startClassUnitTestRunByObject(connection, className, options) {
    if (!className) {
        throw new Error('className is required');
    }
    const scope = options?.scope ?? {
        ownTests: true,
        foreignTests: false,
        addForeignTestsAsPreview: true,
    };
    const risk = options?.riskLevel ?? {
        harmless: true,
        dangerous: true,
        critical: true,
    };
    const duration = options?.duration ?? {
        short: true,
        medium: true,
        long: true,
    };
    const xml = `<?xml version="1.0" encoding="UTF-8"?><aunit:run xmlns:aunit="http://www.sap.com/adt/api/aunit" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:osl="http://www.sap.com/api/osl" title="${options?.title || className}" context="${options?.context || 'MCP ABAP ADT Client'}">
  <aunit:options>
    <aunit:scope ownTests="${boolAttr(scope.ownTests, true)}" foreignTests="${boolAttr(scope.foreignTests, false)}" addForeignTestsAsPreview="${boolAttr(scope.addForeignTestsAsPreview, true)}"/>
    <aunit:riskLevel harmless="${boolAttr(risk.harmless, true)}" dangerous="${boolAttr(risk.dangerous, true)}" critical="${boolAttr(risk.critical, true)}"/>
    <aunit:duration short="${boolAttr(duration.short, true)}" medium="${boolAttr(duration.medium, true)}" long="${boolAttr(duration.long, true)}"/>
  </aunit:options>
  <osl:objectSet xsi:type="osl:flatObjectSet">
    <osl:object name="${(0, internalUtils_1.encodeSapObjectName)(className).toUpperCase()}" type="CLAS"/>
  </osl:objectSet>
</aunit:run>`;
    return connection.makeAdtRequest({
        url: '/sap/bc/adt/abapunit/runs',
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xml,
        headers: {
            'Content-Type': contentTypes_1.CT_UNIT_TEST_RUN,
        },
    });
}
async function getClassUnitTestStatus(connection, runId, withLongPolling = true) {
    if (!runId) {
        throw new Error('runId is required');
    }
    const query = withLongPolling ? '?withLongPolling=true' : '';
    return connection.makeAdtRequest({
        url: `/sap/bc/adt/abapunit/runs/${runId}${query}`,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: contentTypes_1.ACCEPT_UNIT_TEST_STATUS,
        },
    });
}
async function getClassUnitTestResult(connection, runId, options) {
    if (!runId) {
        throw new Error('runId is required');
    }
    const params = [];
    if (options?.withNavigationUris === false) {
        params.push('withNavigationUris=false');
    }
    const query = params.length ? `?${params.join('&')}` : '';
    const format = options?.format || 'abapunit';
    const accept = format === 'junit' ? contentTypes_1.ACCEPT_JUNIT_RESULT : contentTypes_1.ACCEPT_UNIT_TEST_RESULT;
    return connection.makeAdtRequest({
        url: `/sap/bc/adt/abapunit/results/${runId}${query}`,
        method: 'GET',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            Accept: accept,
        },
    });
}
