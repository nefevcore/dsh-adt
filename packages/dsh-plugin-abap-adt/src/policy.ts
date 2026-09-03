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

import {
  findBlockedTable,
  type BlockedTableProfile,
} from './tableblocklist.js';

/** SAP "Local Objects" package — edits here never touch the transport system. */
export const LOCAL_PACKAGE = '$TMP';

/** Destination environment profile: how aggressively the policy tightens. */
export type DestinationProfile = 'dev' | 'qa' | 'prd';

/** The valid read-side profiles (mirrors BlockedTableProfile for schema use). */
export type { BlockedTableProfile };

/** Environment variable names for the policy knobs. */
export const POLICY_ENV = {
  enableTransports: 'SAP_ENABLE_TRANSPORTS',
  allowedTransports: 'SAP_ALLOWED_TRANSPORTS',
  allowTransportableEdits: 'SAP_ALLOW_TRANSPORTABLE_EDITS',
  allowedPackages: 'SAP_ALLOWED_PACKAGES',
  allowExecution: 'SAP_ALLOW_EXECUTION',
  allowBatchWrites: 'SAP_ALLOW_BATCH_WRITES',
  blockedTablesProfile: 'SAP_BLOCKED_TABLES_PROFILE',
  blockedTables: 'SAP_BLOCKED_TABLES',
  allowedTables: 'SAP_ALLOWED_TABLES',
  allowDebugger: 'SAP_ALLOW_DEBUGGER',
  allowDebugVariables: 'SAP_ALLOW_DEBUG_VARIABLES',
} as const;

/**
 * Built-in defaults: permissive for edits/execution, strict for batch writes,
 * read-side governance OFF (opt-in — enabling it must never break an existing
 * user). Exported for the workspace file renderer, which shows them as the
 * commented template values of the policy keys.
 */
export const POLICY_DEFAULTS = {
  enableTransports: true,
  allowedTransports: '*',
  allowTransportableEdits: true,
  allowedPackages: '*',
  allowExecution: true,
  allowBatchWrites: false,
  blockedTablesProfile: 'off',
  blockedTables: [] as string[],
  allowedTables: [] as string[],
  allowDebugger: false,
  allowDebugVariables: false,
} as const;

/**
 * The policy knob keys — the canonical list config.ts (known-key
 * validation) and registry.ts (workspace-layer overlay) derive theirs from.
 * The destination `profile` is deliberately NOT a knob: it is a
 * destination-level sibling of the `policy:` block.
 */
export const POLICY_KEYS = Object.keys(POLICY_DEFAULTS) as PolicyKnobKey[];

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
export class AdtPolicyError extends Error {
  /** The knob that blocked the operation (matches PolicyKey). */
  readonly rule: PolicyKey;

  constructor(rule: PolicyKey, message: string) {
    super(`[POLICY] ${message}`);
    this.name = 'AdtPolicyError';
    this.rule = rule;
  }
}

/** Split a comma-separated glob list; empty/omitted means "allow all" (`*`). */
export function parsePatterns(list: string | undefined): string[] {
  if (list === undefined) return ['*'];
  const trimmed = list.trim();
  if (trimmed === '') return ['*'];
  return trimmed
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Convert a simple glob (`*`, `?`) into a case-insensitive RegExp. */
function globToRegExp(pattern: string): RegExp {
  let re = '';
  for (const ch of pattern) {
    if (ch === '*') re += '.*';
    else if (ch === '?') re += '.';
    else re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'i');
}

/** Does `value` match any of the glob patterns? */
export function matchesAny(patterns: string[], value: string): boolean {
  return patterns.some((p) => p === '*' || globToRegExp(p).test(value));
}

/** `$TMP` is the SAP local-objects package (no transport). */
export function isLocalPackage(packageName: string): boolean {
  return packageName.toUpperCase() === LOCAL_PACKAGE;
}

/** Parse a boolean env value; `undefined` for unset/empty/invalid input. */
export function parseEnvBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === '') return undefined;
  if (['true', '1', 'yes', 'on'].includes(trimmed)) return true;
  if (['false', '0', 'no', 'off'].includes(trimmed)) return false;
  return undefined;
}

