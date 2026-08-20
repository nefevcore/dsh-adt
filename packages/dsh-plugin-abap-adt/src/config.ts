/**
 * Plugin configuration schema (schemastery) and the DSH-settings layering
 * pipeline.
 *
 * The plugin registers its Config schema as the `abap-adt` settings namespace
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

/**
 * Plugin configuration schema (schemastery), validated by the Cordis loader.
 *
 * Config resolution layers, nearest wins:
 *
 *   1. inline config — the plugin row's `config:` block (agent preset's
 *      `agent.cordis.yml` or the profile's `cordis.patch.yml`)
 *   2. external file — `configFile`; auto-discovered at
 *      `${DSH_HOME:-~/.dsh}/abap-adt.yml` when not set explicitly. Keeps
 *      system/permission settings out of the composition file.
 *   3. environment — `SAP_*` policy variables (see policy.ts)
 *   4. built-in defaults (`builtinDefaults` below)
 *
 * Top-level defaults are intentionally NOT declared in the schema: a schema
 * default is applied by the loader before the plugin sees the config, which
 * would make "unset" indistinguishable from "explicitly set to the default"
 * and silently defeat layer 2. `resolveEffectiveConfig` applies defaults
 * after merging instead.
 */

/**
 * Per-destination permission-policy override (all keys optional; each
 * overrides the global top-level value for THIS destination only).
 */
const policySchema = z.object({
  enableTransports: z.boolean(),
  allowedTransports: z.string(),
  allowTransportableEdits: z.boolean(),
  allowedPackages: z.string(),
  allowExecution: z.boolean(),
  allowBatchWrites: z.boolean(),
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
  destinations: z.array(destinationSchema),
});

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
export const DEFAULT_CONFIG_FILE = 'abap-adt.yml';

/** Built-in defaults, applied last (mirrors the schema defaults above). */
export function builtinDefaults(): EffectiveConfig {
  return {
    demo: true,
    demoPort: 8123,
    defaultDestination: 'demo',
    destinations: [],
  };
}

type ScalarKey =
  | 'demo'
  | 'demoPort'
  | 'defaultDestination'
  | 'enableTransports'
  | 'allowedTransports'
  | 'allowTransportableEdits'
  | 'allowedPackages'
  | 'allowExecution'
  | 'allowBatchWrites';

const SCALAR_KEYS: readonly ScalarKey[] = [
  'demo',
  'demoPort',
  'defaultDestination',
  'enableTransports',
  'allowedTransports',
  'allowTransportableEdits',
  'allowedPackages',
  'allowExecution',
  'allowBatchWrites',
];

const KNOWN_TOP_LEVEL_KEYS = new Set<string>([...SCALAR_KEYS, 'destinations', 'configFile']);
const KNOWN_DESTINATION_KEYS = new Set<string>([
  'name',
  'url',
  'client',
  'language',
  'username',
  'password',
  'passwordEnv',
  'strictSSL',
  'timeoutMs',
  'policy',
]);
const KNOWN_POLICY_KEYS = new Set<string>([
  'enableTransports',
  'allowedTransports',
  'allowTransportableEdits',
  'allowedPackages',
  'allowExecution',
  'allowBatchWrites',
]);

/** The dsh home directory: `${DSH_HOME}` or `~/.dsh`. */
export function dshHome(): string {
  return process.env.DSH_HOME || join(homedir(), '.dsh');
}

/** Expand a leading `~` to the user home directory (POSIX-style, works on Windows too). */
export function expandHomePath(p: string): string {
  if (p === '~') return homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return join(homedir(), p.slice(2));
  return p;
}

/** Resolve a config file path: expand `~`, anchor relative paths to the dsh home. */
export function resolveConfigFilePath(p: string): string {
  const expanded = expandHomePath(p);
  return isAbsolute(expanded) ? expanded : resolve(dshHome(), expanded);
}

/**
 * Path of the DEPRECATED auto-discovered config file (existence not checked).
 * Kept one release for migration; its contents now belong in the `abap-adt:`
 * section of `${DSH_HOME:-~/.dsh}/settings.yaml`.
 */
