import type { AdtClient, AdtObjectRef } from '@nefevcore/abap-adt-protocol';
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
 * Options controlling how a model-supplied reference is resolved.
 */
interface ResolveOptions {
    maxResults?: number;
    signal?: AbortSignal;
    /**
     * Strict resolution for MUTATING tools (write/edit/delete/push/activate/
     * write_structure): without an explicit `objectUri`, a name that has no
     * EXACT search match is an error listing the top candidates — never a
     * silent fuzzy fallback onto a DIFFERENT object (which would then be
     * modified without a local snapshot, so the OCC conflict protection would
     * not apply either). Read-only tools keep the lenient fallback.
     */
    strict?: boolean;
    /** Tool name used to prefix strict-mode error messages. */
    toolName?: string;
}
/**
 * Resolve a model-supplied object reference to a concrete ADT object:
 *   - `objectUri` wins when given (must start with `/sap/bc/adt`).
 *   - otherwise `name` (+ optional `type`) is resolved: PROG-family types
 *     (PROG vs INCL) share one namespace but live under DIFFERENT URI
 *     prefixes (/programs/programs vs /programs/includes) — a bare name is
 *     resolved via an exact-name search so an include passed as type=PROG
 *     lands on its real URI instead of a 404. All other known types use the
 *     by-convention URI; unknown types fall back to search.
 */
export declare function resolveObject(client: AdtClient, input: {
    objectUri?: string;
    name?: string;
    type?: string;
}, options?: ResolveOptions): Promise<AdtObjectRef>;
/** Resolve a list of refs; one bad entry fails the whole call loudly. */
export declare function resolveObjects(client: AdtClient, inputs: Array<{
    objectUri?: string;
    name?: string;
    type?: string;
}>, signal?: AbortSignal, options?: {
    strict?: boolean;
    toolName?: string;
}): Promise<AdtObjectRef[]>;
/**
 * Best-effort package lookup for an existing object, used by the permission
 * policy before write/delete/activate. Order matters for security:
 *   1. an exact-name search hit carrying `packageName` (backend FACT) wins;
 *   2. the caller's `hint` is only a fallback for when the backend exposes
 *      nothing — never an override, or a policy-constrained agent could
 *      whitelist any object by claiming a friendly package (audit H1);
 *   3. `undefined` when neither is available — callers must fail closed
 *      (deny) in that case.
 * A FUZZY hit's package is deliberately not used: it describes a different
 * object and would misattribute the policy check.
 */
export declare function resolvePackageName(client: AdtClient, ref: AdtObjectRef, hint?: string, signal?: AbortSignal): Promise<string | undefined>;
/** Human-readable label for an object type code (best effort). */
export declare function typeLabel(type: string): string;
export {};
//# sourceMappingURL=resolve.d.ts.map