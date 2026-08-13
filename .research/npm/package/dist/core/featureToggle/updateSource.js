"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFeatureToggleSource = uploadFeatureToggleSource;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
async function uploadFeatureToggleSource(connection, name, source, lockHandle, transportRequest) {
    const encoded = (0, internalUtils_1.encodeSapObjectName)(name.toLowerCase());
    const params = { lockHandle };
    if (transportRequest)
        params.corrNr = transportRequest;
    await connection.makeAdtRequest({
        method: 'PUT',
        url: `/sap/bc/adt/sfw/featuretoggles/${encoded}/source/main`,
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            'Content-Type': contentTypes_1.CT_FEATURE_TOGGLE_SOURCE,
            'X-sap-adt-sessiontype': 'stateful',
        },
        params,
        data: JSON.stringify(source),
    });
}
