"use strict";
/**
 * Enhancement check operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkEnhancement = checkEnhancement;
exports.check = check;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const types_1 = require("./types");
/**
 * Check enhancement syntax/consistency
 *
 * @param connection - SAP connection
 * @param params - Check parameters
 * @returns Axios response with check result
 */
async function checkEnhancement(connection, params) {
    const { enhancement_name, enhancement_type, version = 'inactive', source_code, } = params;
    if (!enhancement_name) {
        throw new Error('enhancement_name is required');
    }
    if (!enhancement_type) {
        throw new Error('enhancement_type is required');
    }
    const encodedName = (0, internalUtils_1.encodeSapObjectName)(enhancement_name).toLowerCase();
    const objectUri = (0, types_1.getEnhancementUri)(enhancement_type, encodedName);
    const versionParam = version === 'inactive' ? 'workingArea' : 'active';
    // Build check run request
    const checkUrl = `/sap/bc/adt/checkruns`;
    // Build check run XML with or without source code artifacts
    // TODO: analyze whether chkrun:contentType can be extracted to a constant
    let artifactsXml = '';
    if (source_code && (0, types_1.supportsSourceCode)(enhancement_type)) {
        // Include source code for live validation (base64 encoded)
        const base64Source = Buffer.from(source_code, 'utf-8').toString('base64');
        artifactsXml = `
    <chkrun:artifacts>
      <chkrun:artifact chkrun:contentType="text/plain; charset=utf-8" chkrun:uri="${objectUri}/source/main">
        ${base64Source}
      </chkrun:artifact>
    </chkrun:artifacts>`;
    }
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkRunRequest xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:reporters>
    <chkrun:reporter chkrun:name="abapCheckRun"/>
  </chkrun:reporters>
  <chkrun:objectSets>
    <chkrun:objectSet>
      <chkrun:objects>
        <chkrun:object adtcore:uri="${objectUri}" chkrun:version="${versionParam}"/>
      </chkrun:objects>
    </chkrun:objectSet>
  </chkrun:objectSets>${artifactsXml}
</chkrun:checkRunRequest>`;
    const headers = {
        Accept: 'application/vnd.sap.adt.checkrun.v1+xml',
        'Content-Type': 'application/vnd.sap.adt.checkrun.v1+xml',
    };
    return connection.makeAdtRequest({
        url: checkUrl,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlPayload,
        headers,
    });
}
/**
 * Convenience function: Check enhancement with simpler signature
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type
 * @param enhancementName - Enhancement name
 * @param version - 'active' or 'inactive' (default: 'inactive')
 * @param sourceCode - Optional source code for live validation
 * @returns Axios response
 */
async function check(connection, enhancementType, enhancementName, version = 'inactive', sourceCode) {
    return checkEnhancement(connection, {
        enhancement_name: enhancementName,
        enhancement_type: enhancementType,
        version,
        source_code: sourceCode,
    });
}