/** Parse a comma/space-separated env value into an uppercase name list. */
function parseEnvList(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  const parts = value
    .split(/[\s,]+/)
    .map((part) => part.trim().toUpperCase())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts : undefined;
}

/** Normalize a profile word (`undefined` for unset/empty, throws on junk). */
function normalizeProfile(value: unknown, what: string): DestinationProfile {
  if (value === undefined || value === null || value === '') return 'dev';
  const word = String(value).trim().toLowerCase();
  if (word === 'dev' || word === 'qa' || word === 'prd') return word;
  throw new AdtPolicyError('profile', `invalid ${what} '${String(value)}' (expected dev, qa or prd)`);
}

/** Validate a read-side profile word (`undefined` for unset, throws on junk). */
function normalizeBlockedProfile(value: unknown, what: string): BlockedTableProfile | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const word = String(value).trim().toLowerCase();
  if (word === 'off' || word === 'minimal' || word === 'standard' || word === 'strict') return word;
  throw new AdtPolicyError(
    'blockedTablesProfile',
    `invalid ${what} '${String(value)}' (expected off, minimal, standard or strict)`,
  );
}

/** The read-side check outcome the caller reports for the audit trail. */
export interface TableReadCheck {
  /** Tables that passed ONLY because of an `allowedTables` exemption. */
  exempted: string[];
}

/** The resolved, enforced policy for one plugin instance. */
export class AdtPolicy {
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

  private constructor(effective: {
    enableTransports: boolean;
    allowedTransports: string;
    allowTransportableEdits: boolean;
    allowedPackages: string;
    allowExecution: boolean;
    allowBatchWrites: boolean;
    allowDebugger: boolean;
    allowDebugVariables: boolean;
    profile: DestinationProfile;
    blockedTablesProfile: BlockedTableProfile;
    blockedTables: string[];
    allowedTables: string[];
    sources: Record<PolicyKey, PolicySource>;
  }) {
    this.enableTransports = effective.enableTransports;
    this.allowedTransports = parsePatterns(effective.allowedTransports);
    this.allowTransportableEdits = effective.allowTransportableEdits;
    this.allowedPackages = parsePatterns(effective.allowedPackages);
    this.allowExecution = effective.allowExecution;
    this.allowBatchWrites = effective.allowBatchWrites;
    this.allowDebugger = effective.allowDebugger;
    this.allowDebugVariables = effective.allowDebugVariables;
    this.profile = effective.profile;
    this.blockedTablesProfile = effective.blockedTablesProfile;
    this.blockedTables = effective.blockedTables;
    this.allowedTables = effective.allowedTables;
    this.sources = effective.sources;
  }

