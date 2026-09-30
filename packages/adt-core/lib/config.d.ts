/**
 * Plugin configuration schema (schemastery) and the config-layering
 * pipeline.
 *
 * Hosts compose this schema with their own config model: the DSH adapter
 * wraps it `.volatile()` so the composition row config parses into a live
 * reference (settings edits commit in place and hot-reload the registry,
 * DSH ≥ 0.2.0); AgentChat and other hosts read it plainly. The effective
 * config resolves nearest-wins:
 *
 *   1. schema defaults (lowest) — demo on, port 8123, defaultDestination demo
 *   2. composition row config — the plugin row's `config:` block (preset /
 *      profile patch)
 *   3. legacy file — auto-discovered `${DSH_HOME:-~/.dsh}/abap-adt.yml`
 *      (DEPRECATED: kept one release for migration; warns when present)
 *   4. explicit `configFile` — authoritative team-shared override; its path
 *      comes from any lower layer
 *   5. workspace file — `<session cwd>/<host config dir>/destinations.yaml`
 *      (nearest; per-session, resolved at tool-call time because the preset
 *      mount is shared across sessions — see registry.ts viewFor())
 *
 * Policy keys (`enableTransports` / `allowedTransports` /
 * `allowTransportableEdits` / `allowedPackages`) deliberately carry NO schema
 * default: when absent in every layer the `SAP_*` environment variables apply
 * (see policy.ts), and only then the built-in defaults there.
 */
