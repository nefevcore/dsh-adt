"use strict";
/**
 * Message class create operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMessageClass = createMessageClass;
const timeouts_1 = require("../../utils/timeouts");
const xml_1 = require("./xml");
const BASE = '/sap/bc/adt/messageclass';
/**
 * Create a new message class (shell — no messages yet).
 * POST /sap/bc/adt/messageclass[?corrNr={transport}] with Content-Type application/xml.
 * For a transportable package pass `transport_request` (added as `?corrNr=`), like
 * domain/class create; local packages send no corrNr.
 */
async function createMessageClass(connection, params) {
    // Emit BOTH adtcore:language and adtcore:masterLanguage (like domain/class),
    // both set to the resolved language.
    const lang = params.master_language ?? 'EN';
    const xmlBody = (0, xml_1.buildMessageClassXml)({
        name: params.name.toUpperCase(),
        description: params.description,
        packageName: params.package_name.toUpperCase(),
        language: lang,
        masterLanguage: lang,
        messages: [],
    });
    const corrNrParam = params.transport_request?.trim()
        ? `?corrNr=${encodeURIComponent(params.transport_request)}`
        : '';
    return connection.makeAdtRequest({
        url: `${BASE}${corrNrParam}`,
        method: 'POST',
        timeout: (0, timeouts_1.getTimeout)('default'),
        data: xmlBody,
        headers: {
            'Content-Type': 'application/xml',
        },
    });
}
