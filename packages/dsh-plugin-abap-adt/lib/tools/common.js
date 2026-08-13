/** Parameter spec for the destination selector used by every tool. */
export const DESTINATION_PARAM = {
    destination: {
        type: 'string',
        description: 'Destination name (configured in the plugin config). Omit to use the default destination.',
    },
};
/** Pull the destination param value out of raw args. */
export function destinationOf(args) {
    const value = args['destination'];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}
/** Render a simple text block. */
export function text(content) {
    return [{ type: 'text', text: content }];
}
/**
 * Deep-strip `undefined` values so tool outputs pass the DSH lossless-JSON
 * boundary (the registry rejects any object property whose value is
 * `undefined`, because JSON has no representation for it). `null` is kept.
 */
export function deepCompact(value) {
    if (Array.isArray(value)) {
        const out = [];
        for (const item of value) {
            const cleaned = deepCompact(item);
            if (cleaned !== undefined)
                out.push(cleaned);
        }
        return out;
    }
    if (value !== null && typeof value === 'object') {
        const out = {};
        for (const [key, item] of Object.entries(value)) {
            const cleaned = deepCompact(item);
            if (cleaned !== undefined)
                out[key] = cleaned;
        }
        return out;
    }
    return value;
}
/** Render an object list as a compact table. */
export function renderObjectRefs(refs) {
    if (refs.length === 0)
        return '(no objects)';
    const rows = refs.map((r) => `- ${r.name} (${r.type}) — ${r.uri}`);
    return rows.join('\n');
}
/** A terse success renderer shared by lifecycle tools. */
export function renderMessages(title, lines) {
    const body = lines.length ? lines.join('\n') : '(no messages)';
    return `${title}\n${body}`;
}
//# sourceMappingURL=common.js.map