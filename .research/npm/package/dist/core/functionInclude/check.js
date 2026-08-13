"use strict";
/**
 * FunctionInclude (FUGR/I) check operations.
 *
 * Uses /sap/bc/adt/checkruns?reporters=abapCheckRun. When sourceCode is
 * supplied, the unsaved source is attached as a base64 artifact; otherwise
 * the server re-reads the persisted version by URI.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkFunctionInclude = checkFunctionInclude;
const contentTypes_1 = require("../../constants/contentTypes");
const checkRun_1 = require("../../utils/checkRun");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Check function include via /sap/bc/adt/checkruns?reporters=abapCheckRun.
 */
async function checkFunctionInclude(connection, groupName, includeName, version, xmlContent, sourceContentType) {
    if (!groupName) {
        throw new Error('Function group name is required');
    }
    if (!includeName) {
        throw new Error('Include name is required');
    }
    const groupLower = (0, internalUtils_1.encodeSapObjectName)(groupName).toLowerCase();
    const encodedInclude = (0, internalUtils_1.encodeSapObjectName)(includeName.toUpperCase());
    const objectUri = `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}`;
    let xmlBody;
    if (xmlContent) {
        const base64Content = Buffer.from(xmlContent, 'utf-8').toString('base64');
        const artifactContentType = sourceContentType || 'text/plain; charset=utf-8';
        xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}">
    <chkrun:artifacts>
      <chkrun:artifact chkrun:contentType="${artifactContentType}" chkrun:uri="${objectUri}/source/main">
        <chkrun:content>${base64Content}</chkrun:content>
      </chkrun:artifact>
    </chkrun:artifacts>
  </chkrun:checkObject>
</chkrun:checkObjectList>`;
    }
    else {
        xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}"/>
</chkrun:checkObjectList>`;
    }
    const response = await connection.makeAdtRequest({
        url: '/sap/bc/adt/checkruns?reporters=abapCheckRun',
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
        headers: {
            Accept: contentTypes_1.ACCEPT_CHECK_MESSAGES,
            'Content-Type': contentTypes_1.CT_CHECK_OBJECTS,
        },
    });
    const checkResult = (0, checkRun_1.parseCheckRunResponse)(response);
    if (checkResult.has_errors) {
        const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
        throw new Error(`Function include check failed: ${errorMessages}`);
    }
    return response;
}
