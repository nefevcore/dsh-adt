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
export interface XmlNode {
    name: string;
    attributes: Record<string, string>;
    children: XmlNode[];
    text: string;
}
/** Parse an XML string into a node tree. */
export declare function parseXml(input: string): XmlNode;
/** First child with the given local name (namespace prefix ignored). */
export declare function child(node: XmlNode, name: string): XmlNode | undefined;
/** All children with the given local name. */
export declare function children(node: XmlNode, name: string): XmlNode[];
/** Text content of the first child with the given local name, trimmed. */
export declare function childText(node: XmlNode, name: string): string | undefined;
/** Attribute value by local name (matches `name` or `prefix:name`). */
export declare function attr(node: XmlNode, name: string): string | undefined;
//# sourceMappingURL=xml.d.ts.map