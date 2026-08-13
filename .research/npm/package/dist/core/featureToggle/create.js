"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = create;
const contentTypes_1 = require("../../constants/contentTypes");
const timeouts_1 = require("../../utils/timeouts");
const xmlBuilder_1 = require("./xmlBuilder");
async function create(connection, args) {
    const xml = (0, xmlBuilder_1.buildFeatureToggleXml)(args);
    const params = {};
    if (args.transport_request)
        params.corrNr = args.transport_request;
    return connection.makeAdtRequest({
        method: 'POST',
        url: '/sap/bc/adt/sfw/featuretoggles',
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            'Content-Type': contentTypes_1.CT_FEATURE_TOGGLE_METADATA,
            Accept: contentTypes_1.ACCEPT_FEATURE_TOGGLE_METADATA,
        },
        params,
        data: xml,
    });
}
