"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockFeatureToggle = lockFeatureToggle;
const fast_xml_parser_1 = require("fast-xml-parser");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
async function lockFeatureToggle(connection, name, logger) {
    const encoded = (0, internalUtils_1.encodeSapObjectName)(name.toLowerCase());
    const resp = await connection.makeAdtRequest({
        method: 'POST',
        url: `/sap/bc/adt/sfw/featuretoggles/${encoded}`,
        timeout: (0, timeouts_1.getTimeout)('default'),
        params: { _action: 'LOCK', accessMode: 'MODIFY' },
        headers: {
            'X-sap-adt-sessiontype': 'stateful',
            Accept: 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.Result2,' +
                'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.Result',
        },
    });
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
    });
    const parsed = parser.parse(resp.data);
    const handle = parsed?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
    if (!handle) {
        logger?.error?.(`FeatureToggle lock: no LOCK_HANDLE in response`);
        throw new Error(`FeatureToggle ${name}: lock response has no LOCK_HANDLE`);
    }
    return String(handle);
}
