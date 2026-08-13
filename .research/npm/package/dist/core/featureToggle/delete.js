"use strict";
/**
 * Feature Toggle (FTG2/FT) delete operations - Low-level functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDeletion = checkDeletion;
exports.deleteFeatureToggle = deleteFeatureToggle;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
function objectUri(name) {
    return `/sap/bc/adt/sfw/featuretoggles/${(0, internalUtils_1.encodeSapObjectName)(name.toLowerCase())}`;
}
/**
 * Low-level: Check if feature toggle can be deleted
 */
async function checkDeletion(connection, params) {
    if (!params.feature_toggle_name) {
        throw new Error('feature_toggle_name is required');
    }
    const uri = objectUri(params.feature_toggle_name);
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${uri}"/>
</del:checkRequest>`;
    return connection.makeAdtRequest({
        url: '/sap/bc/adt/deletion/check',
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlPayload,
        headers: {
            Accept: contentTypes_1.ACCEPT_DELETION_CHECK,
            'Content-Type': contentTypes_1.CT_DELETION_CHECK,
        },
    });
}
/**
 * Low-level: Delete feature toggle
 */
async function deleteFeatureToggle(connection, params) {
    if (!params.feature_toggle_name) {
        throw new Error('feature_toggle_name is required');
    }
    const uri = objectUri(params.feature_toggle_name);
    const transportTag = params.transport_request?.trim()
        ? `<del:transportNumber>${params.transport_request}</del:transportNumber>`
        : '<del:transportNumber/>';
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${uri}">
    ${transportTag}
  </del:object>
</del:deletionRequest>`;
    const response = await connection.makeAdtRequest({
        url: '/sap/bc/adt/deletion/delete',
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlPayload,
        headers: {
            Accept: contentTypes_1.ACCEPT_DELETION,
            'Content-Type': contentTypes_1.CT_DELETION,
        },
    });
    return {
        ...response,
        data: {
            success: true,
            feature_toggle_name: params.feature_toggle_name,
            object_uri: uri,
            transport_request: params.transport_request || 'local',
            message: `Feature toggle ${params.feature_toggle_name} deleted successfully`,
        },
    };
}