import z from '@deepseek-ai/schemastery';
declare const destinationSchema: z<Schemastery.ObjectS<NoInfer<{
    name: z<string, string, "defined">;
    /** Scheme + host + port, e.g. `https://sap.example.com:443`. */
    url: z<string, string, "defined">;
    /**
     * Free-text description of the connection (what the system is for, which
     * project/team/landscape it belongs to). Shown by adt_list_destinations
     * so an agent can pick the right destination for a task — write it for
     * your future self, not for the machine.
     */
    description: z<string, string, "plain">;
    /** SAP client (mandant). */
    client: z<string, string, "plain">;
    /** Logon language, e.g. `EN`, `ZH`. */
    language: z<string, string, "plain">;
    username: z<string, string, "plain">;
    /** Static password (prefer `passwordEnv` / env var conventions). */
    password: z<string, string, "plain">;
    /** Name of the environment variable holding the password. */
    passwordEnv: z<string, string, "plain">;
    strictSSL: z<boolean, boolean, "defined">;
    timeoutMs: z<number, number, "defined">;
    /**
     * Environment profile of this destination (see policy.ts): `dev` (default)
     * keeps the plain knob semantics; `qa` defaults execution/batch writes to
     * off; `prd` hard-denies them regardless of configuration.
     */
    profile: z<"dev" | "qa" | "prd", "dev" | "qa" | "prd", "plain">;
    /** Destination-level policy overrides (see policy.ts for semantics). */
    policy: z<Schemastery.ObjectS<NoInfer<{
        enableTransports: z<boolean, boolean, "plain">;
        allowedTransports: z<string, string, "plain">;
        allowTransportableEdits: z<boolean, boolean, "plain">;
        allowedPackages: z<string, string, "plain">;
        allowExecution: z<boolean, boolean, "plain">;
        allowBatchWrites: z<boolean, boolean, "plain">;
        blockedTablesProfile: z<"off" | "minimal" | "standard" | "strict", "off" | "minimal" | "standard" | "strict", "plain">;
        blockedTables: z<string[], string[], "plain">;
        allowedTables: z<string[], string[], "plain">;
        allowDebugger: z<boolean, boolean, "plain">;
        allowDebugVariables: z<boolean, boolean, "plain">;
    }>>, Schemastery.ObjectT<NoInfer<{
        enableTransports: z<boolean, boolean, "plain">;
        allowedTransports: z<string, string, "plain">;
        allowTransportableEdits: z<boolean, boolean, "plain">;
        allowedPackages: z<string, string, "plain">;
        allowExecution: z<boolean, boolean, "plain">;
        allowBatchWrites: z<boolean, boolean, "plain">;
        blockedTablesProfile: z<"off" | "minimal" | "standard" | "strict", "off" | "minimal" | "standard" | "strict", "plain">;
        blockedTables: z<string[], string[], "plain">;
        allowedTables: z<string[], string[], "plain">;
        allowDebugger: z<boolean, boolean, "plain">;
        allowDebugVariables: z<boolean, boolean, "plain">;
    }>>, "plain">;
}>>, Schemastery.ObjectT<NoInfer<{
    name: z<string, string, "defined">;
    /** Scheme + host + port, e.g. `https://sap.example.com:443`. */
    url: z<string, string, "defined">;
    /**
     * Free-text description of the connection (what the system is for, which
     * project/team/landscape it belongs to). Shown by adt_list_destinations
     * so an agent can pick the right destination for a task — write it for
     * your future self, not for the machine.
     */
    description: z<string, string, "plain">;
    /** SAP client (mandant). */
    client: z<string, string, "plain">;
    /** Logon language, e.g. `EN`, `ZH`. */
    language: z<string, string, "plain">;
    username: z<string, string, "plain">;
    /** Static password (prefer `passwordEnv` / env var conventions). */
    password: z<string, string, "plain">;
    /** Name of the environment variable holding the password. */
    passwordEnv: z<string, string, "plain">;
    strictSSL: z<boolean, boolean, "defined">;
    timeoutMs: z<number, number, "defined">;
    /**
     * Environment profile of this destination (see policy.ts): `dev` (default)
     * keeps the plain knob semantics; `qa` defaults execution/batch writes to
     * off; `prd` hard-denies them regardless of configuration.
     */
    profile: z<"dev" | "qa" | "prd", "dev" | "qa" | "prd", "plain">;
    /** Destination-level policy overrides (see policy.ts for semantics). */
    policy: z<Schemastery.ObjectS<NoInfer<{
        enableTransports: z<boolean, boolean, "plain">;
        allowedTransports: z<string, string, "plain">;
        allowTransportableEdits: z<boolean, boolean, "plain">;
        allowedPackages: z<string, string, "plain">;
        allowExecution: z<boolean, boolean, "plain">;
        allowBatchWrites: z<boolean, boolean, "plain">;
        blockedTablesProfile: z<"off" | "minimal" | "standard" | "strict", "off" | "minimal" | "standard" | "strict", "plain">;
        blockedTables: z<string[], string[], "plain">;
        allowedTables: z<string[], string[], "plain">;
        allowDebugger: z<boolean, boolean, "plain">;
        allowDebugVariables: z<boolean, boolean, "plain">;
    }>>, Schemastery.ObjectT<NoInfer<{
        enableTransports: z<boolean, boolean, "plain">;
        allowedTransports: z<string, string, "plain">;
        allowTransportableEdits: z<boolean, boolean, "plain">;
        allowedPackages: z<string, string, "plain">;
        allowExecution: z<boolean, boolean, "plain">;
        allowBatchWrites: z<boolean, boolean, "plain">;
        blockedTablesProfile: z<"off" | "minimal" | "standard" | "strict", "off" | "minimal" | "standard" | "strict", "plain">;
        blockedTables: z<string[], string[], "plain">;
        allowedTables: z<string[], string[], "plain">;
        allowDebugger: z<boolean, boolean, "plain">;
        allowDebugVariables: z<boolean, boolean, "plain">;
    }>>, "plain">;
}>>, "plain">;
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    /**
     * Authoritative external config file (team-shared destinations / permission
     * policy). `~` is expanded; relative paths anchor to the dsh home. Its path
     * may come from the composition row or the settings user section.
     */
    configFile: z<string, string, "plain">;
    /** In-process demo destination backed by the mock ADT server (default on). */
    demo: z<boolean, boolean, "defined">;
    demoPort: z<number, number, "defined">;
    /** Default destination name used by tools when none is given. */
    defaultDestination: z<string, string, "defined">;
    /**
     * GLOBAL permission-policy defaults. These apply to every destination
     * without its own `policy:` block; a destination-level `policy:` entry
     * overrides them key by key. Each key is optional: when absent everywhere,
     * the corresponding `SAP_*` environment variable applies, then the built-in
     * default (see `src/policy.ts`).
     */
    /** Allow the transport tool family and transport usage (env: SAP_ENABLE_TRANSPORTS). */
    enableTransports: z<boolean, boolean, "plain">;
    /** Comma-separated glob list of allowed transport request numbers, e.g. `D01K96*` (env: SAP_ALLOWED_TRANSPORTS). */
    allowedTransports: z<string, string, "plain">;
    /** Allow edits (write/create/delete/activate) on transportable (non-$TMP) packages (env: SAP_ALLOW_TRANSPORTABLE_EDITS). */
    allowTransportableEdits: z<boolean, boolean, "plain">;
    /** Comma-separated glob list of packages that may be edited, e.g. `Z*,$TMP` (env: SAP_ALLOWED_PACKAGES). */
    allowedPackages: z<string, string, "plain">;
    /** Allow running programs / classrun classes via adt_execute (env: SAP_ALLOW_EXECUTION). */
    allowExecution: z<boolean, boolean, "plain">;
    /** Allow write parts (POST/PUT) inside adt_batch — off by default (env: SAP_ALLOW_BATCH_WRITES). */
    allowBatchWrites: z<boolean, boolean, "plain">;
    /** Read-side governance profile for row reads (off|minimal|standard|strict; default off; env: SAP_BLOCKED_TABLES_PROFILE). */
    blockedTablesProfile: z<"off" | "minimal" | "standard" | "strict", "off" | "minimal" | "standard" | "strict", "plain">;
    /** Extra blocked table names/patterns added on top of the catalog (env: SAP_BLOCKED_TABLES, comma-separated). */
    blockedTables: z<string[], string[], "plain">;
    /** Exemptions from the blocked-table catalog — audited on every use (env: SAP_ALLOWED_TABLES, comma-separated). */
    allowedTables: z<string[], string[], "plain">;
    /** Allow the ABAP debugger tool family (adt_debug_*) — off by default (env: SAP_ALLOW_DEBUGGER). */
    allowDebugger: z<boolean, boolean, "plain">;
    /** Allow changing debuggee variable values in the debugger — double opt-in (env: SAP_ALLOW_DEBUG_VARIABLES). */
    allowDebugVariables: z<boolean, boolean, "plain">;
    destinations: z<({
        name?: string | null | undefined;
        url?: string | null | undefined;
        description?: string | null | undefined;
        client?: string | null | undefined;
        language?: string | null | undefined;
        username?: string | null | undefined;
        password?: string | null | undefined;
        passwordEnv?: string | null | undefined;
        strictSSL?: boolean | null | undefined;
        timeoutMs?: number | null | undefined;
        profile?: "dev" | "qa" | "prd" | null | undefined;
        policy?: ({
            enableTransports?: boolean | null | undefined;
            allowedTransports?: string | null | undefined;
            allowTransportableEdits?: boolean | null | undefined;
            allowedPackages?: string | null | undefined;
            allowExecution?: boolean | null | undefined;
            allowBatchWrites?: boolean | null | undefined;
            blockedTablesProfile?: "off" | "minimal" | "standard" | "strict" | null | undefined;
            blockedTables?: string[] | null | undefined;
            allowedTables?: string[] | null | undefined;
            allowDebugger?: boolean | null | undefined;
            allowDebugVariables?: boolean | null | undefined;
        } & import("@deepseek-ai/cosmokit").Dict) | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<NoInfer<{
        name: z<string, string, "defined">;
        /** Scheme + host + port, e.g. `https://sap.example.com:443`. */
        url: z<string, string, "defined">;
        /**
         * Free-text description of the connection (what the system is for, which
         * project/team/landscape it belongs to). Shown by adt_list_destinations
         * so an agent can pick the right destination for a task — write it for
         * your future self, not for the machine.
         */
        description: z<string, string, "plain">;
        /** SAP client (mandant). */
        client: z<string, string, "plain">;
        /** Logon language, e.g. `EN`, `ZH`. */
        language: z<string, string, "plain">;
        username: z<string, string, "plain">;
        /** Static password (prefer `passwordEnv` / env var conventions). */
        password: z<string, string, "plain">;
        /** Name of the environment variable holding the password. */
        passwordEnv: z<string, string, "plain">;
        strictSSL: z<boolean, boolean, "defined">;
        timeoutMs: z<number, number, "defined">;
        /**
         * Environment profile of this destination (see policy.ts): `dev` (default)
         * keeps the plain knob semantics; `qa` defaults execution/batch writes to
         * off; `prd` hard-denies them regardless of configuration.
         */
        profile: z<"dev" | "qa" | "prd", "dev" | "qa" | "prd", "plain">;
        /** Destination-level policy overrides (see policy.ts for semantics). */
        policy: z<Schemastery.ObjectS<NoInfer<{
            enableTransports: z<boolean, boolean, "plain">;
            allowedTransports: z<string, string, "plain">;
            allowTransportableEdits: z<boolean, boolean, "plain">;
            allowedPackages: z<string, string, "plain">;
            allowExecution: z<boolean, boolean, "plain">;
            allowBatchWrites: z<boolean, boolean, "plain">;
            blockedTablesProfile: z<"off" | "minimal" | "standard" | "strict", "off" | "minimal" | "standard" | "strict", "plain">;
            blockedTables: z<string[], string[], "plain">;
            allowedTables: z<string[], string[], "plain">;
            allowDebugger: z<boolean, boolean, "plain">;
            allowDebugVariables: z<boolean, boolean, "plain">;
        }>>, Schemastery.ObjectT<NoInfer<{
            enableTransports: z<boolean, boolean, "plain">;
            allowedTransports: z<string, string, "plain">;
            allowTransportableEdits: z<boolean, boolean, "plain">;
            allowedPackages: z<string, string, "plain">;
            allowExecution: z<boolean, boolean, "plain">;
            allowBatchWrites: z<boolean, boolean, "plain">;
            blockedTablesProfile: z<"off" | "minimal" | "standard" | "strict", "off" | "minimal" | "standard" | "strict", "plain">;
            blockedTables: z<string[], string[], "plain">;
            allowedTables: z<string[], string[], "plain">;
            allowDebugger: z<boolean, boolean, "plain">;
            allowDebugVariables: z<boolean, boolean, "plain">;
        }>>, "plain">;
    }>>[], "plain">;
}>>, Schemastery.ObjectT<NoInfer<{
    /**
     * Authoritative external config file (team-shared destinations / permission
     * policy). `~` is expanded; relative paths anchor to the dsh home. Its path
     * may come from the composition row or the settings user section.
     */
    configFile: z<string, string, "plain">;
    /** In-process demo destination backed by the mock ADT server (default on). */
    demo: z<boolean, boolean, "defined">;
    demoPort: z<number, number, "defined">;
    /** Default destination name used by tools when none is given. */
    defaultDestination: z<string, string, "defined">;
    /**
     * GLOBAL permission-policy defaults. These apply to every destination
     * without its own `policy:` block; a destination-level `policy:` entry
     * overrides them key by key. Each key is optional: when absent everywhere,
     * the corresponding `SAP_*` environment variable applies, then the built-in
     * default (see `src/policy.ts`).
     */
    /** Allow the transport tool family and transport usage (env: SAP_ENABLE_TRANSPORTS). */
    enableTransports: z<boolean, boolean, "plain">;
    /** Comma-separated glob list of allowed transport request numbers, e.g. `D01K96*` (env: SAP_ALLOWED_TRANSPORTS). */
    allowedTransports: z<string, string, "plain">;
    /** Allow edits (write/create/delete/activate) on transportable (non-$TMP) packages (env: SAP_ALLOW_TRANSPORTABLE_EDITS). */
    allowTransportableEdits: z<boolean, boolean, "plain">;
    /** Comma-separated glob list of packages that may be edited, e.g. `Z*,$TMP` (env: SAP_ALLOWED_PACKAGES). */
    allowedPackages: z<string, string, "plain">;
    /** Allow running programs / classrun classes via adt_execute (env: SAP_ALLOW_EXECUTION). */
    allowExecution: z<boolean, boolean, "plain">;
    /** Allow write parts (POST/PUT) inside adt_batch — off by default (env: SAP_ALLOW_BATCH_WRITES). */
    allowBatchWrites: z<boolean, boolean, "plain">;
    /** Read-side governance profile for row reads (off|minimal|standard|strict; default off; env: SAP_BLOCKED_TABLES_PROFILE). */
    blockedTablesProfile: z<"off" | "minimal" | "standard" | "strict", "off" | "minimal" | "standard" | "strict", "plain">;
    /** Extra blocked table names/patterns added on top of the catalog (env: SAP_BLOCKED_TABLES, comma-separated). */
    blockedTables: z<string[], string[], "plain">;
    /** Exemptions from the blocked-table catalog — audited on every use (env: SAP_ALLOWED_TABLES, comma-separated). */
    allowedTables: z<string[], string[], "plain">;
    /** Allow the ABAP debugger tool family (adt_debug_*) — off by default (env: SAP_ALLOW_DEBUGGER). */
    allowDebugger: z<boolean, boolean, "plain">;
    /** Allow changing debuggee variable values in the debugger — double opt-in (env: SAP_ALLOW_DEBUG_VARIABLES). */
    allowDebugVariables: z<boolean, boolean, "plain">;
    destinations: z<({
        name?: string | null | undefined;
        url?: string | null | undefined;
        description?: string | null | undefined;
        client?: string | null | undefined;
        language?: string | null | undefined;
        username?: string | null | undefined;
        password?: string | null | undefined;
        passwordEnv?: string | null | undefined;
        strictSSL?: boolean | null | undefined;
        timeoutMs?: number | null | undefined;
        profile?: "dev" | "qa" | "prd" | null | undefined;
        policy?: ({
            enableTransports?: boolean | null | undefined;
            allowedTransports?: string | null | undefined;
            allowTransportableEdits?: boolean | null | undefined;
            allowedPackages?: string | null | undefined;
            allowExecution?: boolean | null | undefined;
            allowBatchWrites?: boolean | null | undefined;
            blockedTablesProfile?: "off" | "minimal" | "standard" | "strict" | null | undefined;
            blockedTables?: string[] | null | undefined;
            allowedTables?: string[] | null | undefined;
            allowDebugger?: boolean | null | undefined;
            allowDebugVariables?: boolean | null | undefined;
        } & import("@deepseek-ai/cosmokit").Dict) | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[], Schemastery.ObjectT<NoInfer<{
        name: z<string, string, "defined">;
        /** Scheme + host + port, e.g. `https://sap.example.com:443`. */
        url: z<string, string, "defined">;
        /**
         * Free-text description of the connection (what the system is for, which
         * project/team/landscape it belongs to). Shown by adt_list_destinations
         * so an agent can pick the right destination for a task — write it for
         * your future self, not for the machine.
         */
        description: z<string, string, "plain">;
        /** SAP client (mandant). */
        client: z<string, string, "plain">;
        /** Logon language, e.g. `EN`, `ZH`. */
        language: z<string, string, "plain">;
        username: z<string, string, "plain">;
        /** Static password (prefer `passwordEnv` / env var conventions). */
        password: z<string, string, "plain">;
        /** Name of the environment variable holding the password. */
        passwordEnv: z<string, string, "plain">;
        strictSSL: z<boolean, boolean, "defined">;
        timeoutMs: z<number, number, "defined">;
        /**
         * Environment profile of this destination (see policy.ts): `dev` (default)
         * keeps the plain knob semantics; `qa` defaults execution/batch writes to
         * off; `prd` hard-denies them regardless of configuration.
         */
        profile: z<"dev" | "qa" | "prd", "dev" | "qa" | "prd", "plain">;
        /** Destination-level policy overrides (see policy.ts for semantics). */
        policy: z<Schemastery.ObjectS<NoInfer<{
            enableTransports: z<boolean, boolean, "plain">;
            allowedTransports: z<string, string, "plain">;
            allowTransportableEdits: z<boolean, boolean, "plain">;
            allowedPackages: z<string, string, "plain">;
            allowExecution: z<boolean, boolean, "plain">;
            allowBatchWrites: z<boolean, boolean, "plain">;
            blockedTablesProfile: z<"off" | "minimal" | "standard" | "strict", "off" | "minimal" | "standard" | "strict", "plain">;
            blockedTables: z<string[], string[], "plain">;
            allowedTables: z<string[], string[], "plain">;
            allowDebugger: z<boolean, boolean, "plain">;
            allowDebugVariables: z<boolean, boolean, "plain">;
        }>>, Schemastery.ObjectT<NoInfer<{
            enableTransports: z<boolean, boolean, "plain">;
            allowedTransports: z<string, string, "plain">;
            allowTransportableEdits: z<boolean, boolean, "plain">;
            allowedPackages: z<string, string, "plain">;
            allowExecution: z<boolean, boolean, "plain">;
            allowBatchWrites: z<boolean, boolean, "plain">;
            blockedTablesProfile: z<"off" | "minimal" | "standard" | "strict", "off" | "minimal" | "standard" | "strict", "plain">;
            blockedTables: z<string[], string[], "plain">;
            allowedTables: z<string[], string[], "plain">;
            allowDebugger: z<boolean, boolean, "plain">;
            allowDebugVariables: z<boolean, boolean, "plain">;
        }>>, "plain">;
    }>>[], "plain">;
}>>, "plain">;
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
    blockedTablesProfile?: string;
    blockedTables?: string[];
    allowedTables?: string[];
    allowDebugger?: boolean;
    allowDebugVariables?: boolean;
    /** Explicitly configured external file (informational; lowest layer that sets it wins). */
    configFile?: string;
    /** Path of the external file that contributed config (for the startup log). */
    configFileUsed?: string;
}
/**
 * Workspace-scoped config: every session has a working directory (its
 * "workspace", `exec.agent.session.header.cwd`), and destinations configured
 * there are private to that workspace — e.g.
 * `<workspace>/<config dir>/destinations.yaml`. The config DIR is a host
 * property: hosts declare theirs via `HostProfile.workspaceConfigDir`
 * (DSH: '.dsh-abap-adt', other hosts their own); the default below keeps
 * undeclared hosts and existing workspaces working unchanged.
 */
export declare const DEFAULT_WORKSPACE_CONFIG_DIR = ".dsh-abap-adt";
/**
 * Resolve the workspace config file candidates for a workspace root, inside
 * `configDir` (the host-declared workspace config directory, default
 * '.dsh-abap-adt'): `<cwd>/<configDir>/destinations.yaml`, then `.yml`.
 */
export declare function workspaceConfigCandidates(cwd: string, configDir?: string): string[];
/**
 * The workspace config file for a cwd: the first existing candidate, or the
 * primary candidate when none exists yet (so creators can pre-resolve the
 * path they are about to write).
 */
export declare function workspaceConfigPath(cwd: string, configDir?: string): string;
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
/** Parse config-file text RAW (no validation): throws with the path in the
 *  message on invalid YAML; null/undefined documents stay as-is. Shared by
 *  the validating config loader and the raw workspace-layer parser. */
export declare function parseYamlDocument(raw: string, path: string): unknown;
/** Parse + validate config file text (shared by async and sync loaders). */
export declare function parseExternalConfigText(raw: string, path: string): Partial<PluginConfig>;
/** Inputs to {@link resolveEffectiveConfig}. */
interface EffectiveSource {
    /** Composition entry: the plugin row's `config:` block (live volatile reference). */
    entry: PluginConfig;
    /**
     * Higher overlay the caller resolved on top of the entry. Omit when the
     * entry alone is the composition layer, exactly as composed — the DSH
     * adapter passes only the entry (settings overlays live IN the volatile
     * entry reference itself since DSH 0.2.0); other hosts may compose their
     * own resolved layer here.
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