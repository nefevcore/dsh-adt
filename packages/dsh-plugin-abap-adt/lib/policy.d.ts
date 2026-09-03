/**
 * ADT permission policy ("权限管控") — the guard rails applied to every
 * mutating tool of the plugin, and (since the read-side upgrade) to
 * row-returning reads as well.
 *
 * Nine independent knobs, each resolvable from three sources (in order):
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
 * | read-side table profile     | `blockedTablesProfile`    | `SAP_BLOCKED_TABLES_PROFILE`  | `off`   |
 * | extra blocked tables        | `blockedTables`           | `SAP_BLOCKED_TABLES`          | (none)  |
 * | blocked-table exemptions    | `allowedTables`           | `SAP_ALLOWED_TABLES`          | (none)  |
 * | debugger tool family        | `allowDebugger`           | `SAP_ALLOW_DEBUGGER`          | `false` |
 * | debugger variable writes    | `allowDebugVariables`     | `SAP_ALLOW_DEBUG_VARIABLES`   | `false` |
 *
 * Pattern lists (`allowedTransports`, `allowedPackages`) are comma-separated
 * globs: `*` matches any sequence, `?` any single char; matching is
 * case-insensitive. `*` alone (or an empty/omitted value) allows everything.
 * `$TMP` is the SAP "Local Objects" package (no transport involved).
 *
 * Table lists (`blockedTables`, `allowedTables`) accept SAP-name globs where
 * `*` means `[A-Z0-9_]*` (see tableblocklist.ts); env values are
 * comma-separated.
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
 *  - `blockedTablesProfile`    → read-side governance of `adt_data_preview`
 *    (opt-in, default `off`). When active, row reads of cataloged sensitive
 *    tables are DENIED before any request is sent, with the category and
 *    reason; a deny can never be bypassed. `blockedTables` adds custom
 *    names/patterns; `allowedTables` exempts names per destination — every
 *    exemption use is reported back for the audit trail. See
 *    tableblocklist.ts for the tiers.
 *
 * Destination environment profile (`profile: dev|qa|prd`, a destination-level
 * key — NOT part of the `policy:` block):
 *  - `dev` (default): the knobs above apply as written.
 *  - `qa`: `allowExecution` and `allowBatchWrites` default to `false`
 *    (explicit config/env values still open them).
 *  - `prd`: execution and batch writes are HARD-DENIED — not even an explicit
 *    `allowExecution: true` overrides the prd tier (fail-closed; no prd
 *    allowlist by design).
 *
 * Every denial throws an {@link AdtPolicyError} carrying the rule id, so the
 * agent sees exactly which knob blocked it and how to adapt.
 *
 * The module is intentionally dependency-free (pure logic + `process.env`)
 * so it can be unit-tested without a live SAP system.
 */
import { type BlockedTableProfile } from './tableblocklist.js';
/** SAP "Local Objects" package — edits here never touch the transport system. */
export declare const LOCAL_PACKAGE = "$TMP";
/** Destination environment profile: how aggressively the policy tightens. */
export type DestinationProfile = 'dev' | 'qa' | 'prd';
/** The valid read-side profiles (mirrors BlockedTableProfile for schema use). */
export type { BlockedTableProfile };
/** Environment variable names for the policy knobs. */
export declare const POLICY_ENV: {
    readonly enableTransports: "SAP_ENABLE_TRANSPORTS";
    readonly allowedTransports: "SAP_ALLOWED_TRANSPORTS";
    readonly allowTransportableEdits: "SAP_ALLOW_TRANSPORTABLE_EDITS";
    readonly allowedPackages: "SAP_ALLOWED_PACKAGES";
    readonly allowExecution: "SAP_ALLOW_EXECUTION";
    readonly allowBatchWrites: "SAP_ALLOW_BATCH_WRITES";
    readonly blockedTablesProfile: "SAP_BLOCKED_TABLES_PROFILE";
    readonly blockedTables: "SAP_BLOCKED_TABLES";
    readonly allowedTables: "SAP_ALLOWED_TABLES";
    readonly allowDebugger: "SAP_ALLOW_DEBUGGER";
    readonly allowDebugVariables: "SAP_ALLOW_DEBUG_VARIABLES";
};
/**
 * Built-in defaults: permissive for edits/execution, strict for batch writes,
 * read-side governance OFF (opt-in — enabling it must never break an existing
 * user). Exported for the workspace file renderer, which shows them as the
 * commented template values of the policy keys.
 */
