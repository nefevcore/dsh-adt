/**
 * Minimal, dependency-free XML parser tuned for ADT protocol payloads.
 *
 * ADT responses are small, namespace-heavy XML documents without DTDs or
 * exotic entities. This parser produces a simple element tree:
 *
 * ```ts
 * interface XmlNode {
 *   name: string            // local name (namespace prefix stripped)
 *   attributes: Record<string, string>
 *   children: XmlNode[]
 *   text: string            // concatenated character data (trimmed)
 * }
 * ```
 *
 * Namespaces are ignored structurally (local names only); attributes keep
 * their full prefixed names so callers can match `{http://...}name` or `name`.
 */
const ENTITIES = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
};
class XmlParser {
    input;
    pos = 0;
    constructor(input) {
        this.input = input;
    }
    parse() {
        this.skipMisc();
        const node = this.parseElement();
        this.skipMisc();
        return node;
    }
    skipMisc() {
        while (this.pos < this.input.length) {
            if (/\s/.test(this.input[this.pos])) {
                this.pos++;
            }
            else if (this.input.startsWith('<?', this.pos)) {
                this.skipUntil('?>');
            }
            else if (this.input.startsWith('<!--', this.pos)) {
                this.skipUntil('-->');
            }
            else if (this.input.startsWith('<!DOCTYPE', this.pos)) {
                // Consume until the matching '>' honoring internal subset brackets.
                const start = this.pos;
                this.pos += 9;
                let depth = 0;
                while (this.pos < this.input.length) {
                    const c = this.input[this.pos];
                    if (c === '[')
                        depth++;
                    else if (c === ']')
                        depth--;
                    else if (c === '>' && depth <= 0) {
                        this.pos++;
                        break;
                    }
                    this.pos++;
                }
                if (this.pos === this.input.length && !this.input.startsWith('>', start)) {
                    throw new Error('XML: unterminated DOCTYPE');
                }
            }
            else {
                break;
            }
        }
    }
    parseElement() {
        if (this.input[this.pos] !== '<') {
            throw new Error(`XML: expected '<' at ${this.pos}`);
        }
        this.pos++; // consume '<'
        if (this.input[this.pos] === '/') {
            throw new Error(`XML: unexpected closing tag at ${this.pos}`);
        }
        const rawName = this.readName();
        if (!rawName)
            throw new Error(`XML: empty tag name at ${this.pos}`);
        // Local name: strip the namespace prefix (`adt:object` → `object`).
        const name = rawName.includes(':') ? rawName.slice(rawName.lastIndexOf(':') + 1) : rawName;
        const node = { name, attributes: {}, children: [], text: '' };
        // Attributes
        for (;;) {
            this.skipWs();
            if (this.pos >= this.input.length)
                throw new Error('XML: unterminated tag');
            const c = this.input[this.pos];
            if (c === '>') {
                this.pos++;
                break;
            }
            if (c === '/') {
                if (this.input[this.pos + 1] !== '>')
                    throw new Error('XML: malformed self-closing tag');
                this.pos += 2;
                return node;
            }
            const attrName = this.readName();
            if (!attrName)
                throw new Error(`XML: malformed attribute at ${this.pos}`);
            this.skipWs();
            if (this.input[this.pos] !== '=')
                throw new Error(`XML: expected '=' after attribute ${attrName}`);
            this.pos++;
            this.skipWs();
            const quote = this.input[this.pos];
            if (quote !== '"' && quote !== "'")
                throw new Error('XML: expected quoted attribute value');
            this.pos++;
            const value = this.readUntil(quote);
            node.attributes[attrName] = this.decode(value);
        }
        // Content
        const textParts = [];
        for (;;) {
            if (this.pos >= this.input.length)
                throw new Error(`XML: unterminated element <${name}>`);
            if (this.input[this.pos] === '<') {
                if (this.input.startsWith('</', this.pos)) {
                    this.pos += 2;
                    const closeRaw = this.readName();
                    const closeName = closeRaw.includes(':') ? closeRaw.slice(closeRaw.lastIndexOf(':') + 1) : closeRaw;
                    this.skipWs();
                    if (this.input[this.pos] !== '>')
                        throw new Error('XML: malformed closing tag');
                    this.pos++;
                    if (closeName !== name) {
                        throw new Error(`XML: mismatched closing tag </${closeRaw}> for <${name}>`);
                    }
                    node.text = this.decode(textParts.join('')).trim();
                    return node;
                }
                if (this.input.startsWith('<!--', this.pos)) {
                    this.skipUntil('-->');
                    continue;
                }
                if (this.input.startsWith('<![CDATA[', this.pos)) {
                    this.pos += 9;
                    const end = this.input.indexOf(']]>', this.pos);
                    if (end < 0)
                        throw new Error('XML: unterminated CDATA');
                    textParts.push(this.input.slice(this.pos, end));
                    this.pos = end + 3;
                    continue;
                }
                node.children.push(this.parseElement());
                continue;
            }
            const next = this.input.indexOf('<', this.pos);
            if (next < 0)
                throw new Error('XML: unterminated element');
            textParts.push(this.input.slice(this.pos, next));
            this.pos = next;
        }
    }
    readName() {
        const start = this.pos;
        while (this.pos < this.input.length && /[A-Za-z0-9_:.\-]/.test(this.input[this.pos])) {
            this.pos++;
        }
        return this.input.slice(start, this.pos);
    }
    readUntil(stop) {
        const start = this.pos;
        const end = this.input.indexOf(stop, this.pos);
        if (end < 0)
            throw new Error(`XML: unterminated quoted value (missing '${stop}')`);
        this.pos = end + 1;
        return this.input.slice(start, end);
    }
    skipUntil(marker) {
        const end = this.input.indexOf(marker, this.pos);
        if (end < 0)
            throw new Error(`XML: unterminated ${marker}`);
        this.pos = end + marker.length;
    }
    skipWs() {
        while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
            this.pos++;
        }
    }
    decode(value) {
        return value.replace(/&(#x?[0-9A-Fa-f]+|[A-Za-z]+);/g, (full, entity) => {
            if (entity.startsWith('#x') || entity.startsWith('#X')) {
                return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
            }
            if (entity.startsWith('#')) {
                return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
            }
            return ENTITIES[entity] ?? full;
        });
    }
}
/** Parse an XML string into a node tree. */
export function parseXml(input) {
    return new XmlParser(input).parse();
}
/** First child with the given local name (namespace prefix ignored). */
export function child(node, name) {
    return node.children.find((c) => c.name === name || c.name.endsWith(`:${name}`));
}
/** All children with the given local name. */
export function children(node, name) {
    return node.children.filter((c) => c.name === name || c.name.endsWith(`:${name}`));
}
/** Text content of the first child with the given local name, trimmed. */
export function childText(node, name) {
    const c = child(node, name);
    return c ? c.text : undefined;
}
/** Attribute value by local name (matches `name` or `prefix:name`). */
export function attr(node, name) {
    const direct = node.attributes[name];
    if (direct !== undefined)
        return direct;
    for (const [key, value] of Object.entries(node.attributes)) {
        if (key.endsWith(`:${name}`))
            return value;
    }
    return undefined;
}
//# sourceMappingURL=xml.js.map