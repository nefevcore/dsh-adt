"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeXmlAttr = escapeXmlAttr;
/**
 * Escape a value for safe interpolation into an XML attribute.
 * Covers all five attribute metacharacters (the existing per-module
 * escapers omit the apostrophe; this shared helper does not).
 */
function escapeXmlAttr(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