  /**
   * Resolve the effective policy: explicit config > `SAP_*` env var > default.
   * `env` defaults to `process.env`; pass a stub for tests.
   *
   * The destination profile then TIGHTENS the result (never loosens it):
   * qa defaults the execution/batch knobs to false; prd hard-denies them.
   */
  static resolve(config: PolicyInputs, env: NodeJS.ProcessEnv = process.env): AdtPolicy {
    const sources: Record<PolicyKey, PolicySource> = {
      enableTransports: 'default',
      allowedTransports: 'default',
      allowTransportableEdits: 'default',
      allowedPackages: 'default',
      allowExecution: 'default',
      allowBatchWrites: 'default',
      blockedTablesProfile: 'default',
      blockedTables: 'default',
      allowedTables: 'default',
      allowDebugger: 'default',
      allowDebugVariables: 'default',
      profile: 'default',
    };

    // Per-shape knob resolvers — each records WHERE its value came from.
    // (config > SAP_* env > built-in default; the default itself is applied
    // by the caller/constructor, except where tiering intervenes below.)
    const booleanKnob = (
      key: 'enableTransports' | 'allowTransportableEdits' | 'allowExecution' | 'allowBatchWrites' | 'allowDebugger' | 'allowDebugVariables',
    ): boolean | undefined => {
      const value = config[key] ?? parseEnvBoolean(env[POLICY_ENV[key]]);
      if (config[key] !== undefined) sources[key] = 'config';
      else if (value !== undefined && env[POLICY_ENV[key]] !== undefined) sources[key] = 'env';
      return value;
    };
    const stringKnob = (key: 'allowedTransports' | 'allowedPackages'): string | undefined => {
      const value = config[key] ?? env[POLICY_ENV[key]];
      if (config[key] !== undefined) sources[key] = 'config';
      else if (env[POLICY_ENV[key]] !== undefined) sources[key] = 'env';
      return value;
    };
    const listKnob = (key: 'blockedTables' | 'allowedTables'): string[] => {
      const value = config[key] ?? parseEnvList(env[POLICY_ENV[key]]) ?? [];
      if (config[key] !== undefined) sources[key] = 'config';
      else if (value.length > 0) sources[key] = 'env';
      return value;
    };

    const enableTransports = booleanKnob('enableTransports');
    const allowTransportableEdits = booleanKnob('allowTransportableEdits');
    const allowedTransportsRaw = stringKnob('allowedTransports');
    const allowedPackagesRaw = stringKnob('allowedPackages');
    const allowExecution = booleanKnob('allowExecution');
    const allowBatchWrites = booleanKnob('allowBatchWrites');
    const allowDebugger = booleanKnob('allowDebugger');
    const allowDebugVariables = booleanKnob('allowDebugVariables');
    const blockedTables = listKnob('blockedTables');
    const allowedTables = listKnob('allowedTables');

    const profile = normalizeProfile(config.profile, 'destination profile');
    if (config.profile !== undefined) sources.profile = 'config';

    const blockedTablesProfile =
      normalizeBlockedProfile(config.blockedTablesProfile, 'blockedTablesProfile')
      ?? normalizeBlockedProfile(env[POLICY_ENV.blockedTablesProfile], `${POLICY_ENV.blockedTablesProfile} value`);
    if (blockedTablesProfile !== undefined) {
      sources.blockedTablesProfile =
        config.blockedTablesProfile !== undefined ? 'config' : 'env';
    }

    // Destination-profile tiering — tighten only, never loosen:
    let effectiveExecution = allowExecution ?? POLICY_DEFAULTS.allowExecution;
    let effectiveBatchWrites = allowBatchWrites ?? POLICY_DEFAULTS.allowBatchWrites;
    let effectiveDebugger = allowDebugger ?? POLICY_DEFAULTS.allowDebugger;
    if (profile === 'qa') {
      // Unset knobs default to closed on QA systems; explicit values stand.
      if (sources.allowExecution === 'default') effectiveExecution = false;
      if (sources.allowBatchWrites === 'default') effectiveBatchWrites = false;
      if (sources.allowDebugger === 'default') effectiveDebugger = false;
    }
    if (profile === 'prd') {
      // HARD deny — an explicit true must not open execution, generic batch
      // writes, or the debugger on production (fail-closed; the assert
      // methods carry the prd-specific message).
      effectiveExecution = false;
      effectiveBatchWrites = false;
      effectiveDebugger = false;
    }

    return new AdtPolicy({
      enableTransports: enableTransports ?? POLICY_DEFAULTS.enableTransports,
      allowedTransports: allowedTransportsRaw ?? POLICY_DEFAULTS.allowedTransports,
      allowTransportableEdits: allowTransportableEdits ?? POLICY_DEFAULTS.allowTransportableEdits,
      allowedPackages: allowedPackagesRaw ?? POLICY_DEFAULTS.allowedPackages,
      allowExecution: effectiveExecution,
      allowBatchWrites: effectiveBatchWrites,
      allowDebugger: effectiveDebugger,
      allowDebugVariables: allowDebugVariables ?? POLICY_DEFAULTS.allowDebugVariables,
      profile,
      blockedTablesProfile: blockedTablesProfile ?? POLICY_DEFAULTS.blockedTablesProfile,
      blockedTables,
      allowedTables,
      sources,
    });
  }

