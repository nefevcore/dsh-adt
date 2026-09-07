/**
 * Plugin configuration schema (schemastery) and the DSH-settings layering
 * pipeline.
 *
 * The plugin registers its Config schema as the `abap-adt` settings namespace
 * via `ctx.settings.installSection` (see index.ts), so the composition entry (the
 * plugin row's `config:` block) becomes the namespace `base` and the user's
 * `~/.dsh/settings.yaml` `abap-adt:` section becomes the user layer. The
 * effective config resolves nearest-wins:
 *
 *   1. schema defaults (lowest) — demo on, port 8123, defaultDestination demo
 *   2. composition base — the plugin row config (preset / cordis.patch.yml)
 *   3. legacy file — auto-discovered `${DSH_HOME:-~/.dsh}/abap-adt.yml`
 *      (DEPRECATED: kept one release for migration; warns when present)
 *   4. settings user section — `abap-adt:` in ~/.dsh/settings.yaml
 *   5. explicit `configFile` — authoritative team-shared override; its path
 *      comes from any lower layer
 *   6. workspace file — `<session cwd>/<host config dir>/destinations.yaml`
 *      (nearest; per-session, resolved at tool-call time because the preset
 *      mount is shared across sessions — see registry.ts viewFor())
 *
 * Policy keys (`enableTransports` / `allowedTransports` /
 * `allowTransportableEdits` / `allowedPackages`) deliberately carry NO schema
 * default: when absent in every layer the `SAP_*` environment variables apply
 * (see policy.ts), and only then the built-in defaults there.
 */
import z from '@deepseek-ai/schemastery';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { parse } from 'yaml';
import { POLICY_KEYS } from './policy.js';
/**
 * Per-destination permission-policy override (all keys optional; each
 * overrides the global top-level value for THIS destination only). Includes
 * the read-side governance keys (blockedTablesProfile / blockedTables /
 * allowedTables — see tableblocklist.ts).
 */
