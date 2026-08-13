"use strict";
/**
 * Interface create operations - Low-level functions (1 function = 1 HTTP request)
 *
 * NOTE: Caller should call connection.setSessionType("stateful") before creating
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInterfaceTemplate = generateInterfaceTemplate;
exports.create = create;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
/**
 * Generate minimal interface source code if not provided
 */
function generateInterfaceTemplate(interfaceName, description) {
    return `INTERFACE ${interfaceName}
  PUBLIC.

  " ${description}

  METHODS: get_value
    RETURNING VALUE(rv_result) TYPE string.

ENDINTERFACE.`;
}
/**
 * Low-level: Create interface object with metadata (POST)
 * Does NOT lock/upload/activate - just creates the object
 */
async function create(connection, params, logger) {
    const finalMasterSystem = params.masterSystem || '';
    const finalResponsible = params.responsible || '';
    // Description is limited to 60 characters in SAP ADT
    const limitedDescription = (0, internalUtils_1.limitDescription)(params.description);
    const masterSystemAttr = finalMasterSystem
        ? ` adtcore:masterSystem="${finalMasterSystem}"`
        : '';
    const responsibleAttr = finalResponsible
        ? ` adtcore:responsible="${finalResponsible}"`
        : '';
    const payload = `<?xml version="1.0" encoding="UTF-8"?><intf:abapInterface xmlns:intf="http://www.sap.com/adt/oo/interfaces" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${limitedDescription}" adtcore:language="${params.masterLanguage || 'EN'}" adtcore:name="${params.interfaceName}" adtcore:type="INTF/OI" adtcore:masterLanguage="${params.masterLanguage || 'EN'}"${masterSystemAttr}${responsibleAttr}>



  <adtcore:packageRef adtcore:name="${params.packageName}"/>



</intf:abapInterface>`;
    const url = `/sap/bc/adt/oo/interfaces${params.transportRequest ? `?corrNr=${params.transportRequest}` : ''}`;
    const headers = {
        'Content-Type': contentTypes_1.CT_INTERFACE,
        Accept: contentTypes_1.CT_INTERFACE,
    };
    try {
        const response = await connection.makeAdtRequest({
            url,
            method: 'POST',
            timeout: (0, timeouts_1.getTimeout)('default'),
            data: payload,
            headers,
        });
        // Verify response status - should be 201 Created
        if (response.status !== 201 && response.status !== 200) {
            const errorData = typeof response.data === 'string'
                ? response.data.substring(0, 1000)
                : JSON.stringify(response.data).substring(0, 1000);
            logger?.error?.(`[ERROR] Create interface returned unexpected status - Status: ${response.status}`);
            logger?.error?.(`[ERROR] Create interface - Response data:`, errorData);
            throw new Error(`Interface creation returned status ${response.status} instead of 201`);
        }
        return response;
    }
    catch (error) {
        const e = error;
        // Log error details for debugging (similar to class create)
        if (e.response) {
            const errorData = typeof e.response.data === 'string'
                ? e.response.data.substring(0, 1000)
                : (0, internalUtils_1.safeStringify)(e.response.data).substring(0, 1000);
            logger?.error?.(`[ERROR] Create interface failed - Status: ${e.response.status}`);
            logger?.error?.(`[ERROR] Create interface failed - StatusText: ${e.response.statusText}`);
            logger?.error?.(`[ERROR] Create interface failed - Response data:`, errorData);
        }
        throw error;
    }
}
