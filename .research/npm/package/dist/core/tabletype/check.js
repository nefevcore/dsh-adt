"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTableTypeCheckRun = runTableTypeCheckRun;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Build check run XML payload
 * @param tableTypeName - Table type name
 * @param sourceCode - Optional DDL source code to validate (will be base64 encoded in artifacts)
 * @param version - Version to check ('active', 'inactive', or 'new')
 */
function buildCheckRunPayload(tableTypeName, sourceCode, version = 'new') {
    const uriName = (0, internalUtils_1.encodeSapObjectName)(tableTypeName).toLowerCase();
    const objectUri = `/sap/bc/adt/ddic/tabletypes/${uriName}`;
    if (sourceCode) {
        // Check with source code content (for unsaved changes or new code validation)
        // TODO: analyze whether chkrun:contentType can be extracted to a constant
        const base64Source = Buffer.from(sourceCode, 'utf-8').toString('base64');
        return `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}">
    <chkrun:artifacts>
      <chkrun:artifact chkrun:contentType="text/plain; charset=utf-8" chkrun:uri="${objectUri}/source/main">
        <chkrun:content>${base64Source}</chkrun:content>
      </chkrun:artifact>
    </chkrun:artifacts>
  </chkrun:checkObject>
</chkrun:checkObjectList>`;
    }
    // Check saved version (without source code)
    return `<?xml version="1.0" encoding="UTF-8"?><chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
    <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}"/>
  </chkrun:checkObjectList>`;
}
/**
 * Run check run for table type
 * Note: This is a table type-specific check function. For generic check, use runCheckRun from shared/checkRun
 *
 * @param connection - ABAP connection
 * @param reporter - Check reporter type
 * @param tableTypeName - Table type name to check
 * @param sourceCode - Optional DDL source code to validate (for checking unsaved/new code)
 * @param version - Version to check ('active', 'inactive', or 'new'). Default: 'new'
 * @returns Check result with errors/warnings
 */
async function runTableTypeCheckRun(connection, reporter, tableTypeName, sourceCode, version = 'new') {
    const payload = buildCheckRunPayload(tableTypeName, sourceCode, version);
    const headers = {
        Accept: contentTypes_1.ACCEPT_CHECK_MESSAGES,
        'Content-Type': contentTypes_1.CT_CHECK_OBJECTS,
    };
    const url = `/sap/bc/adt/checkruns?reporters=${reporter}`;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: payload,
        headers,
    });
}
