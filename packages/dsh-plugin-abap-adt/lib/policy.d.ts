/**
 * ADT permission policy ("权限管控") — the guard rails applied to every
 * mutating tool of the plugin.
 *
 * Six independent knobs, each resolvable from three sources (in order):
 *
 *   1. explicit plugin config (`cordis.patch.yml` → `config:` block)
 *   2. a `SAP_*` environment variable
 *   3. a built-in default
 *
 * | knob                        | config key                | env var                       | default |
 * |-----------------------------|---------------------------|-------------------------------|---------|
 * | transport tool family       | `enableTransports`        | `SAP_ENABLE_TRANSPORTS`       | `true`  |
 * | allowed transport numbers   | `allowedTransports`       | `SAP_ALLOWED_TRANSPORTS`      | `*`     |
 * | edits in transport packages | `allowTransportableEdits` | `SAP_ALLOW_TRANSPORTABLE_EDITS`| `true`  |
 * | allowed development package | `allowedPackages`         | `SAP_ALLOWED_PACKAGES`        | `*`     |
 * | program/class execution     | `allowExecution`          | `SAP_ALLOW_EXECUTION`         | `true`  |
 * | write parts in adt_batch    | `allowBatchWrites`        | `SAP_ALLOW_BATCH_WRITES`      | `false` |
 *
 * Pattern lists (`allowedTransports`, `allowedPackages`) are comma-separated
 * globs: `*` matches any sequence, `?` any single char; matching is
 * case-insensitive. `*` alone (or an empty/omitted value) allows everything.
 * `$TMP` is the SAP "Local Objects" package (no transport involved).
 *
 * Semantics:
 *  - `enableTransports=false`  → every transport-family tool (`adt_list_*`,
 *    `adt_get_*`, `adt_release_transport`) and every explicit `transport`
 *    argument is denied; edits of transportable (non-$TMP) packages are also
 *    denied, because they implicitly create transport content.
 *  - `allowedTransports`       → the only transport request numbers the agent
 *    may reference explicitly **or** that the backend may auto-assign on
 *    lock. Any other number aborts the operation (write is rolled back by
 *    unlocking).
 *  - `allowTransportableEdits` → `false` restricts edits (write/create/
 *    delete/activate) to `$TMP` objects.
 *  - `allowedPackages`         → whitelist of packages that may be edited;
 *    anything else is denied even when transportable edits are allowed.
 *  - `allowExecution`          → `false` denies `adt_execute` (running a
 *    program/class can change system state arbitrarily — the kill switch for
 *    read-only destinations).
 *  - `allowBatchWrites`        → `adt_batch` is read-only (GET fan-out) by
 *    default; write parts additionally require this knob because a generic
 *    embedded POST/PUT cannot be per-object policy-checked. Dedicated write
 *    tools remain the policy-enforced path.
 *
 * Every denial throws an {@link AdtPolicyError} carrying the rule id, so the
 * agent sees exactly which knob blocked it and how to adapt.
 *
 * The module is intentionally dependency-free (pure logic + `process.env`)
 * so it can be unit-tested without a live SAP system.
 */
/** SAP "Local Objects" package — edits here never touch the transport system. */
export declare const LOCAL_PACKAGE = "$TMP";
/** Environment variable names for the policy knobs. */
export declare const POLICY_ENV: {
    readonly enableTransports: "SAP_ENABLE_TRANSPORTS";
    readonly allowedTransports: "SAP_ALLOWED_TRANSPORTS";
    readonly allowTransportableEdits: "SAP_ALLOW_TRANSPORTABLE_EDITS";
    readonly allowedPackages: "SAP_ALLOWED_PACKAGES";
    readonly allowExecution: "SAP_ALLOW_EXECUTION";
    readonly allowBatchWrites: "SAP_ALLOW_BATCH_WRITES";
};
/** Built-in defaults: permissive for edits/execution, strict for batch writes. */
declare const POLICY_DEFAULTS: {
    readonly enableTransports: true;
    readonly allowedTransports: "*";
    readonly allowTransportableEdits: true;
    readonly allowedPackages: "*";
    readonly allowExecution: true;
    readonly allowBatchWrites: false;
};
/**
 * The six policy knob keys — the canonical list config.ts (known-key
 * validation) and registry.ts (workspace-layer overlay) derive theirs from.
 */
