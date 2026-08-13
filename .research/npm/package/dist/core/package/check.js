"use strict";
/**
 * Package check operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPackage = checkPackage;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Check package for errors
 *
 * @param connection - SAP connection
 * @param packageName - Package name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param xmlContent - Optional XML content to validate (same format as PUT body). If provided, check validates this content instead of saved version.
 * @returns Check result
 *
 * Note: When xmlContent is provided, it should be the same XML that will be sent in PUT request.
 */
async function checkPackage(connection, packageName, version = 'active', xmlContent) {
    const url = `/sap/bc/adt/checkruns`;
    const objectUri = `/sap/bc/adt/packages/${(0, internalUtils_1.encodeSapObjectName)(packageName).toLowerCase()}`;
    let xmlBody;
    if (xmlContent) {
        // Check with XML content (for unsaved changes or new content validation)
        const base64Content = Buffer.from(xmlContent, 'utf-8').toString('base64');
        // TODO: analyze whether chkrun:contentType can be extracted to a constant
        xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}">
    <chkrun:artifacts>
      <chkrun:artifact chkrun:contentType="application/vnd.sap.adt.packages.v2+xml" chkrun:uri="${objectUri}">
        <chkrun:content>${base64Content}</chkrun:content>
      </chkrun:artifact>
    </chkrun:artifacts>
  </chkrun:checkObject>
</chkrun:checkObjectList>`;
    }
    else {
        // Check saved version (without XML content)
        xmlBody = `<?xml version="1.0" encoding="UTF-8"?><chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">

  <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}"/>

</chkrun:checkObjectList>`;
    }
    return await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
        headers: {
            Accept: contentTypes_1.ACCEPT_CHECK_MESSAGES,
            'Content-Type': contentTypes_1.CT_CHECK_OBJECTS,
        },
    });
}
