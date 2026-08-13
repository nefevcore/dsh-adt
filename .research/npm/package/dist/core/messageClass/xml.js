"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMessageClass = parseMessageClass;
exports.buildMessageClassXml = buildMessageClassXml;
const fast_xml_parser_1 = require("fast-xml-parser");
const parser = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
    parseTagValue: false,
});
// Collect attributes, dropping ONLY the namespace declarations the builder
// re-emits from its own template (xmlns:mc, xmlns:adtcore) — keeping those would
// duplicate them and produce invalid XML. Any OTHER xmlns:* (an unknown/future
// prefix SAP may add, e.g. xmlns:foo) MUST be preserved so its prefixed
// attributes (foo:bar) stay bound on round-trip.
const TEMPLATE_NS = new Set(['@_xmlns:mc', '@_xmlns:adtcore']);
const A = (o) => {
    const out = {};
    for (const [k, v] of Object.entries(o))
        if (k.startsWith('@_') && !TEMPLATE_NS.has(k))
            out[k.slice(2)] = String(v);
    return out;
};
function parseMessageClass(xml) {
    const root = parser.parse(xml);
    const mc = root['mc:messageClass'] ?? root.messageClass ?? {};
    const attrs = A(mc);
    const pkgRef = mc['adtcore:packageRef'] ?? mc.packageRef ?? {};
    const rawMsgs = mc['mc:messages'] ?? mc.messages;
    const list = Array.isArray(rawMsgs) ? rawMsgs : rawMsgs ? [rawMsgs] : [];
    const messages = list.map((m) => {
        const ma = A(m);
        return {
            msgno: ma['mc:msgno'] ?? '',
            msgtext: ma['mc:msgtext'] ?? '',
            selfExplanatory: ma['mc:selfexplainatory']
                ? ma['mc:selfexplainatory'] === 'true'
                : undefined,
            description: ma['adtcore:description'] || undefined,
            rawAttrs: ma,
        };
    });
    return {
        name: attrs['adtcore:name'] ?? '',
        description: attrs['adtcore:description'] || undefined,
        language: attrs['adtcore:language'] || undefined,
        masterLanguage: attrs['adtcore:masterLanguage'] || undefined,
        masterSystem: attrs['adtcore:masterSystem'] || undefined,
        responsible: attrs['adtcore:responsible'] || undefined,
        packageName: A(pkgRef)['adtcore:name'] || undefined,
        messages,
        rawAttrs: attrs,
    };
}
const esc = (s) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
/** Merge rawAttrs with named-field overrides into an attribute string. */
function attrString(raw, overrides) {
    const merged = { ...(raw ?? {}) };
    for (const [k, v] of Object.entries(overrides))
        if (v !== undefined)
            merged[k] = v;
    return Object.entries(merged)
        .map(([k, v]) => `${k}="${esc(v)}"`)
        .join(' ');
}
function buildMessageClassXml(cls, opts) {
    const locks = opts?.messageLockHandles ?? {};
    const deleted = new Set(opts?.deletedMsgnos ?? []);
    const rootAttrs = attrString(cls.rawAttrs, {
        'adtcore:name': cls.name,
        'adtcore:description': cls.description,
        'adtcore:language': cls.language,
        'adtcore:masterLanguage': cls.masterLanguage,
        'adtcore:masterSystem': cls.masterSystem,
        'adtcore:responsible': cls.responsible,
        'adtcore:type': 'MSAG/N',
    });
    const pkg = cls.packageName
        ? `<adtcore:packageRef adtcore:name="${esc(cls.packageName)}"/>`
        : '';
    const msgs = cls.messages
        .map((m) => {
        const attrs = attrString(m.rawAttrs, {
            'mc:msgno': m.msgno,
            'mc:msgtext': m.msgtext,
            'mc:selfexplainatory': m.selfExplanatory === undefined
                ? undefined
                : String(m.selfExplanatory),
            'adtcore:description': m.description,
            'mc:lockhandle': locks[m.msgno],
        });
        // Messages flagged for deletion are emitted as <mc:deletedmessages> carrying
        // their lock handle; SAP uses this element to identify and remove them on PUT.
        // All other messages stay as <mc:messages> so they are preserved (upserted).
        if (deleted.has(m.msgno)) {
            return `<mc:deletedmessages ${attrs}/>`;
        }
        return `<mc:messages ${attrs}/>`;
    })
        .join('');
    return `<?xml version="1.0" encoding="UTF-8"?><mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core" ${rootAttrs}>${pkg}${msgs}</mc:messageClass>`;
}