export function autoDiscoverConfigFile(): string {
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
export function composeLayers(layers: Array<Partial<PluginConfig> | undefined>): EffectiveConfig {
  const merged = builtinDefaults();
  // Scalar assignment goes through a widened record view: the loop variable
  // key is a union, so a direct `merged[key] = value` would be `never`.
  const target = merged as unknown as Record<ScalarKey, string | number | boolean>;
  const byName = new Map<string, DestinationConfig>();
  for (const layer of layers) {
    if (!layer) continue;
    for (const key of SCALAR_KEYS) {
      const value = layer[key];
      if (value !== undefined) target[key] = value;
    }
    // `configFile` rides along too (nearest layer that sets it wins) so the
    // first resolution pass can discover the explicit path.
    if (layer.configFile !== undefined) merged.configFile = layer.configFile;
    for (const dest of layer.destinations ?? []) byName.set(dest.name, dest);
  }
  merged.destinations = [...byName.values()];
  return merged;
}

/**
 * Read and validate an external config file. Throws with the path in the
 * message on YAML/shape errors (a broken config should fail loudly);
 * returns an empty object for an empty file.
 */
export async function loadExternalConfigFile(path: string): Promise<Partial<PluginConfig>> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(`[abap-adt] cannot read config file ${path}: ${(error as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch (error) {
    throw new Error(`[abap-adt] invalid YAML in ${path}: ${(error as Error).message}`);
  }
  if (parsed === null || parsed === undefined) return {};
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      `[abap-adt] config file ${path} must be a YAML mapping (key: value), got ` +
        `${Array.isArray(parsed) ? 'a list' : typeof parsed}`,
    );
  }

  const unknown = Object.keys(parsed).filter((key) => !KNOWN_TOP_LEVEL_KEYS.has(key));
  if (unknown.length > 0) {
    throw new Error(
      `[abap-adt] unknown config keys in ${path}: ${unknown.join(', ')} ` +
        `(known keys: ${[...KNOWN_TOP_LEVEL_KEYS].join(', ')})`,
    );
  }

  // `configFile` inside the file would be self-referential; drop it silently.
  const picked = parsed as Record<string, unknown>;
  delete picked.configFile;

  let validated: PluginConfig;
  try {
    validated = Config(picked) as PluginConfig;
  } catch (error) {
    throw new Error(`[abap-adt] invalid config file ${path}: ${(error as Error).message}`);
  }

  for (const dest of validated.destinations ?? []) {
    const unknownDest = Object.keys(dest).filter((key) => !KNOWN_DESTINATION_KEYS.has(key));
    if (unknownDest.length > 0) {
      throw new Error(
        `[abap-adt] unknown destination keys in ${path} (destination "${dest.name}"): ` +
          `${unknownDest.join(', ')} (known keys: ${[...KNOWN_DESTINATION_KEYS].join(', ')})`,
      );
    }
    if (dest.policy) {
      const unknownPolicy = Object.keys(dest.policy).filter((key) => !KNOWN_POLICY_KEYS.has(key));
      if (unknownPolicy.length > 0) {
        throw new Error(
          `[abap-adt] unknown policy keys in ${path} (destination "${dest.name}"): ` +
            `${unknownPolicy.join(', ')} (known keys: ${[...KNOWN_POLICY_KEYS].join(', ')})`,
        );
      }
    }
  }
  return validated;
}

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
export async function resolveEffectiveConfig(
  source: EffectiveSource,
): Promise<{ config: EffectiveConfig; warnings: string[] }> {
  const warnings: string[] = [];

  // Legacy auto-discovered file (deprecated, migration window).
  let legacy: Partial<PluginConfig> | undefined;
  const legacyPath = autoDiscoverConfigFile();
  if (existsSync(legacyPath)) {
    legacy = await loadExternalConfigFile(legacyPath);
    warnings.push(
      `legacy config file ${legacyPath} is deprecated and will be removed in a future release; ` +
        'move its contents into the `abap-adt:` section of settings.yaml and delete the file',
    );
  }

  // First pass resolves the explicit configFile path from the lower layers.
  const lower = composeLayers([source.entry, legacy, source.resolved]);
  let file: Partial<PluginConfig> | undefined;
  let usedPath: string | undefined;
  if (lower.configFile) {
    const path = resolveConfigFilePath(lower.configFile);
    if (existsSync(path)) {
      file = await loadExternalConfigFile(path);
      usedPath = path;
    } else {
      warnings.push(`configFile not found, ignored: ${path}`);
    }
  }

  const config = composeLayers([source.entry, legacy, source.resolved, file]);
  if (usedPath) config.configFileUsed = usedPath;
  return { config, warnings };
}

/** Resolve the password for a destination: config > passwordEnv > convention. */
export function resolvePassword(
  dest: {
    password?: string;
    passwordEnv?: string;
    name: string;
  },
): string {
  if (dest.password) return dest.password;
  const envName = dest.passwordEnv ?? `ADT_${dest.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_PASSWORD`;
  const direct = process.env[envName];
  if (direct) return direct;
  return process.env.ADT_PASSWORD ?? '';
}
