"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFeatureToggle = readFeatureToggle;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
// NOTE: withLongPolling is intentionally not accepted here. The SFW feature-
// toggle endpoint's support for it is unverified (on-prem only), so readiness
// reads are a plain GET. The public AdtFeatureToggle.read()/readMetadata()
// still accept withLongPolling to satisfy IAdtObject, but it is not forwarded.
async function readFeatureToggle(connection, name, version = 'active') {
    const encoded = (0, internalUtils_1.encodeSapObjectName)(name.toLowerCase());
    return connection.makeAdtRequest({
        method: 'GET',
        url: `/sap/bc/adt/sfw/featuretoggles/${encoded}`,
        timeout: (0, timeouts_1.getTimeout)('default'),
        params: { version },
        headers: { Accept: contentTypes_1.ACCEPT_FEATURE_TOGGLE_METADATA },
    });
}
