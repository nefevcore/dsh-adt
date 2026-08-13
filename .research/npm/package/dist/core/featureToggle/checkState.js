"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkFeatureToggleState = checkFeatureToggleState;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
function normaliseState(raw) {
    if (raw === 'on' || raw === 'off' || raw === 'undefined')
        return raw;
    return 'undefined';
}
async function checkFeatureToggleState(connection, name, opts) {
    const encoded = (0, internalUtils_1.encodeSapObjectName)(name.toLowerCase());
    const body = {
        PARAMETERS: { IS_USER_SPECIFIC: Boolean(opts?.userSpecific) },
    };
    const resp = await connection.makeAdtRequest({
        method: 'POST',
        url: `/sap/bc/adt/sfw/featuretoggles/${encoded}/check`,
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: {
            'Content-Type': contentTypes_1.CT_FEATURE_TOGGLE_CHECK_PARAMETERS,
            Accept: contentTypes_1.ACCEPT_FEATURE_TOGGLE_CHECK_RESULT,
        },
        data: JSON.stringify(body),
    });
    const parsed = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
    const r = parsed?.RESULT ?? {};
    return {
        currentState: normaliseState(r.CURRENT_STATE),
        transportPackage: r.TRANSPORT_PACKAGE || undefined,
        transportUri: r.TRANSPORT_URI || undefined,
        customizingTransportAllowed: Boolean(r.CUSTOMIZING_TRANSPORT_ALLOWED),
    };
}
