import type { AdtClient, AdtObjectRef } from '@nefevcore/abap-adt-protocol';
import type { AdtRegistry, RegistryDestination } from '../registry.js';
import type { LockLedger } from '../locks.js';
/** Parameter spec for the destination selector used by every tool. */
export declare const DESTINATION_PARAM: {
    readonly destination: {
        readonly type: "string";
        readonly description: "Destination name (configured in the plugin config). Omit to use the default destination.";
    };
};
/**
 * Shared `objectUri` / `name` / `type` parameter specs. Every tool that takes
 * an existing object by reference spreads these into its `parameters`.
 */
export declare const OBJECT_REF_PARAMS: {
    readonly objectUri: {
        readonly type: "string";
        readonly description: "Exact ADT object URI (from search/read results), e.g. /sap/bc/adt/oo/classes/zcl_demo.";
    };
    readonly name: {
        readonly type: "string";
        readonly description: "Object name, e.g. ZCL_DEMO.";
    };
    readonly type: {
        readonly type: "string";
        readonly description: "Object type (short or ADT form), e.g. CLAS, INTF, PROG, DDLS.";
    };
};
/** Optional package hint used by the permission check of mutating tools. */
export declare const PACKAGE_HINT_PARAM: {
    readonly packageName: {
        readonly type: "string";
        readonly description: string;
    };
};
/**
 * Shared `objects` array parameter for tools that process an object list
 * (activate, check, unit tests, ATC). Each entry is `{objectUri}` or
 * `{name, type}` — `name` is optional so a bare `objectUri` validates too.
 * Entries may carry `packageName` as a permission-check hint.
 * Bounded at MAX_OBJECT_LIST entries per call (audit P3).
 */
export declare const MAX_OBJECT_LIST = 50;
export declare const OBJECTS_PARAM: {
    readonly objects: {
        readonly type: "array";
        readonly required: true;
        readonly description: string;
        readonly items: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
                readonly objectUri: {
                    readonly type: "string";
                    readonly description: "Exact ADT object URI.";
                };
                readonly name: {
                    readonly type: "string";
                    readonly description: "Object name (required unless objectUri is given).";
                };
                readonly type: {
                    readonly type: "string";
                    readonly description: "Object type, e.g. CLAS, PROG, DDLS.";
                };
                readonly packageName: {
                    readonly type: "string";
                    readonly description: "Optional package hint for the permission check (fallback only; backend-reported package wins).";
                };
            };
        };
    };
};
/**
 * Validate a shared `objects` argument before fan-out (audit P3): an empty
 * list used to pass `required` and silently do nothing, and the list length
 * was unbounded — every entry fans out into backend requests.
 */
export declare function requireObjectList(args: Record<string, unknown>, toolName: string, max?: number): Array<Record<string, unknown>>;
/**
 * Shared `objects` array parameter for tools that accept an explicit object
 * set as the alternative to `packageName` (export, release gate).
 */
export declare const NAME_TYPE_OBJECTS_PARAM: {
    readonly objects: {
        readonly type: "array";
        readonly description: "Alternative: explicit objects to process. Each: {name, type}.";
        readonly items: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
                readonly name: {
                    readonly type: "string";
                    readonly required: true;
                };
                readonly type: {
                    readonly type: "string";
                };
            };
        };
    };
};
/** Pull the destination param value out of raw args. */
export declare function destinationOf(args: Record<string, unknown>): string | undefined;
/** A raw arg as a non-empty string, else `undefined`. */
export declare function optStr(value: unknown): string | undefined;
/** Extract the `objectUri`/`name`/`type` reference args of a tool call. */
export declare function objectRefArgs(args: Record<string, unknown>): {
    objectUri?: string;
    name?: string;
    type?: string;
};
/**
 * Resolve the object a tool call refers to: `objectUri` wins, otherwise
 * `name` (+ optional `type`) via search with exact-match preference.
 * Mutating tools pass `{ strict: true }` — a near-miss name with only fuzzy
 * search hits is then an error (listing the candidates) instead of silently
 * resolving to a different object (audit H2).
 */
export declare function resolveToolObject(client: AdtClient, args: Record<string, unknown>, signal?: AbortSignal, options?: {
    strict?: boolean;
    toolName?: string;
}): Promise<AdtObjectRef>;
/**
 * Fail-closed permission gate for tools that modify an existing object
 * (write / edit / delete / activate): resolve the object's package (exact
 * backend search hit first; the caller's hint is only a fallback when the
 * backend exposes nothing) and assert the edit policy of the DESTINATION
 * the call targets. An undeterminable package is DENIED with an
 * AdtPolicyError naming the rule. Returns the resolved package name.
 */
export declare function assertObjectEditable(destination: RegistryDestination, ref: AdtObjectRef, options: {
    toolName: string;
    packageHint?: string;
    signal?: AbortSignal;
}): Promise<string>;
/**
 * Clamp helper that never goes silent: returns the clamped value plus a note
 * describing the adjustment (empty when the request was within bounds), so
 * tools can surface the clamping in their output.
 */
export declare function clampWithNote(requested: number, min: number, max: number, label: string): {
    value: number;
    note?: string;
};
/** Register-time helper: name a tool and give it the registry. */
export interface ToolDeps {
    /**
     * Destination registry. Read `registry.policy` at call time (NOT
     * destructured away): settings hot reload swaps the policy in place and a
     * captured reference would keep asserting against the stale one.
     */
    registry: AdtRegistry;
    /** Persistent lock ledger (see src/locks.ts). */
    ledger: LockLedger;
}
/** Render a simple text block. */
export declare function text(content: string): Array<{
    type: 'text';
    text: string;
}>;
/**
 * Deep-strip `undefined` values so tool outputs pass the DSH lossless-JSON
 * boundary (the registry rejects any object property whose value is
 * `undefined`, because JSON has no representation for it). `null` is kept.
 */
export declare function deepCompact(value: unknown): unknown;
/** Render an object list as a compact table. */
export declare function renderObjectRefs(refs: AdtObjectRef[]): string;
/** A terse success renderer shared by lifecycle tools. */
export declare function renderMessages(title: string, lines: string[]): string;
//# sourceMappingURL=common.d.ts.map