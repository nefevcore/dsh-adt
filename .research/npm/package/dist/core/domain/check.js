"use strict";
/**
 * Domain check operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDomainSyntax = checkDomainSyntax;
const contentTypes_1 = require("../../constants/contentTypes");
const checkRun_1 = require("../../utils/checkRun");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Check domain syntax
 *
 * @param connection - SAP connection
 * @param domainName - Domain name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param xmlContent - Optional XML content to validate (same format as PUT body). If provided, check validates this content instead of saved version.
 * @returns Check result with errors/warnings
 *
 * Note: When xmlContent is provided, it should be the same XML that will be sent in PUT request.
 */
async function checkDomainSyntax(connection, domainName, version, xmlContent, _logger) {
    let response;
    if (xmlContent) {
        // Check with XML content (for unsaved changes or new content validation)
        const encodedName = (0, internalUtils_1.encodeSapObjectName)(domainName.toLowerCase());
        const objectUri = `/sap/bc/adt/ddic/domains/${encodedName}`;
        const base64Content = Buffer.from(xmlContent, 'utf-8').toString('base64');
        // TODO: analyze whether chkrun:contentType can be extracted to a constant
        const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}">
    <chkrun:artifacts>
      <chkrun:artifact chkrun:contentType="application/vnd.sap.adt.domains.v2+xml; charset=utf-8" chkrun:uri="${objectUri}">
        <chkrun:content>${base64Content}</chkrun:content>
      </chkrun:artifact>
    </chkrun:artifacts>
  </chkrun:checkObject>
</chkrun:checkObjectList>`;
        const headers = {
            Accept: contentTypes_1.ACCEPT_CHECK_MESSAGES,
            'Content-Type': contentTypes_1.CT_CHECK_OBJECTS,
        };
        const url = `/sap/bc/adt/checkruns?reporters=abapCheckRun`;
        response = await connection.makeAdtRequest({
            url,
            method: 'POST',
            timeout: (0, timeouts_1.getTimeout)('default'),
            data: xmlBody,
            headers,
        });
    }
    else {
        // Check saved version (without XML content)
        response = await (0, checkRun_1.runCheckRun)(connection, 'domain', domainName, version, 'abapCheckRun', undefined);
    }
    const checkResult = (0, checkRun_1.parseCheckRunResponse)(response);
    if (checkResult.has_errors) {
        const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
        throw new Error(`Domain check failed: ${errorMessages}`);
    }
    return response;
}
