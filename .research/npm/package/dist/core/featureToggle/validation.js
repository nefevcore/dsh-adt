"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFeatureToggleName = validateFeatureToggleName;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
async function validateFeatureToggleName(connection, name, _packageName, _description) {
    if (!name) {
        throw new Error('Feature toggle name is required');
    }
    return connection.makeAdtRequest({
        method: 'GET',
        url: '/sap/bc/adt/sfw/featuretoggles',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: { Accept: contentTypes_1.ACCEPT_FEATURE_TOGGLE_METADATA },
    });
}