const policySchema = z.object({
    enableTransports: z.boolean(),
    allowedTransports: z.string(),
    allowTransportableEdits: z.boolean(),
    allowedPackages: z.string(),
    allowExecution: z.boolean(),
    allowBatchWrites: z.boolean(),
    blockedTablesProfile: z.union(['off', 'minimal', 'standard', 'strict']),
    blockedTables: z.array(z.string()),
    allowedTables: z.array(z.string()),
    allowDebugger: z.boolean(),
    allowDebugVariables: z.boolean(),
});
const destinationSchema = z.object({
    name: z.string().required(),
    /** Scheme + host + port, e.g. `https://sap.example.com:443`. */
    url: z.string().required(),
    /** SAP client (mandant). */
    client: z.string(),
    /** Logon language, e.g. `EN`, `ZH`. */
    language: z.string(),
    username: z.string(),
    /** Static password (prefer `passwordEnv` / env var conventions). */
    password: z.string().role('secret'),
    /** Name of the environment variable holding the password. */
    passwordEnv: z.string(),
    strictSSL: z.boolean().default(true),
    timeoutMs: z.number().default(60_000),
    /**
     * Environment profile of this destination (see policy.ts): `dev` (default)
     * keeps the plain knob semantics; `qa` defaults execution/batch writes to
     * off; `prd` hard-denies them regardless of configuration.
     */
    profile: z.union(['dev', 'qa', 'prd']),
    /** Destination-level policy overrides (see policy.ts for semantics). */
    policy: policySchema,
});
export const Config = z.object({
    /**
     * Authoritative external config file (team-shared destinations / permission
     * policy). `~` is expanded; relative paths anchor to the dsh home. Its path
     * may come from the composition row or the settings user section.
     */
    configFile: z.string(),
    /** In-process demo destination backed by the mock ADT server (default on). */
    demo: z.boolean().default(true),
    demoPort: z.number().default(8123),
    /** Default destination name used by tools when none is given. */
    defaultDestination: z.string().default('demo'),
    /**
     * GLOBAL permission-policy defaults. These apply to every destination
     * without its own `policy:` block; a destination-level `policy:` entry
     * overrides them key by key. Each key is optional: when absent everywhere,
     * the corresponding `SAP_*` environment variable applies, then the built-in
     * default (see `src/policy.ts`).
     */
    /** Allow the transport tool family and transport usage (env: SAP_ENABLE_TRANSPORTS). */
    enableTransports: z.boolean(),
    /** Comma-separated glob list of allowed transport request numbers, e.g. `D01K96*` (env: SAP_ALLOWED_TRANSPORTS). */
    allowedTransports: z.string(),
    /** Allow edits (write/create/delete/activate) on transportable (non-$TMP) packages (env: SAP_ALLOW_TRANSPORTABLE_EDITS). */
    allowTransportableEdits: z.boolean(),
    /** Comma-separated glob list of packages that may be edited, e.g. `Z*,$TMP` (env: SAP_ALLOWED_PACKAGES). */
    allowedPackages: z.string(),
    /** Allow running programs / classrun classes via adt_execute (env: SAP_ALLOW_EXECUTION). */
    allowExecution: z.boolean(),
    /** Allow write parts (POST/PUT) inside adt_batch — off by default (env: SAP_ALLOW_BATCH_WRITES). */
    allowBatchWrites: z.boolean(),
    /** Read-side governance profile for row reads (off|minimal|standard|strict; default off; env: SAP_BLOCKED_TABLES_PROFILE). */
    blockedTablesProfile: z.union(['off', 'minimal', 'standard', 'strict']),
    /** Extra blocked table names/patterns added on top of the catalog (env: SAP_BLOCKED_TABLES, comma-separated). */
    blockedTables: z.array(z.string()),
    /** Exemptions from the blocked-table catalog — audited on every use (env: SAP_ALLOWED_TABLES, comma-separated). */
    allowedTables: z.array(z.string()),
    /** Allow the ABAP debugger tool family (adt_debug_*) — off by default (env: SAP_ALLOW_DEBUGGER). */
    allowDebugger: z.boolean(),
    /** Allow changing debuggee variable values in the debugger — double opt-in (env: SAP_ALLOW_DEBUG_VARIABLES). */
    allowDebugVariables: z.boolean(),
    destinations: z.array(destinationSchema),
});
/** Default external config file name inside the dsh home directory. */
const DEFAULT_CONFIG_FILE = 'abap-adt.yml';
/**
 * Workspace-scoped config: every session has a working directory (its
 * "workspace", `exec.agent.session.header.cwd`), and destinations configured
 * there are private to that workspace — e.g.
 * `<workspace>/<config dir>/destinations.yaml`. The config DIR is a host
 * property: hosts declare theirs via `HostProfile.workspaceConfigDir`
 * (DSH: '.dsh-abap-adt', other hosts their own); the default below keeps
 * undeclared hosts and existing workspaces working unchanged.
 */
export const DEFAULT_WORKSPACE_CONFIG_DIR = '.dsh-abap-adt';
/** Candidate file names inside the workspace config dir, first hit wins. */
const WORKSPACE_CONFIG_FILES = ['destinations.yaml', 'destinations.yml'];
/**
 * Resolve the workspace config file candidates for a workspace root, inside
 * `configDir` (the host-declared workspace config directory, default
 * '.dsh-abap-adt'): `<cwd>/<configDir>/destinations.yaml`, then `.yml`.
 */
export function workspaceConfigCandidates(cwd, configDir = DEFAULT_WORKSPACE_CONFIG_DIR) {
    return WORKSPACE_CONFIG_FILES.map((file) => join(cwd, configDir, file));
}
/**
 * The workspace config file for a cwd: the first existing candidate, or the
 * primary candidate when none exists yet (so creators can pre-resolve the
 * path they are about to write).
 */
