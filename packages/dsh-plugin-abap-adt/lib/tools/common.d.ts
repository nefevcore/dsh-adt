import { AdtError, type AdtClient, type AdtObjectRef } from '@nefevcore/abap-adt-protocol';
import type { AdtRegistry, RegistryDestination } from '../registry.js';
import type { LockLedger } from '../locks.js';
import type { AdtPolicy } from '../policy.js';
/**
 * Policy pre-check for an explicitly-passed transport (shared by every tool
 * that accepts one): no transport → no check; otherwise the transport family
 * must be enabled and the exact number allowed. `objectName` (when given) is
 * included in the denial context to identify the object involved.
 */
export declare function assertExplicitTransport(policy: AdtPolicy, transport: string | undefined, toolName: string, objectName?: string): void;
/**
 * Does this error mean "the backend profile does not expose the service"
 * (404/405 on the service endpoint)? A type predicate: inside the branch
 * `error` is narrowed to AdtError, so remedies can cite `error.status`.
 * Tools re-throw with their own remedy message when this is true — the
 * statuses alone are the shared fact.
 */
export declare function isAdtServiceUnavailable(error: unknown): error is AdtError;
/** One ATC finding as the tools report it (mapped from the protocol shape). */
export interface AtcFindingOutput {
    checkTitle: string;
    severity: string;
    message: string;
    objectName: string;
    uri?: string;
    line?: number;
    check?: string;
}
/** `findings` array schema shared by the ATC-reporting tools. */
export declare const ATC_FINDINGS_SCHEMA: {
    readonly type: "array";
    readonly required: true;
    readonly items: {
        readonly type: "object";
        readonly additionalProperties: false;
        readonly properties: {
            readonly checkTitle: {
                readonly type: "string";
                readonly required: true;
            };
            readonly severity: {
                readonly type: "string";
                readonly required: true;
            };
            readonly message: {
                readonly type: "string";
                readonly required: true;
            };
            readonly objectName: {
                readonly type: "string";
                readonly required: true;
            };
            readonly uri: {
                readonly type: "string";
                readonly description: "URI of the object the `line` refers to (often an include while objectName is the main program).";
            };
            readonly line: {
                readonly type: "integer";
            };
            readonly check: {
                readonly type: "string";
            };
        };
    };
};
/** Severity-counts schema shared by the ATC-reporting tools. */
export declare const ATC_COUNTS_SCHEMA: {
    readonly type: "object";
    readonly required: true;
    readonly additionalProperties: false;
    readonly properties: {
        readonly INFO: {
            readonly type: "integer";
            readonly required: true;
        };
        readonly WARNING: {
            readonly type: "integer";
            readonly required: true;
        };
        readonly ERROR: {
            readonly type: "integer";
            readonly required: true;
        };
        readonly CRITICAL: {
            readonly type: "integer";
            readonly required: true;
        };
        readonly CATASTROPHIC: {
            readonly type: "integer";
            readonly required: true;
        };
    };
};
/** P1–P4 aggregates schema shared by the ATC tools (list/run/result). */
export declare const ATC_AGGREGATES_SCHEMA: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly properties: {
        readonly priority1: {
            readonly type: "integer";
            readonly required: true;
        };
        readonly priority2: {
            readonly type: "integer";
            readonly required: true;
        };
        readonly priority3: {
            readonly type: "integer";
            readonly required: true;
        };
        readonly priority4: {
            readonly type: "integer";
            readonly required: true;
        };
        readonly failures: {
            readonly type: "integer";
            readonly required: true;
        };
    };
};
/** Map a protocol ATC finding to the tools' output shape. */
export declare function atcFindingOutput(f: {
    checkTitle: string;
    severity: string;
    message: string;
    objectName: string;
    locationUri?: string;
    uri?: string;
    line?: number;
    check?: string;
}): AtcFindingOutput;
/**
 * Render ATC findings, making the include↔line mapping visible: backends
 * often report findings under the MAIN program name while `line` counts in
 * the INCLUDE — when the finding's URI names a different object, say so.
 */
export declare function renderAtcFindings(findings: AtcFindingOutput[]): string[];
/** Render the P1–P4 aggregates suffix (empty when no aggregates are present). */
export declare function atcAggregatesSuffix(aggregates?: {
    priority1: number;
    priority2: number;
    priority3: number;
    priority4: number;
}): string;
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
/** Version-feed entry metadata shared by adt_object_versions and
 *  adt_version_diff (each appends its own tail field). */
export declare const VERSION_FEED_META_PROPERTIES: {
    readonly versionId: {
        readonly type: "string";
        readonly required: true;
    };
    readonly author: {
        readonly type: "string";
    };
    readonly updatedAt: {
        readonly type: "string";
    };
    readonly title: {
        readonly type: "string";
    };
    readonly transportRequest: {
        readonly type: "string";
    };
};
/** Pull the destination param value out of raw args. */
export declare function destinationOf(args: Record<string, unknown>): string | undefined;
/**
 * The session workspace directory of a tool execution
 * (`exec.agent.session.header.cwd` — the same seam dsh-tool-fs/bash/pwsh
 * use), falling back to undefined. Workspace-layer destination resolution
 * (see registry.ts `viewFor`) keys off this, so `adt_*` calls see the
 * `<cwd>/.dsh-abap-adt/destinations.yaml` of the session that made them.
 */
export declare function sessionCwd(exec: unknown): string | undefined;
/** A raw arg as a non-empty string, else `undefined`. */
export declare function optStr(value: unknown): string | undefined;
/** A raw arg TRIMMED to a non-empty value, else `undefined` — for user-typed
 *  free text (transport numbers, queries) where stray whitespace is noise.
 *  Unlike {@link optStr}, which does not trim. */
export declare function trimmedArgStr(value: unknown): string | undefined;
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
/**
 * The sentence every capped answer owes its reader when the TOTAL is known:
 * name the parameter that lifts the cap, by its real name. A bounded answer
 * that does not say it was bounded reads as a clean verdict over a list read
 * in part.
 */
export declare function showingOfTotal(shown: number, total: number, param: string): string;
/**
 * The capped-answer sentence when counting the rest would cost another
 * request: promise less, deliberately — an invented total is worse than an
 * admitted one. `narrower` names how to ask a smaller question (a narrower
 * pattern, a shorter time window, a package filter…).
 */
export declare function showingUnknownTotal(shown: number, param: string, narrower: string): string;
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
//# sourceMappingURL=common.d.ts.map