  /** Rule: the transport tool family must be enabled. */
  assertTransportsEnabled(context: string): void {
    if (!this.enableTransports) {
      throw new AdtPolicyError(
        'enableTransports',
        `${context}: transports are disabled (set ${POLICY_ENV.enableTransports}=true or enableTransports: true to allow)`,
      );
    }
  }

  /** Rule: an explicitly referenced transport number must be allowed. */
  assertTransportAllowed(number: string, context: string): void {
    if (!matchesAny(this.allowedTransports, number)) {
      throw new AdtPolicyError(
        'allowedTransports',
        `${context}: transport ${number} is not allowed (allowed: ${this.allowedTransports.join(', ') || '(none)'})`,
      );
    }
  }

  /** Rule: a package must be on the whitelist before it may be edited. */
  assertPackageAllowed(packageName: string, context: string): void {
    if (!matchesAny(this.allowedPackages, packageName)) {
      throw new AdtPolicyError(
        'allowedPackages',
        `${context}: package ${packageName} is not allowed (allowed: ${this.allowedPackages.join(', ') || '(none)'})`,
      );
    }
  }

  /**
   * Rule: the object may be edited (write/create/delete/activate). Enforces
   * the package whitelist, then — for transportable packages — that both
   * transportable edits and the transport system itself are enabled.
   */
  assertEditAllowed(packageName: string, context: string): void {
    this.assertPackageAllowed(packageName, context);
    if (isLocalPackage(packageName)) return;
    if (!this.allowTransportableEdits) {
      throw new AdtPolicyError(
        'allowTransportableEdits',
        `${context}: package ${packageName} is transportable (not ${LOCAL_PACKAGE}); ` +
          `set ${POLICY_ENV.allowTransportableEdits}=true or allowTransportableEdits: true to permit edits`,
      );
    }
    if (!this.enableTransports) {
      throw new AdtPolicyError(
        'enableTransports',
        `${context}: editing transportable package ${packageName} requires the transport system ` +
          `(set ${POLICY_ENV.enableTransports}=true or enableTransports: true)`,
      );
    }
  }

  /**
   * Rule: a transport number that the backend auto-assigned (lock CORRNR) must
   * be allowed too — otherwise the edit is rolled back by unlocking. No-op for
   * `$TMP` objects and when the backend returned no request number.
   */
  assertTransportUsage(number: string | undefined, context: string): void {
    if (!number) return;
    if (!this.enableTransports) {
      throw new AdtPolicyError(
        'enableTransports',
        `${context}: the backend assigned transport ${number} but transports are disabled`,
      );
    }
    this.assertTransportAllowed(number, context);
  }

  /** Rule: program/class execution must be enabled (adt_execute). */
  assertExecutionAllowed(context: string): void {
    if (this.profile === 'prd') {
      throw new AdtPolicyError(
        'allowExecution',
        `${context}: executing programs/classes is hard-denied on profile: prd destinations — ` +
          'the prd tier cannot be opened up by configuration (fail-closed). ' +
          'Run the program on a dev/qa destination instead.',
      );
    }
    if (!this.allowExecution) {
      throw new AdtPolicyError(
        'allowExecution',
        `${context}: executing programs/classes is disabled on this destination ` +
          `(set ${POLICY_ENV.allowExecution}=true or allowExecution: true to permit)`,
      );
    }
  }