export function workspaceConfigPath(cwd, configDir = DEFAULT_WORKSPACE_CONFIG_DIR) {
    return (workspaceConfigCandidates(cwd, configDir).find((p) => existsSync(p)) ??
        workspaceConfigCandidates(cwd, configDir)[0]);
}
/** Built-in defaults, applied last (mirrors the schema defaults above). */
export function builtinDefaults() {
    return {
        demo: true,
        demoPort: 8123,
        defaultDestination: 'demo',
        destinations: [],
    };
}
const SCALAR_KEYS = ['demo', 'demoPort', 'defaultDestination', ...POLICY_KEYS];
const KNOWN_TOP_LEVEL_KEYS = new Set([...SCALAR_KEYS, 'destinations', 'configFile']);
const KNOWN_DESTINATION_KEYS = new Set([
    'name',
    'url',
    'client',
    'language',
    'username',
    'password',
    'passwordEnv',
    'strictSSL',
    'timeoutMs',
    'profile',
    'policy',
]);
const KNOWN_POLICY_KEYS = new Set(POLICY_KEYS);
/** The dsh home directory: `${DSH_HOME}` or `~/.dsh`. */
export function dshHome() {
    return process.env.DSH_HOME || join(homedir(), '.dsh');
}
/** Expand a leading `~` to the user home directory (POSIX-style, works on Windows too). */
export function expandHomePath(p) {
    if (p === '~')
        return homedir();
    if (p.startsWith('~/') || p.startsWith('~\\'))
        return join(homedir(), p.slice(2));
    return p;
}
/** Resolve a config file path: expand `~`, anchor relative paths to the dsh home. */
export function resolveConfigFilePath(p) {
    const expanded = expandHomePath(p);
    return isAbsolute(expanded) ? expanded : resolve(dshHome(), expanded);
}
/**
 * Path of the DEPRECATED auto-discovered config file (existence not checked).
 * Kept one release for migration; its contents now belong in the `abap-adt:`
 * section of `${DSH_HOME:-~/.dsh}/settings.yaml`.
 */
export function autoDiscoverConfigFile() {
    return join(dshHome(), DEFAULT_CONFIG_FILE);
}
/**
 * Pure nearest-wins composition of config layers, lowest first. Scalar keys:
 * the last layer that sets a key wins. `destinations` merge by `name` across
 * every layer — a same-name entry in a later layer replaces the earlier one,
 * new names are appended (so a shipped `destinations: []` never masks another
 * layer). Policy keys stay `undefined` when absent in every layer, leaving
 * them to the `SAP_*` env fallback in `AdtPolicy.resolve`.
 */
export function composeLayers(layers) {
    const merged = builtinDefaults();
    // Scalar assignment goes through a widened record view: the loop variable
    // key is a union, so a direct `merged[key] = value` would be `never`.
    const target = merged;
    const byName = new Map();
    for (const layer of layers) {
        if (!layer)
            continue;
        for (const key of SCALAR_KEYS) {
            const value = layer[key];
            if (value !== undefined)
                target[key] = value;
        }
        // `configFile` rides along too (nearest layer that sets it wins) so the
        // first resolution pass can discover the explicit path.
        if (layer.configFile !== undefined)
            merged.configFile = layer.configFile;
        for (const dest of layer.destinations ?? [])
            byName.set(dest.name, dest);
    }
    merged.destinations = [...byName.values()];
    return merged;
}
/**
 * Validate a parsed external config document (shared by the async file
 * loader and the sync workspace loader). Throws with the path in the message
 * on shape errors; returns `{}` for an empty document.
 */
export function validateExternalConfig(parsed, path) {
    if (parsed === null || parsed === undefined)
        return {};
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`[abap-adt] config file ${path} must be a YAML mapping (key: value), got ` +
            `${Array.isArray(parsed) ? 'a list' : typeof parsed}`);
    }
    const unknown = Object.keys(parsed).filter((key) => !KNOWN_TOP_LEVEL_KEYS.has(key));
    if (unknown.length > 0) {
        throw new Error(`[abap-adt] unknown config keys in ${path}: ${unknown.join(', ')} ` +
            `(known keys: ${[...KNOWN_TOP_LEVEL_KEYS].join(', ')})`);
    }
    // `configFile` inside the file would be self-referential; drop it silently.
    const picked = parsed;
    delete picked.configFile;
    let validated;
    try {
        validated = Config(picked);
    }
    catch (error) {
        throw new Error(`[abap-adt] invalid config file ${path}: ${error.message}`);
    }
    for (const dest of validated.destinations ?? []) {
        const unknownDest = Object.keys(dest).filter((key) => !KNOWN_DESTINATION_KEYS.has(key));
        if (unknownDest.length > 0) {
            throw new Error(`[abap-adt] unknown destination keys in ${path} (destination "${dest.name}"): ` +
                `${unknownDest.join(', ')} (known keys: ${[...KNOWN_DESTINATION_KEYS].join(', ')})`);
        }
        if (dest.policy) {
            const unknownPolicy = Object.keys(dest.policy).filter((key) => !KNOWN_POLICY_KEYS.has(key));
            if (unknownPolicy.length > 0) {
                throw new Error(`[abap-adt] unknown policy keys in ${path} (destination "${dest.name}"): ` +
                    `${unknownPolicy.join(', ')} (known keys: ${[...KNOWN_POLICY_KEYS].join(', ')})`);
            }
        }
    }
    return validated;
}
/**
 * Read and validate an external config file. Throws with the path in the
 * message on YAML/shape errors (a broken config should fail loudly);
 * returns an empty object for an empty file.
 */
