"use strict";
/**
 * Enhancement create operations - Low-level functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = create;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const types_1 = require("./types");
const debugEnabled = process.env.DEBUG_ADT_LIBS === 'true';
/**
 * Build XML payload for enhancement creation based on type
 */
function buildCreateXml(args, masterSystem, username) {
    const description = (0, internalUtils_1.limitDescription)(args.description || args.enhancement_name || '');
    const typeCode = types_1.ENHANCEMENT_TYPE_CODES[args.enhancement_type];
    const masterSystemAttr = masterSystem
        ? ` adtcore:masterSystem="${masterSystem}"`
        : '';
    const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';
    // Base XML structure - may need adjustment based on actual ADT API
    // This is a template that should be verified against SAP documentation
    let enhancementSpecificXml = '';
    if ((0, types_1.isImplementationType)(args.enhancement_type)) {
        // Implementation types need reference to enhancement spot
        if (args.enhancement_spot) {
            enhancementSpecificXml = `<enh:enhancementSpotRef adtcore:name="${args.enhancement_spot}"/>`;
        }
        if (args.badi_definition && args.enhancement_type === 'enhoxhb') {
            enhancementSpecificXml += `<enh:badiDefinitionRef adtcore:name="${args.badi_definition}"/>`;
        }
    }
    return `<?xml version="1.0" encoding="UTF-8"?>
<enh:enhancement xmlns:enh="http://www.sap.com/adt/enhancements" xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="${description}"
  adtcore:language="${args.masterLanguage || 'EN'}"
  adtcore:name="${args.enhancement_name}"
  adtcore:type="${typeCode}"
  adtcore:masterLanguage="${args.masterLanguage || 'EN'}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${args.package_name}"/>
  ${enhancementSpecificXml}
</enh:enhancement>`;
}
/**
 * Low-level: Create enhancement object with metadata (POST)
 * Does NOT lock/upload/activate - just creates the object
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 *
 * @param connection - SAP connection
 * @param args - Create parameters
 * @returns Axios response
 */
async function create(connection, args, logger) {
    if (!args.enhancement_name) {
        throw new Error('enhancement_name is required');
    }
    if (!args.enhancement_type) {
        throw new Error('enhancement_type is required');
    }
    if (!args.package_name) {
        throw new Error('package_name is required');
    }
    const url = `${(0, types_1.getEnhancementBaseUrl)(args.enhancement_type)}${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;
    const metadataXml = buildCreateXml(args, args.masterSystem, args.responsible);
    const headers = {
        Accept: contentTypes_1.ACCEPT_ENHANCEMENT,
        'Content-Type': contentTypes_1.CT_ENHANCEMENT,
    };
    if (debugEnabled) {
        logger?.debug?.(`[DEBUG] Creating enhancement - URL: ${url}`);
        logger?.debug?.(`[DEBUG] Creating enhancement - Method: POST`);
        logger?.debug?.(`[DEBUG] Creating enhancement - Headers: ${JSON.stringify(headers, null, 2)}`);
        logger?.debug?.(`[DEBUG] Creating enhancement - Body (first 500 chars): ${metadataXml.substring(0, 500)}`);
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
        if (e.response && debugEnabled) {
            logger?.error?.(`[ERROR] Create enhancement failed - Status: ${e.response.status}`);
            logger?.error?.(`[ERROR] Create enhancement failed - StatusText: ${e.response.statusText}`);
            logger?.error?.(`[ERROR] Create enhancement failed - Response headers: ${JSON.stringify(e.response.headers, null, 2)}`);
            logger?.error?.(`[ERROR] Create enhancement failed - Response data (first 1000 chars):`, typeof e.response.data === 'string'
                ? e.response.data.substring(0, 1000)
                : (0, internalUtils_1.safeStringify)(e.response.data).substring(0, 1000));
        }
        throw error;
    }
}