export declare const POLICY_DEFAULTS: {
    readonly enableTransports: true;
    readonly allowedTransports: "*";
    readonly allowTransportableEdits: true;
    readonly allowedPackages: "*";
    readonly allowExecution: true;
    readonly allowBatchWrites: false;
    readonly blockedTablesProfile: "off";
    readonly blockedTables: string[];
    readonly allowedTables: string[];
    readonly allowDebugger: false;
    readonly allowDebugVariables: false;
};
/**
 * The policy knob keys — the canonical list config.ts (known-key
 * validation) and registry.ts (workspace-layer overlay) derive theirs from.
 * The destination `profile` is deliberately NOT a knob: it is a
 * destination-level sibling of the `policy:` block.
 */
export declare const POLICY_KEYS: PolicyKnobKey[];
/** Raw (pre-resolution) policy values from the plugin config. */
export interface PolicyInputs {
    enableTransports?: boolean;
    allowedTransports?: string;
    allowTransportableEdits?: boolean;
    allowedPackages?: string;
    allowExecution?: boolean;
    allowBatchWrites?: boolean;
    blockedTablesProfile?: string;
    blockedTables?: string[];
    allowedTables?: string[];
    allowDebugger?: boolean;
    allowDebugVariables?: boolean;
    /** Destination environment profile (destination-level config key). */
    profile?: DestinationProfile;
}
export type PolicyKey = keyof PolicyInputs;
/** Keys of the resolvable policy knobs (everywhere POLICY_KEYS is indexed). */
export type PolicyKnobKey = keyof typeof POLICY_DEFAULTS;
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
/** The read-side check outcome the caller reports for the audit trail. */
export interface TableReadCheck {
    /** Tables that passed ONLY because of an `allowedTables` exemption. */
    exempted: string[];
}
/** The resolved, enforced policy for one plugin instance. */
export declare class AdtPolicy {
    readonly enableTransports: boolean;
    readonly allowedTransports: string[];
    readonly allowTransportableEdits: boolean;
    readonly allowedPackages: string[];
    readonly allowExecution: boolean;
    readonly allowBatchWrites: boolean;
    /** Debugger tool family (adt_debug_*): off unless explicitly enabled. */
    readonly allowDebugger: boolean;
    /** Writing debuggee variables (adt_debug_set_variable): double opt-in. */
    readonly allowDebugVariables: boolean;
    /** Destination environment profile (dev keeps the plain knob semantics). */
    readonly profile: DestinationProfile;
    /** Read-side governance profile for row-returning reads (`off` = none). */
    readonly blockedTablesProfile: BlockedTableProfile;
    /** Custom blocked names/patterns added on top of the built-in catalog. */
    readonly blockedTables: string[];
    /** Exemptions from the blocked-table catalog (audited on every use). */
    readonly allowedTables: string[];
    /** Where each knob's effective value came from (for `adt_permissions`). */
    readonly sources: Record<PolicyKey, PolicySource>;
    private constructor();
    /**
     * Resolve the effective policy: explicit config > `SAP_*` env var > default.
     * `env` defaults to `process.env`; pass a stub for tests.
     *
     * The destination profile then TIGHTENS the result (never loosens it):
     * qa defaults the execution/batch knobs to false; prd hard-denies them.
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
    /**
     * Rule: a row-returning read of these tables must not hit the blocked-table
     * catalog (read-side governance, `blockedTablesProfile`). A deny throws
     * BEFORE any backend request is sent and always names the category and
     * reason. Tables exempt via `allowedTables` pass and are returned in
     * `exempted` so the caller can surface the audit note.
     */
    assertTableReadsAllowed(tables: readonly string[], context: string): TableReadCheck;
    /** Rule: the debugger tool family must be explicitly enabled (adt_debug_*). */
    assertDebuggerAllowed(context: string): void;
    /** Rule: writing debuggee variables needs the extra knob (double opt-in). */
    assertDebugVariablesAllowed(context: string): void;
    /** Snapshot for the `adt_permissions` introspection tool. */
    describe(): {
        enableTransports: boolean;
        allowedTransports: string[];
        allowTransportableEdits: boolean;
        allowedPackages: string[];
        allowExecution: boolean;
        allowBatchWrites: boolean;
        allowDebugger: boolean;
        allowDebugVariables: boolean;
        profile: DestinationProfile;
        blockedTablesProfile: BlockedTableProfile;
        blockedTables: string[];
        allowedTables: string[];
        sources: Record<PolicyKey, PolicySource>;
        defaults: typeof POLICY_DEFAULTS;
    };
}
//# sourceMappingURL=policy.d.ts.map