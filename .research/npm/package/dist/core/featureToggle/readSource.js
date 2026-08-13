"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFeatureToggleSource = readFeatureToggleSource;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
async function readFeatureToggleSource(connection, name, version = 'active') {
    const encoded = (0, internalUtils_1.encodeSapObjectName)(name.toLowerCase());
    return connection.makeAdtRequest({
        method: 'GET',
        url: `/sap/bc/adt/sfw/featuretoggles/${encoded}/source/main`,
        timeout: (0, timeouts_1.getTimeout)('default'),
        params: { version },
        headers: { Accept: contentTypes_1.ACCEPT_FEATURE_TOGGLE_SOURCE },
    });
}