export declare const POLICY_KEYS: PolicyKey[];
/** Raw (pre-resolution) policy values from the plugin config. */
export interface PolicyInputs {
    enableTransports?: boolean;
    allowedTransports?: string;
    allowTransportableEdits?: boolean;
    allowedPackages?: string;
    allowExecution?: boolean;
    allowBatchWrites?: boolean;
}
export type PolicyKey = keyof PolicyInputs;
type PolicySource = 'config' | 'env' | 'default';
/** Thrown when a policy rule denies an operation. */
export declare class AdtPolicyError extends Error {
    /** The knob that blocked the operation (matches PolicyKey). */
    readonly rule: PolicyKey;
    constructor(rule: PolicyKey, message: string);
}
/** Split a comma-separated glob list; empty/omitted means "allow all" (`*`). */
export declare function parsePatterns(list: string | undefined): string[];
/** Does `value` match any of the glob patterns? */
export declare function matchesAny(patterns: string[], value: string): boolean;
/** `$TMP` is the SAP local-objects package (no transport). */
export declare function isLocalPackage(packageName: string): boolean;
/** Parse a boolean env value; `undefined` for unset/empty/invalid input. */
export declare function parseEnvBoolean(value: string | undefined): boolean | undefined;
/** The resolved, enforced policy for one plugin instance. */
export declare class AdtPolicy {
    readonly enableTransports: boolean;
    readonly allowedTransports: string[];
    readonly allowTransportableEdits: boolean;
    readonly allowedPackages: string[];
    readonly allowExecution: boolean;
    readonly allowBatchWrites: boolean;
    /** Where each knob's effective value came from (for `adt_permissions`). */
    readonly sources: Record<PolicyKey, PolicySource>;
    private constructor();
    /**
     * Resolve the effective policy: explicit config > `SAP_*` env var > default.
     * `env` defaults to `process.env`; pass a stub for tests.
     */
    static resolve(config: PolicyInputs, env?: NodeJS.ProcessEnv): AdtPolicy;
    /** Rule: the transport tool family must be enabled. */
    assertTransportsEnabled(context: string): void;
    /** Rule: an explicitly referenced transport number must be allowed. */
    assertTransportAllowed(number: string, context: string): void;
    /** Rule: a package must be on the whitelist before it may be edited. */
    assertPackageAllowed(packageName: string, context: string): void;
    /**
     * Rule: the object may be edited (write/create/delete/activate). Enforces
     * the package whitelist, then — for transportable packages — that both
     * transportable edits and the transport system itself are enabled.
     */
    assertEditAllowed(packageName: string, context: string): void;
    /**
     * Rule: a transport number that the backend auto-assigned (lock CORRNR) must
     * be allowed too — otherwise the edit is rolled back by unlocking. No-op for
     * `$TMP` objects and when the backend returned no request number.
     */
    assertTransportUsage(number: string | undefined, context: string): void;
    /** Rule: program/class execution must be enabled (adt_execute). */
    assertExecutionAllowed(context: string): void;
    /** Rule: write parts inside adt_batch must be explicitly allowed. */
    assertBatchWritesAllowed(context: string): void;
    /** Snapshot for the `adt_permissions` introspection tool. */
    describe(): {
        enableTransports: boolean;
        allowedTransports: string[];
        allowTransportableEdits: boolean;
        allowedPackages: string[];
        allowExecution: boolean;
        allowBatchWrites: boolean;
        sources: Record<PolicyKey, PolicySource>;
        defaults: typeof POLICY_DEFAULTS;
    };
}
export {};
//# sourceMappingURL=policy.d.ts.map