  /** Rule: write parts inside adt_batch must be explicitly allowed. */
  assertBatchWritesAllowed(context: string): void {
    if (this.profile === 'prd') {
      throw new AdtPolicyError(
        'allowBatchWrites',
        `${context}: adt_batch write parts are hard-denied on profile: prd destinations — ` +
          'the prd tier cannot be opened up by configuration (fail-closed). ' +
          'Use dedicated write tools on a dev/qa destination instead.',
      );
    }
    if (!this.allowBatchWrites) {
      throw new AdtPolicyError(
        'allowBatchWrites',
        `${context}: adt_batch write parts are disabled (read-only GET fan-out is always allowed). ` +
          `A generic embedded POST/PUT bypasses per-object policy checks; set ${POLICY_ENV.allowBatchWrites}=true ` +
          'or use the dedicated write tools (adt_write_object / adt_write_structure), which ARE policy-checked',
      );
    }
  }

  /**
   * Rule: a row-returning read of these tables must not hit the blocked-table
   * catalog (read-side governance, `blockedTablesProfile`). A deny throws
   * BEFORE any backend request is sent and always names the category and
   * reason. Tables exempt via `allowedTables` pass and are returned in
   * `exempted` so the caller can surface the audit note.
   */
  assertTableReadsAllowed(tables: readonly string[], context: string): TableReadCheck {
    if (this.blockedTablesProfile === 'off') return { exempted: [] };
    const exempted: string[] = [];
    for (const raw of tables) {
      const table = raw.toUpperCase();
      if (matchesAny(this.allowedTables, table)) {
        exempted.push(table);
        continue;
      }
      const hit = findBlockedTable(table, this.blockedTablesProfile, this.blockedTables);
      if (hit) {
        throw new AdtPolicyError(
          'blockedTables',
          `${context}: blockedTables: ${hit.table} — ${hit.category}: ${hit.why} ` +
            `(profile: ${this.blockedTablesProfile}; refused before any request was sent — ` +
            'DDIC metadata reads stay allowed; exempt a table with allowedTables, or read a ' +
            'released CDS view that masks the sensitive fields)',
        );
      }
    }
    return { exempted };
  }

  /** Rule: the debugger tool family must be explicitly enabled (adt_debug_*). */
  assertDebuggerAllowed(context: string): void {
    if (this.profile === 'prd') {
      throw new AdtPolicyError(
        'allowDebugger',
        `${context}: the debugger is hard-denied on profile: prd destinations — ` +
          'debugging holds a system session and can change program state; run it on a dev/qa destination',
      );
    }
    if (!this.allowDebugger) {
      throw new AdtPolicyError(
        'allowDebugger',
        `${context}: the ABAP debugger is disabled on this destination ` +
          `(set ${POLICY_ENV.allowDebugger}=true or allowDebugger: true to permit — it holds a stateful ` +
          'session and stops live processes)',
      );
    }
  }

  /** Rule: writing debuggee variables needs the extra knob (double opt-in). */
  assertDebugVariablesAllowed(context: string): void {
    if (!this.allowDebugVariables) {
      throw new AdtPolicyError(
        'allowDebugVariables',
        `${context}: changing variable VALUES in the debugger is disabled ` +
          `(set ${POLICY_ENV.allowDebugVariables}=true or allowDebugVariables: true; requires allowDebugger too)`,
      );
    }
  }

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
  } {
    return {
      enableTransports: this.enableTransports,
      allowedTransports: this.allowedTransports,
      allowTransportableEdits: this.allowTransportableEdits,
      allowedPackages: this.allowedPackages,
      allowExecution: this.allowExecution,
      allowBatchWrites: this.allowBatchWrites,
      allowDebugger: this.allowDebugger,
      allowDebugVariables: this.allowDebugVariables,
      profile: this.profile,
      blockedTablesProfile: this.blockedTablesProfile,
      blockedTables: this.blockedTables,
      allowedTables: this.allowedTables,
      sources: { ...this.sources },
      defaults: { ...POLICY_DEFAULTS },
    };
  }
}
