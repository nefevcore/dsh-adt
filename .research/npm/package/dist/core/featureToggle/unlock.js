"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockFeatureToggle = unlockFeatureToggle;
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
async function unlockFeatureToggle(connection, name, lockHandle) {
    const encoded = (0, internalUtils_1.encodeSapObjectName)(name.toLowerCase());
    await connection.makeAdtRequest({
        method: 'POST',
        url: `/sap/bc/adt/sfw/featuretoggles/${encoded}`,
        timeout: (0, timeouts_1.getTimeout)('default'),
        params: { _action: 'UNLOCK', lockHandle },
        headers: { 'X-sap-adt-sessiontype': 'stateful' },
    });
}
