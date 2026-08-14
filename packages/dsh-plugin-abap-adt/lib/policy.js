/**
 * ADT permission policy ("权限管控") — the guard rails applied to every
 * mutating tool of the plugin.
 *
 * Four independent knobs, each resolvable from three sources (in order):
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
 *
 * Every denial throws an {@link AdtPolicyError} carrying the rule id, so the
 * agent sees exactly which knob blocked it and how to adapt.
 *
 * The module is intentionally dependency-free (pure logic + `process.env`)
 * so it can be unit-tested without a live SAP system.
 */
/** SAP "Local Objects" package — edits here never touch the transport system. */
export const LOCAL_PACKAGE = '$TMP';
/** Environment variable names for the four policy knobs. */
export const POLICY_ENV = {
    enableTransports: 'SAP_ENABLE_TRANSPORTS',
    allowedTransports: 'SAP_ALLOWED_TRANSPORTS',
    allowTransportableEdits: 'SAP_ALLOW_TRANSPORTABLE_EDITS',
    allowedPackages: 'SAP_ALLOWED_PACKAGES',
};
/** Built-in defaults: permissive, so the zero-config demo keeps working. */
export const POLICY_DEFAULTS = {
    enableTransports: true,
    allowedTransports: '*',
    allowTransportableEdits: true,
    allowedPackages: '*',
};
/** Thrown when a policy rule denies an operation. */
export class AdtPolicyError extends Error {
    /** The knob that blocked the operation (matches PolicyKey). */
    rule;
    constructor(rule, message) {
        super(`[POLICY] ${message}`);
        this.name = 'AdtPolicyError';
        this.rule = rule;
    }
}
/** Split a comma-separated glob list; empty/omitted means "allow all" (`*`). */
export function parsePatterns(list) {
    if (list === undefined)
        return ['*'];
    const trimmed = list.trim();
    if (trimmed === '')
        return ['*'];
    return trimmed
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
}
/** Convert a simple glob (`*`, `?`) into a case-insensitive RegExp. */
export function globToRegExp(pattern) {
    let re = '';
    for (const ch of pattern) {
        if (ch === '*')
            re += '.*';
        else if (ch === '?')
            re += '.';
        else
            re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(`^${re}$`, 'i');
}
/** Does `value` match any of the glob patterns? */
export function matchesAny(patterns, value) {
    return patterns.some((p) => p === '*' || globToRegExp(p).test(value));
}
/** `$TMP` is the SAP local-objects package (no transport). */
export function isLocalPackage(packageName) {
    return packageName.toUpperCase() === LOCAL_PACKAGE;
}
/** Parse a boolean env value; `undefined` for unset/empty/invalid input. */
export function parseEnvBoolean(value) {
    if (value === undefined)
        return undefined;
    const trimmed = value.trim().toLowerCase();
    if (trimmed === '')
        return undefined;
    if (['true', '1', 'yes', 'on'].includes(trimmed))
        return true;
    if (['false', '0', 'no', 'off'].includes(trimmed))
        return false;
    return undefined;
}
/** The resolved, enforced policy for one plugin instance. */
export class AdtPolicy {
    enableTransports;
    allowedTransports;
    allowTransportableEdits;
    allowedPackages;
    /** Where each knob's effective value came from (for `adt_permissions`). */
    sources;
    constructor(effective) {
        this.enableTransports = effective.enableTransports;
        this.allowedTransports = parsePatterns(effective.allowedTransports);
        this.allowTransportableEdits = effective.allowTransportableEdits;
        this.allowedPackages = parsePatterns(effective.allowedPackages);
        this.sources = effective.sources;
    }
    /**
     * Resolve the effective policy: explicit config > `SAP_*` env var > default.
     * `env` defaults to `process.env`; pass a stub for tests.
     */
    static resolve(config, env = process.env) {
        const sources = {
            enableTransports: 'default',
            allowedTransports: 'default',
            allowTransportableEdits: 'default',
            allowedPackages: 'default',
        };
        const enableTransports = config.enableTransports ?? parseEnvBoolean(env[POLICY_ENV.enableTransports]);
        if (config.enableTransports !== undefined)
            sources.enableTransports = 'config';
        else if (enableTransports !== undefined && env[POLICY_ENV.enableTransports] !== undefined)
            sources.enableTransports = 'env';
        const allowTransportableEdits = config.allowTransportableEdits ?? parseEnvBoolean(env[POLICY_ENV.allowTransportableEdits]);
        if (config.allowTransportableEdits !== undefined)
            sources.allowTransportableEdits = 'config';
        else if (allowTransportableEdits !== undefined && env[POLICY_ENV.allowTransportableEdits] !== undefined)
            sources.allowTransportableEdits = 'env';
        const allowedTransportsRaw = config.allowedTransports ?? env[POLICY_ENV.allowedTransports];
        if (config.allowedTransports !== undefined)
            sources.allowedTransports = 'config';
        else if (env[POLICY_ENV.allowedTransports] !== undefined)
            sources.allowedTransports = 'env';
        const allowedPackagesRaw = config.allowedPackages ?? env[POLICY_ENV.allowedPackages];
        if (config.allowedPackages !== undefined)
            sources.allowedPackages = 'config';
        else if (env[POLICY_ENV.allowedPackages] !== undefined)
            sources.allowedPackages = 'env';
        return new AdtPolicy({
            enableTransports: enableTransports ?? POLICY_DEFAULTS.enableTransports,
            allowedTransports: allowedTransportsRaw ?? POLICY_DEFAULTS.allowedTransports,
            allowTransportableEdits: allowTransportableEdits ?? POLICY_DEFAULTS.allowTransportableEdits,
            allowedPackages: allowedPackagesRaw ?? POLICY_DEFAULTS.allowedPackages,
            sources,
        });
    }
    /** Rule: the transport tool family must be enabled. */
    assertTransportsEnabled(context) {
        if (!this.enableTransports) {
            throw new AdtPolicyError('enableTransports', `${context}: transports are disabled (set ${POLICY_ENV.enableTransports}=true or enableTransports: true to allow)`);
        }
    }
    /** Rule: an explicitly referenced transport number must be allowed. */
    assertTransportAllowed(number, context) {
        if (!matchesAny(this.allowedTransports, number)) {
            throw new AdtPolicyError('allowedTransports', `${context}: transport ${number} is not allowed (allowed: ${this.allowedTransports.join(', ') || '(none)'})`);
        }
    }
    /** Rule: a package must be on the whitelist before it may be edited. */
    assertPackageAllowed(packageName, context) {
        if (!matchesAny(this.allowedPackages, packageName)) {
            throw new AdtPolicyError('allowedPackages', `${context}: package ${packageName} is not allowed (allowed: ${this.allowedPackages.join(', ') || '(none)'})`);
        }
    }
    /**
     * Rule: the object may be edited (write/create/delete/activate). Enforces
     * the package whitelist, then — for transportable packages — that both
     * transportable edits and the transport system itself are enabled.
     */
    assertEditAllowed(packageName, context) {
        this.assertPackageAllowed(packageName, context);
        if (isLocalPackage(packageName))
            return;
        if (!this.allowTransportableEdits) {
            throw new AdtPolicyError('allowTransportableEdits', `${context}: package ${packageName} is transportable (not ${LOCAL_PACKAGE}); ` +
                `set ${POLICY_ENV.allowTransportableEdits}=true or allowTransportableEdits: true to permit edits`);
        }
        if (!this.enableTransports) {
            throw new AdtPolicyError('enableTransports', `${context}: editing transportable package ${packageName} requires the transport system ` +
                `(set ${POLICY_ENV.enableTransports}=true or enableTransports: true)`);
        }
    }
    /**
     * Rule: a transport number that the backend auto-assigned (lock CORRNR) must
     * be allowed too — otherwise the edit is rolled back by unlocking. No-op for
     * `$TMP` objects and when the backend returned no request number.
     */
    assertTransportUsage(number, context) {
        if (!number)
            return;
        if (!this.enableTransports) {
            throw new AdtPolicyError('enableTransports', `${context}: the backend assigned transport ${number} but transports are disabled`);
        }
        this.assertTransportAllowed(number, context);
    }
    /** Snapshot for the `adt_permissions` introspection tool. */
    describe() {
        return {
            enableTransports: this.enableTransports,
            allowedTransports: this.allowedTransports,
            allowTransportableEdits: this.allowTransportableEdits,
            allowedPackages: this.allowedPackages,
            sources: { ...this.sources },
            defaults: { ...POLICY_DEFAULTS },
        };
    }
}
//# sourceMappingURL=policy.js.map