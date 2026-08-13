"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBatchBoundary = createBatchBoundary;
exports.createRequestId = createRequestId;
exports.serializeParams = serializeParams;
exports.buildInnerRequest = buildInnerRequest;
exports.buildBatchPayload = buildBatchPayload;
function createBatchBoundary() {
    const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    return `batch_${randomPart}`;
}
function createRequestId() {
    const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replace(/-/g, '')
        : `${Date.now()}${Math.random().toString(16).slice(2)}`;
    return randomPart.slice(0, 32);
}
function serializeParams(params) {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
    if (entries.length === 0)
        return '';
    return `?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`;
}
function buildInnerRequest(part) {
    const queryString = part.params ? serializeParams(part.params) : '';
    const requestLine = `${part.method} ${part.url}${queryString} HTTP/1.1`;
    const headerEntries = Object.entries(part.headers);
    const headerSection = headerEntries.length > 0
        ? `\r\n${headerEntries.map(([key, value]) => `${key}:${value}`).join('\r\n')}`
        : '';
    // HTTP format: request-line [CRLF headers] CRLF CRLF [body]
    if (part.data) {
        return `${requestLine}${headerSection}\r\n\r\n${part.data}`;
    }
    return `${requestLine}${headerSection}\r\n\r\n`;
}
function buildBatchPayload(parts, boundary = createBatchBoundary()) {
    if (!parts.length) {
        throw new Error('At least one batch request is required');
    }
    const multipartParts = parts
        .map((part) => {
        const innerRequest = buildInnerRequest(part);
        return [
            `--${boundary}`,
            'Content-Type: application/http',
            'content-transfer-encoding: binary',
            '',
            innerRequest,
        ].join('\r\n');
    })
        .join('\r\n');
    return {
        boundary,
        body: `${multipartParts}\r\n--${boundary}--\r\n`,
    };
}
