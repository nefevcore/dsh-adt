"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateFeatureToggle = updateFeatureToggle;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const xmlBuilder_1 = require("./xmlBuilder");
async function updateFeatureToggle(connection, params, lockHandle, _logger) {
    const encoded = (0, internalUtils_1.encodeSapObjectName)(params.feature_toggle_name.toLowerCase());
    const xml = (0, xmlBuilder_1.buildFeatureToggleXml)(params);
    const query = { lockHandle };
    if (params.transport_request)
        query.corrNr = params.transport_request;
    await connection.makeAdtRequest({
        method: 'PUT',
        url: `/sap/bc/adt/sfw/featuretoggles/${encoded}`,
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            'Content-Type': contentTypes_1.CT_FEATURE_TOGGLE_METADATA,
            Accept: contentTypes_1.ACCEPT_FEATURE_TOGGLE_METADATA,
            'X-sap-adt-sessiontype': 'stateful',
        },
        params: query,
        data: xml,
    });
}
