import type { AdtClient, AdtObjectRef } from '@abap-adt/protocol';
/**
 * Type → ADT object-type + URI-prefix mapping for the object types the tools
 * support directly. Short forms ("CLAS") and full forms ("CLAS/OC") both work.
 */
export declare const TYPE_MAP: Record<string, {
    type: string;
    uriPrefix: string;
    label: string;
}>;
export declare function normalizeType(type: string | undefined): {
    type: string;
    uriPrefix: string;
    label: string;
};
/** Build an object reference from name + type (URI constructed by convention). */
export declare function refFromName(name: string, type?: string): AdtObjectRef;
/**
 * Resolve a model-supplied object reference to a concrete ADT object:
 *   - `objectUri` wins when given (must start with `/sap/bc/adt`).
 *   - otherwise `name` (+ optional `type`) is resolved by search, preferring
 *     an exact name match; falls back to the by-convention URI.
 */
export declare function resolveObject(client: AdtClient, input: {
    objectUri?: string;
    name?: string;
    type?: string;
}, maxResults?: number): Promise<AdtObjectRef>;
/** Resolve a list of refs; one bad entry fails the whole call loudly. */
export declare function resolveObjects(client: AdtClient, inputs: Array<{
    objectUri?: string;
    name?: string;
    type?: string;
}>): Promise<AdtObjectRef[]>;
/** Human-readable label for an object type code (best effort). */
export declare function typeLabel(type: string): string;
//# sourceMappingURL=resolve.d.ts.map