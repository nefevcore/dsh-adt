"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleFeatureToggle = toggleFeatureToggle;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
async function toggleFeatureToggle(connection, params) {
    const encoded = (0, internalUtils_1.encodeSapObjectName)(params.feature_toggle_name.toLowerCase());
    const body = {
        TOGGLE_PARAMETERS: {
            IS_USER_SPECIFIC: Boolean(params.is_user_specific),
            STATE: params.state,
        },
    };
    if (params.transport_request) {
        body.TOGGLE_PARAMETERS.TRANSPORT_REQUEST = params.transport_request;
    }
    await connection.makeAdtRequest({
        method: 'POST',
        url: `/sap/bc/adt/sfw/featuretoggles/${encoded}/toggle`,
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: { 'Content-Type': contentTypes_1.CT_FEATURE_TOGGLE_TOGGLE_PARAMETERS },
        data: JSON.stringify(body),
    });
}
