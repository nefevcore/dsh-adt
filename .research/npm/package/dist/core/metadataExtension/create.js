"use strict";
/**
 * Create Metadata Extension (DDLX)
 *
 * Endpoint: POST /sap/bc/adt/ddic/ddlx/sources
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMetadataExtension = createMetadataExtension;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Create a new metadata extension (DDLX)
 *
 * @param connection - ABAP connection instance
 * @param params - Creation parameters
 * @param sessionId - Session ID for request tracking
 * @returns Axios response with created metadata extension details
 *
 * @example
 * ```typescript
 * const response = await createMetadataExtension(connection, {
 *   name: 'ZDEMO_C_CDS_MDE',
 *   description: 'First metadata extension',
 *   packageName: 'ZDEMO_PKG',
 *   transportRequest: 'TRLK900123'
 * }, sessionId);
 * ```
 */
async function createMetadataExtension(connection, params) {
    const url = '/sap/bc/adt/ddic/ddlx/sources';
    const masterLanguage = params.masterLanguage || 'EN';
    const masterSystem = params.masterSystem || '';
    const responsible = params.responsible || '';
    // Description is limited to 60 characters in SAP ADT
    const description = (0, internalUtils_1.limitDescription)(params.description);
    // Build XML with conditional attributes
    const masterSystemAttr = masterSystem
        ? ` adtcore:masterSystem="${masterSystem}"`
        : '';
    const responsibleAttr = responsible
        ? ` adtcore:responsible="${responsible}"`
        : '';
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><ddlxsources:ddlxSource xmlns:ddlxsources="http://www.sap.com/adt/ddic/ddlxsources" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${masterLanguage}" adtcore:name="${params.name}" adtcore:type="DDLX/EX" adtcore:masterLanguage="${masterLanguage}"${masterSystemAttr}${responsibleAttr}>
    ${params.transportRequest
        ? `<adtcore:packageRef adtcore:name="${params.packageName}">
    <adtcore:properties>
      <adtcore:property adtcore:name="abapLanguageVersion" adtcore:value=""/>
    </adtcore:properties>
  </adtcore:packageRef>
  <adtcore:transportInfo>
    <adtcore:localObject/>
  </adtcore:transportInfo>`
        : `<adtcore:packageRef adtcore:name="${params.packageName}"/>`}
  
</ddlxsources:ddlxSource>`;
    const headers = {
        Accept: contentTypes_1.CT_METADATA_EXTENSION,
        'Content-Type': contentTypes_1.CT_METADATA_EXTENSION,
    };
    const queryParams = params.transportRequest
        ? { corrNr: params.transportRequest }
        : undefined;
    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
        headers,
        params: queryParams,
    });
}
