/**
 * Plugin configuration schema (schemastery) and the DSH-settings layering
 * pipeline.
 *
 *  * The plugin registers its Config schema as the `abap-adt` settings namespace
 * via `installSettingsSection` (see index.ts), so the composition entry (the
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
 *   6. workspace file — `<session cwd>/.dsh-abap-adt/destinations.yaml`
 *      (nearest; per-session, resolved at tool-call time because the preset
 *      mount is shared across sessions — see registry.ts viewFor())
 *
 * Policy keys (`enableTransports` / `allowedTransports` /
 * `allowTransportableEdits` / `allowedPackages`) deliberately carry NO schema
 * default: when absent in every layer the `SAP_*` environment variables apply
 * (see policy.ts), and only then the built-in defaults there.
 */
import z from '@deepseek-ai/schemastery';
declare const destinationSchema: z<Schemastery.ObjectS<{
    name: z<string, string>;
    /** Scheme + host + port, e.g. `https://sap.example.com:443`. */
    url: z<string, string>;
    /** SAP client (mandant). */
    client: z<string, string>;
    /** Logon language, e.g. `EN`, `ZH`. */
    language: z<string, string>;
    username: z<string, string>;
    /** Static password (prefer `passwordEnv` / env var conventions). */
    password: z<string, string>;
    /** Name of the environment variable holding the password. */
    passwordEnv: z<string, string>;
    strictSSL: z<boolean, boolean>;
    timeoutMs: z<number, number>;
    /** Destination-level policy overrides (see policy.ts for semantics). */
    policy: z<Schemastery.ObjectS<{
        enableTransports: z<boolean, boolean>;
        allowedTransports: z<string, string>;
        allowTransportableEdits: z<boolean, boolean>;
        allowedPackages: z<string, string>;
        allowExecution: z<boolean, boolean>;
        allowBatchWrites: z<boolean, boolean>;
    }>, Schemastery.ObjectT<{
        enableTransports: z<boolean, boolean>;
        allowedTransports: z<string, string>;
        allowTransportableEdits: z<boolean, boolean>;
        allowedPackages: z<string, string>;
        allowExecution: z<boolean, boolean>;
        allowBatchWrites: z<boolean, boolean>;
    }>>;
}>, Schemastery.ObjectT<{
    name: z<string, string>;
    /** Scheme + host + port, e.g. `https://sap.example.com:443`. */
    url: z<string, string>;
    /** SAP client (mandant). */
    client: z<string, string>;
    /** Logon language, e.g. `EN`, `ZH`. */
    language: z<string, string>;
    username: z<string, string>;
    /** Static password (prefer `passwordEnv` / env var conventions). */
    password: z<string, string>;
    /** Name of the environment variable holding the password. */
    passwordEnv: z<string, string>;
    strictSSL: z<boolean, boolean>;
    timeoutMs: z<number, number>;
    /** Destination-level policy overrides (see policy.ts for semantics). */
    policy: z<Schemastery.ObjectS<{
        enableTransports: z<boolean, boolean>;
        allowedTransports: z<string, string>;
        allowTransportableEdits: z<boolean, boolean>;
        allowedPackages: z<string, string>;
        allowExecution: z<boolean, boolean>;
        allowBatchWrites: z<boolean, boolean>;
    }>, Schemastery.ObjectT<{
        enableTransports: z<boolean, boolean>;
        allowedTransports: z<string, string>;
        allowTransportableEdits: z<boolean, boolean>;
        allowedPackages: z<string, string>;
        allowExecution: z<boolean, boolean>;
        allowBatchWrites: z<boolean, boolean>;
    }>>;
}>>;
export declare const Config: z<Schemastery.ObjectS<{
    /**
     * Authoritative external config file (team-shared destinations / permission
     * policy). `~` is expanded; relative paths anchor to the dsh home. Its path
     * may come from the composition row or the settings user section.
     */
    configFile: z<string, string>;
    /** In-process demo destination backed by the mock ADT server (default on). */
    demo: z<boolean, boolean>;
    demoPort: z<number, number>;
    /** Default destination name used by tools when none is given. */
    defaultDestination: z<string, string>;
    /**
     * GLOBAL permission-policy defaults. These apply to every destination
     * without its own `policy:` block; a destination-level `policy:` entry
     * overrides them key by key. Each key is optional: when absent everywhere,
     * the corresponding `SAP_*` environment variable applies, then the built-in
     * default (see `src/policy.ts`).
     */
    /** Allow the transport tool family and transport usage (env: SAP_ENABLE_TRANSPORTS). */
    enableTransports: z<boolean, boolean>;
    /** Comma-separated glob list of allowed transport request numbers, e.g. `D01K96*` (env: SAP_ALLOWED_TRANSPORTS). */
    allowedTransports: z<string, string>;
    /** Allow edits (write/create/delete/activate) on transportable (non-$TMP) packages (env: SAP_ALLOW_TRANSPORTABLE_EDITS). */
    allowTransportableEdits: z<boolean, boolean>;
    /** Comma-separated glob list of packages that may be edited, e.g. `Z*,$TMP` (env: SAP_ALLOWED_PACKAGES). */
    allowedPackages: z<string, string>;
    /** Allow running programs / classrun classes via adt_execute (env: SAP_ALLOW_EXECUTION). */
    allowExecution: z<boolean, boolean>;
    /** Allow write parts (POST/PUT) inside adt_batch — off by default (env: SAP_ALLOW_BATCH_WRITES). */
    allowBatchWrites: z<boolean, boolean>;
    destinations: z<({
        name?: string | null | undefined;
        url?: string | null | undefined;
        client?: string | null | undefined;
        language?: string | null | undefined;
        username?: string | null | undefined;
        password?: string | null | undefined;
        passwordEnv?: string | null | undefined;
        strictSSL?: boolean | null | undefined;
        timeoutMs?: number | null | undefined;
        policy?: ({
            enableTransports?: boolean | null | undefined;
            allowedTransports?: string | null | undefined;
            allowTransportableEdits?: boolean | null | undefined;
            allowedPackages?: string | null | undefined;
            allowExecution?: boolean | null | undefined;
            allowBatchWrites?: boolean | null | undefined;
        } & import("@deepseek-ai/cosmokit").Dict) | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        name: z<string, string>;
        /** Scheme + host + port, e.g. `https://sap.example.com:443`. */
        url: z<string, string>;
        /** SAP client (mandant). */
        client: z<string, string>;
        /** Logon language, e.g. `EN`, `ZH`. */
        language: z<string, string>;
        username: z<string, string>;
        /** Static password (prefer `passwordEnv` / env var conventions). */
        password: z<string, string>;
        /** Name of the environment variable holding the password. */
        passwordEnv: z<string, string>;
        strictSSL: z<boolean, boolean>;
        timeoutMs: z<number, number>;
        /** Destination-level policy overrides (see policy.ts for semantics). */
        policy: z<Schemastery.ObjectS<{
            enableTransports: z<boolean, boolean>;
            allowedTransports: z<string, string>;
            allowTransportableEdits: z<boolean, boolean>;
            allowedPackages: z<string, string>;
            allowExecution: z<boolean, boolean>;
            allowBatchWrites: z<boolean, boolean>;
        }>, Schemastery.ObjectT<{
            enableTransports: z<boolean, boolean>;
            allowedTransports: z<string, string>;
            allowTransportableEdits: z<boolean, boolean>;
            allowedPackages: z<string, string>;
            allowExecution: z<boolean, boolean>;
            allowBatchWrites: z<boolean, boolean>;
        }>>;
    }>[]>;
}>, Schemastery.ObjectT<{
    /**
     * Authoritative external config file (team-shared destinations / permission
     * policy). `~` is expanded; relative paths anchor to the dsh home. Its path
     * may come from the composition row or the settings user section.
     */
    configFile: z<string, string>;
    /** In-process demo destination backed by the mock ADT server (default on). */
    demo: z<boolean, boolean>;
    demoPort: z<number, number>;
    /** Default destination name used by tools when none is given. */
    defaultDestination: z<string, string>;
    /**
     * GLOBAL permission-policy defaults. These apply to every destination
     * without its own `policy:` block; a destination-level `policy:` entry
     * overrides them key by key. Each key is optional: when absent everywhere,
     * the corresponding `SAP_*` environment variable applies, then the built-in
     * default (see `src/policy.ts`).
     */
    /** Allow the transport tool family and transport usage (env: SAP_ENABLE_TRANSPORTS). */
    enableTransports: z<boolean, boolean>;
    /** Comma-separated glob list of allowed transport request numbers, e.g. `D01K96*` (env: SAP_ALLOWED_TRANSPORTS). */
    allowedTransports: z<string, string>;
    /** Allow edits (write/create/delete/activate) on transportable (non-$TMP) packages (env: SAP_ALLOW_TRANSPORTABLE_EDITS). */
    allowTransportableEdits: z<boolean, boolean>;
    /** Comma-separated glob list of packages that may be edited, e.g. `Z*,$TMP` (env: SAP_ALLOWED_PACKAGES). */
    allowedPackages: z<string, string>;
    /** Allow running programs / classrun classes via adt_execute (env: SAP_ALLOW_EXECUTION). */
    allowExecution: z<boolean, boolean>;
    /** Allow write parts (POST/PUT) inside adt_batch — off by default (env: SAP_ALLOW_BATCH_WRITES). */
    allowBatchWrites: z<boolean, boolean>;
    destinations: z<({
        name?: string | null | undefined;
        url?: string | null | undefined;
        client?: string | null | undefined;
        language?: string | null | undefined;
        username?: string | null | undefined;
        password?: string | null | undefined;
        passwordEnv?: string | null | undefined;
        strictSSL?: boolean | null | undefined;
        timeoutMs?: number | null | undefined;
        policy?: ({
            enableTransports?: boolean | null | undefined;
            allowedTransports?: string | null | undefined;
            allowTransportableEdits?: boolean | null | undefined;
            allowedPackages?: string | null | undefined;
            allowExecution?: boolean | null | undefined;
            allowBatchWrites?: boolean | null | undefined;
        } & import("@deepseek-ai/cosmokit").Dict) | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<{
        name: z<string, string>;
        /** Scheme + host + port, e.g. `https://sap.example.com:443`. */
        url: z<string, string>;
        /** SAP client (mandant). */
        client: z<string, string>;
        /** Logon language, e.g. `EN`, `ZH`. */
        language: z<string, string>;
        username: z<string, string>;
        /** Static password (prefer `passwordEnv` / env var conventions). */
        password: z<string, string>;
        /** Name of the environment variable holding the password. */
        passwordEnv: z<string, string>;
        strictSSL: z<boolean, boolean>;
        timeoutMs: z<number, number>;
        /** Destination-level policy overrides (see policy.ts for semantics). */
        policy: z<Schemastery.ObjectS<{
            enableTransports: z<boolean, boolean>;
            allowedTransports: z<string, string>;
            allowTransportableEdits: z<boolean, boolean>;
            allowedPackages: z<string, string>;
            allowExecution: z<boolean, boolean>;
            allowBatchWrites: z<boolean, boolean>;
        }>, Schemastery.ObjectT<{
            enableTransports: z<boolean, boolean>;
            allowedTransports: z<string, string>;
            allowTransportableEdits: z<boolean, boolean>;
            allowedPackages: z<string, string>;
            allowExecution: z<boolean, boolean>;
            allowBatchWrites: z<boolean, boolean>;
        }>>;
    }>[]>;
}>>;
export type DestinationConfig = Schemastery.TypeT<typeof destinationSchema>;
export type PluginConfig = Schemastery.TypeT<typeof Config>;
/** Fully-resolved config handed to `AdtRegistry` (non-policy keys always set). */
export interface EffectiveConfig {
    demo: boolean;
    demoPort: number;
    defaultDestination: string;
    destinations: DestinationConfig[];
    enableTransports?: boolean;
    allowedTransports?: string;
    allowTransportableEdits?: boolean;
    allowedPackages?: string;
    allowExecution?: boolean;
    allowBatchWrites?: boolean;
    /** Explicitly configured external file (informational; lowest layer that sets it wins). */
    configFile?: string;
    /** Path of the external file that contributed config (for the startup log). */
    configFileUsed?: string;
}
/** Default external config file name inside the dsh home directory. */
export declare const DEFAULT_CONFIG_FILE = "abap-adt.yml";
/**
 * Workspace-scoped config: every session has a working directory (its
 * "workspace", `exec.agent.session.header.cwd`), and destinations configured
 * there are private to that workspace — e.g.
 * `<workspace>/.dsh-abap-adt/destinations.yaml`. This is the nearest config
 * layer: it overrides the settings user section for `destinations` (merged by
 * name, workspace wins), `defaultDestination`, and permission-policy keys.
 */
export declare const WORKSPACE_CONFIG_DIR = ".dsh-abap-adt";
/** Candidate file names inside the workspace config dir, first hit wins. */
export declare const WORKSPACE_CONFIG_FILES: readonly ["destinations.yaml", "destinations.yml"];
/**
 * Resolve the workspace config file candidates for a workspace root
 * (`<cwd>/.dsh-abap-adt/destinations.yaml`, then `.yml`).
 */
export declare function workspaceConfigCandidates(cwd: string): string[];
/**
 * The workspace config file for a cwd: the first existing candidate, or the
 * primary candidate when none exists yet (so creators can pre-resolve the
 * path they are about to write).
 */
export declare function workspaceConfigPath(cwd: string): string;
/** Built-in defaults, applied last (mirrors the schema defaults above). */
export declare function builtinDefaults(): EffectiveConfig;
/** The dsh home directory: `${DSH_HOME}` or `~/.dsh`. */
export declare function dshHome(): string;
/** Expand a leading `~` to the user home directory (POSIX-style, works on Windows too). */
export declare function expandHomePath(p: string): string;
/** Resolve a config file path: expand `~`, anchor relative paths to the dsh home. */
export declare function resolveConfigFilePath(p: string): string;
/**
 * Path of the DEPRECATED auto-discovered config file (existence not checked).
 * Kept one release for migration; its contents now belong in the `abap-adt:`
 * section of `${DSH_HOME:-~/.dsh}/settings.yaml`.
 */
export declare function autoDiscoverConfigFile(): string;
/**
 * Pure nearest-wins composition of config layers, lowest first. Scalar keys:
 * the last layer that sets a key wins. `destinations` merge by `name` across
 * every layer — a same-name entry in a later layer replaces the earlier one,
 * new names are appended (so a shipped `destinations: []` never masks another
 * layer). Policy keys stay `undefined` when absent in every layer, leaving
 * them to the `SAP_*` env fallback in `AdtPolicy.resolve`.
 */
export declare function composeLayers(layers: Array<Partial<PluginConfig> | undefined>): EffectiveConfig;
/**
 * Validate a parsed external config document (shared by the async file
 * loader and the sync workspace loader). Throws with the path in the message
 * on shape errors; returns `{}` for an empty document.
 */
export declare function validateExternalConfig(parsed: unknown, path: string): Partial<PluginConfig>;
/**
 * Read and validate an external config file. Throws with the path in the
 * message on YAML/shape errors (a broken config should fail loudly);
 * returns an empty object for an empty file.
 */
export declare function loadExternalConfigFile(path: string): Promise<Partial<PluginConfig>>;
/** Parse + validate config file text (shared by async and sync loaders). */
export declare function parseExternalConfigText(raw: string, path: string): Partial<PluginConfig>;
/** Inputs to {@link resolveEffectiveConfig}. */
export interface EffectiveSource {
    /** Composition entry: the plugin row's `config:` block (namespace `base`). */
    entry: PluginConfig;
    /**
     * Settings-resolved value (schema defaults + base + the user section from
     * `~/.dsh/settings.yaml`). Omit when no settings service is mounted — the
     * entry alone is then the composition layer, exactly as composed.
     */
    resolved?: PluginConfig;
}
/**
 * Resolve the effective plugin config across all layers (nearest wins):
 * schema defaults < composition entry < legacy file < settings user section <
 * explicit `configFile`. The legacy `${DSH_HOME:-~/.dsh}/abap-adt.yml` is
 * auto-discovered and warns when present (deprecated). A missing explicitly
 * configured file is a warning, not an error — the plugin stays usable.
 */
export declare function resolveEffectiveConfig(source: EffectiveSource): Promise<{
    config: EffectiveConfig;
    warnings: string[];
}>;
/**
 * Resolves a destination's password reference names, in priority order:
 * the explicit `passwordEnv`, else the `ADT_<NAME>_PASSWORD` convention,
 * with `ADT_PASSWORD` as the shared fallback.
 */
export declare function passwordRefNames(dest: {
    passwordEnv?: string;
    name: string;
}): string[];
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
export declare function resolvePassword(dest: {
    password?: string;
    passwordEnv?: string;
    name: string;
}, resolver?: (ref: string) => Promise<string | undefined>): Promise<string>;
export {};
//# sourceMappingURL=config.d.ts.map