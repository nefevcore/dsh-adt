"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFeatureToggleState = getFeatureToggleState;
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
function normaliseState(raw) {
    if (raw === 'on' || raw === 'off' || raw === 'undefined')
        return raw;
    return 'undefined';
}
async function getFeatureToggleState(connection, name) {
    const encoded = (0, internalUtils_1.encodeSapObjectName)(name.toLowerCase());
    const resp = await connection.makeAdtRequest({
        method: 'GET',
        url: `/sap/bc/adt/sfw/featuretoggles/${encoded}/states`,
        timeout: (0, timeouts_1.getTimeout)('default'),
        headers: { Accept: contentTypes_1.ACCEPT_FEATURE_TOGGLE_STATES },
    });
    const parsed = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
    const s = parsed?.STATES ?? {};
    return {
        name: String(s.NAME ?? name.toUpperCase()),
        clientState: normaliseState(s.CLIENT_STATE),
        userState: normaliseState(s.USER_STATE),
        clientChangedBy: s.CLIENT_CHANGED_BY || undefined,
        clientChangedOn: s.CLIENT_CHANGED_ON || undefined,
        clientStates: Array.isArray(s.CLIENT_STATES)
            ? s.CLIENT_STATES.map((c) => ({
                client: String(c.CLIENT),
                description: c.DESCRIPTION || undefined,
                state: normaliseState(c.STATE),
            }))
            : [],
        userStates: Array.isArray(s.USER_STATES)
            ? s.USER_STATES.map((u) => ({
                user: String(u.USER),
                state: normaliseState(u.STATE),
            }))
            : [],
    };
}
