"use strict";
/**
 * Class create operations - Low-level functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = create;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const debugEnabled = process.env.DEBUG_ADT_LIBS === 'true';
/**
 * Low-level: Create class object with metadata (POST)
 * Does NOT lock/upload/activate - just creates the object
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
async function create(connection, args, logger, contentTypes) {
    // Description is limited to 60 characters in SAP ADT
    const description = (0, internalUtils_1.limitDescription)(args.description || args.class_name || '');
    const url = `/sap/bc/adt/oo/classes${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;
    const masterSystem = args.master_system || '';
    const username = args.responsible || '';
    const finalAttr = args.final ? 'true' : 'false';
    const visibilityAttr = args.create_protected ? 'protected' : 'public';
    const superClassXml = args.superclass
        ? `<class:superClassRef adtcore:name="${args.superclass}"/>`
        : '<class:superClassRef/>';
    const masterSystemAttr = masterSystem
        ? ` adtcore:masterSystem="${masterSystem}"`
        : '';
    const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';
    const abapSourceNamespace = args.template_xml
        ? ' xmlns:abapsource="http://www.sap.com/adt/abapsource"'
        : '';
    const templateSection = args.template_xml
        ? `\n\n  ${args.template_xml}\n\n`
        : '\n\n';
    const metadataXml = `<?xml version="1.0" encoding="UTF-8"?><class:abapClass xmlns:class="http://www.sap.com/adt/oo/classes" xmlns:adtcore="http://www.sap.com/adt/core"${abapSourceNamespace} adtcore:description="${description}" adtcore:language="${args.masterLanguage || 'EN'}" adtcore:name="${args.class_name}" adtcore:type="CLAS/OC" adtcore:masterLanguage="${args.masterLanguage || 'EN'}"${masterSystemAttr}${responsibleAttr} class:final="${finalAttr}" class:visibility="${visibilityAttr}">



  <adtcore:packageRef adtcore:name="${args.package_name}"/>



  ${templateSection}



  <class:include adtcore:name="CLAS/OC" adtcore:type="CLAS/OC" class:includeType="testclasses"/>



  ${superClassXml}



</class:abapClass>`;
    const ct = contentTypes?.classCreate();
    const headers = {
        Accept: ct?.accept || contentTypes_1.CT_CLASS,
        'Content-Type': ct?.contentType || contentTypes_1.CT_CLASS,
    };
    // Log request details for debugging authorization issues
    if (debugEnabled) {
        logger?.debug?.(`[DEBUG] Creating class - URL: ${url}`);
        logger?.debug?.(`[DEBUG] Creating class - Method: POST`);
        logger?.debug?.(`[DEBUG] Creating class - Headers: ${JSON.stringify(headers, null, 2)}`);
        logger?.debug?.(`[DEBUG] Creating class - Body (first 500 chars): ${metadataXml.substring(0, 500)}`);
    }
    try {
        const response = await connection.makeAdtRequest({
            url,
            method: 'POST',
            timeout: (0, timeouts_1.getTimeout)('default'),
            data: metadataXml,
            headers,
        });
        return response;
    }
    catch (error) {
        const e = error;
        // Log error details for debugging
        if (e.response && debugEnabled) {
            logger?.error?.(`[ERROR] Create class failed - Status: ${e.response.status}`);
            logger?.error?.(`[ERROR] Create class failed - StatusText: ${e.response.statusText}`);
            logger?.error?.(`[ERROR] Create class failed - Response headers: ${JSON.stringify(e.response.headers, null, 2)}`);
            logger?.error?.(`[ERROR] Create class failed - Response data (first 1000 chars):`, typeof e.response.data === 'string'
                ? e.response.data.substring(0, 1000)
                : (0, internalUtils_1.safeStringify)(e.response.data).substring(0, 1000));
        }
        throw error;
    }
}
