/**
 * XML patch utilities for the read-modify-write update pattern.
 *
 * Instead of building XML from scratch (which loses unknown fields like
 * abapLanguageVersion), these helpers modify specific values in the original
 * XML string obtained from GET.
 *
 * **Every patch here fails loudly when it cannot find its target.** That is the
 * point of this module's error handling, and it was learned from a live
 * failure: a full test run reported
 *
 * ```
 * update FAILED (HTTP 400): The description is missing for ZAC_DOM01
 * ```
 *
 * on a domain whose description was present in the configuration all along. The
 * chain was:
 *
 * 1. the GET came back slow, or the object was not yet ready — ADT answers such
 *    reads with **200 and an empty body**, never a 404, so nothing upstream had
 *    a status to react to;
 * 2. `patchXmlAttribute` was asked to set `adtcore:description` and found no
 *    attribute to replace. Being `String.replace`, it returned the input
 *    unchanged — silently;
 * 3. the PUT went out without a description, and the server rejected it.
 *
 * The ABAP system's varying response time is the trigger, and nothing here can
 * change that. What these helpers control is what a slow read turns into: a
 * read error naming the object, or a malformed write blamed on the server. It
 * used to be the second.
 */
/** Raised when a patch cannot find what it was asked to change. */
export declare class XmlPatchError extends Error {
    constructor(message: string);
}
/**
 * Replace an XML attribute value.
 * Example: `adtcore:description="old"` → `adtcore:description="new"`
 *
 * @throws {XmlPatchError} when the attribute is absent
 */
export declare function patchXmlAttribute(xml: string, attrName: string, newValue: string): string;
/**
 * Replace XML element text content.
 * Handles both `<tag>content</tag>` and self-closing `<tag/>`.
 *
 * @throws {XmlPatchError} when the element is absent
 */
export declare function patchXmlElement(xml: string, tagName: string, newValue: string): string;
/**
 * Set an XML attribute on a specific element.
 * Example: `<pak:superPackage adtcore:name="OLD"/>` → `<pak:superPackage adtcore:name="NEW"/>`
 *
 * Unlike the other patches this one **adds** the attribute when the element is
 * there without it, because that is a state ADT genuinely produces for an unset
 * reference — probed on a live system:
 *
 * ```
 * <doma:valueTableRef/>    a domain with no value table
 * <pak:superPackage/>      a package with no parent
 * ```
 *
 * Refusing those would forbid ever setting a value table or a super package for
 * the first time. Only a missing *element* means the XML is not what the caller
 * thinks it is, and only that throws.
 *
 * @throws {XmlPatchError} when the element itself is absent
 */
export declare function patchXmlElementAttribute(xml: string, elementTag: string, attrName: string, newValue: string): string;
/**
 * Replace an entire XML block (from opening to closing tag) with new content.
 * Handles both `<tag>...</tag>` (including nested content) and self-closing `<tag/>`.
 *
 * @throws {XmlPatchError} when the block is absent
 */
export declare function patchXmlBlock(xml: string, tagName: string, newContent: string): string;
/**
 * Conditionally apply a patch only if value is defined.
 */
export declare function patchIf<T>(xml: string, value: T | undefined | null, patchFn: (xml: string, val: T) => string): string;
/**
 * Take the XML out of a response, refusing anything that cannot be patched.
 *
 * This used to `JSON.stringify` a non-string body and hand back the result,
 * which is not XML and matches no patch — turning a bad read into a bad write
 * one step earlier than the patches did. An empty body passed through just as
 * quietly, and an empty body is exactly what ADT returns for an object that is
 * not ready yet.
 *
 * @param what object being read, named in the error (e.g. `'domain ZAC_DOM01'`)
 * @throws {XmlPatchError} when the body is not usable XML
 */
export declare function extractXmlString(data: unknown, what?: string): string;
//# sourceMappingURL=xmlPatch.d.ts.map