export async function loadExternalConfigFile(path) {
    let raw;
    try {
        raw = await readFile(path, 'utf8');
    }
    catch (error) {
        throw new Error(`[abap-adt] cannot read config file ${path}: ${error.message}`);
    }
    return parseExternalConfigText(raw, path);
}
/** Parse config-file text RAW (no validation): throws with the path in the
 *  message on invalid YAML; null/undefined documents stay as-is. Shared by
 *  the validating config loader and the raw workspace-layer parser. */
export function parseYamlDocument(raw, path) {
    try {
        return parse(raw);
    }
    catch (error) {
        throw new Error(`[abap-adt] invalid YAML in ${path}: ${error.message}`);
    }
}
/** Parse + validate config file text (shared by async and sync loaders). */
export function parseExternalConfigText(raw, path) {
    return validateExternalConfig(parseYamlDocument(raw, path), path);
}
/**
 * Resolve the effective plugin config across all layers (nearest wins):
 * schema defaults < composition entry < legacy file < settings user section <
 * explicit `configFile`. The legacy `${DSH_HOME:-~/.dsh}/abap-adt.yml` is
 * auto-discovered and warns when present (deprecated). A missing explicitly
 * configured file is a warning, not an error — the plugin stays usable.
 */
export async function resolveEffectiveConfig(source) {
    const warnings = [];
    // Legacy auto-discovered file (deprecated, migration window).
    let legacy;
    const legacyPath = autoDiscoverConfigFile();
    if (existsSync(legacyPath)) {
        legacy = await loadExternalConfigFile(legacyPath);
        warnings.push(`legacy config file ${legacyPath} is deprecated and will be removed in a future release; ` +
            'move its contents into the `abap-adt:` section of settings.yaml and delete the file');
    }
    // First pass resolves the explicit configFile path from the lower layers.
    const lower = composeLayers([source.entry, legacy, source.resolved]);
    let file;
    let usedPath;
    if (lower.configFile) {
        const path = resolveConfigFilePath(lower.configFile);
        if (existsSync(path)) {
            file = await loadExternalConfigFile(path);
            usedPath = path;
        }
        else {
            warnings.push(`configFile not found, ignored: ${path}`);
        }
    }
    const config = composeLayers([source.entry, legacy, source.resolved, file]);
    if (usedPath)
        config.configFileUsed = usedPath;
    return { config, warnings };
}
/**
 * Resolves a destination's password reference names, in priority order:
 * the explicit `passwordEnv`, else the `ADT_<NAME>_PASSWORD` convention,
 * with `ADT_PASSWORD` as the shared fallback.
 */
export function passwordRefNames(dest) {
    const primary = dest.passwordEnv ?? `ADT_${dest.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_PASSWORD`;
    return [primary, 'ADT_PASSWORD'];
}
/**
 * Resolve the password for a destination, layer by layer (first hit wins):
 *
 *   1. `config.password` (plaintext in the config file — supported, discouraged)
 *   2. per reference name (explicit `passwordEnv`, else the
 *      `ADT_<NAME>_PASSWORD` convention, then `ADT_PASSWORD`):
 *        a. the DSH credential service (`~/.dsh/.credentials.yaml` layered
 *           over `.env` files — `resolver`), when mounted
 *        b. the raw process environment
 *
 * The credential-service read is per call (the service contract forbids
 * caching across operations), so an edited credentials file reaches the next
 * tool call without a restart — which is why `resolvePassword` is async.
 */
export async function resolvePassword(dest, resolver) {
    if (dest.password)
        return dest.password;
    for (const ref of passwordRefNames(dest)) {
        const viaService = resolver ? await resolver(ref) : undefined;
        if (viaService)
            return viaService;
        const direct = process.env[ref];
        if (direct)
            return direct;
    }
    return '';
}
//# sourceMappingURL=config.js.map