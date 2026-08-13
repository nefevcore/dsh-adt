"use strict";
/**
 * AuthorizationField (SUSO / AUTH) check operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAuthorizationField = checkAuthorizationField;
const contentTypes_1 = require("../../constants/contentTypes");
const checkRun_1 = require("../../utils/checkRun");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Check authorization field via /sap/bc/adt/checkruns?reporters=abapCheckRun.
 *
 * When xmlContent is supplied, the request validates the unsaved payload
 * (same XML that will be PUT), attaching it as a base64 artifact. Otherwise
 * the server re-reads the object by URI and checks the persisted version.
 *
 * The helper runCheckRun() doesn't know the auth URI scheme, so we build
 * the payload inline for both modes.
 */
async function checkAuthorizationField(connection, name, version, xmlContent) {
    if (!name) {
        throw new Error('Authorization field name is required');
    }
    const encoded = (0, internalUtils_1.encodeSapObjectName)(name.toUpperCase());
    const uri = `/sap/bc/adt/aps/iam/auth/${encoded}`;
    let xmlBody;
    if (xmlContent) {
        const base64Content = Buffer.from(xmlContent, 'utf-8').toString('base64');
        xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${uri}" chkrun:version="${version}">
    <chkrun:artifacts>
      <chkrun:artifact chkrun:contentType="${contentTypes_1.CT_AUTHORIZATION_FIELD}" chkrun:uri="${uri}">
        <chkrun:content>${base64Content}</chkrun:content>
      </chkrun:artifact>
    </chkrun:artifacts>
  </chkrun:checkObject>
</chkrun:checkObjectList>`;
    }
    else {
        xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${uri}" chkrun:version="${version}"/>
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
        throw new Error(`Authorization field check failed: ${errorMessages}`);
    }
    return response;
}
