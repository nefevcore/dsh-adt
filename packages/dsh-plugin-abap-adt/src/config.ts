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
  password: z.string(),
  /** Name of the environment variable holding the password. */
  passwordEnv: z.string(),
  strictSSL: z.boolean().default(true),
  timeoutMs: z.number().default(60_000),
});

export const Config = z.object({
  /**
   * External config file holding destinations / permission policy, so the
   * composition (agent.cordis.yml / cordis.patch.yml) stays stable. `~` is
   * expanded; relative paths anchor to the dsh home. Defaults to
   * `${DSH_HOME:-~/.dsh}/abap-adt.yml` when that file exists.
   */
  configFile: z.string(),
  /** Optional in-process demo destination backed by the mock ADT server. */
  demo: z.boolean(),
  demoPort: z.number(),
  /** Default destination name used by tools when none is given. */
  defaultDestination: z.string(),
  /**
   * Permission policy ("权限管控") knobs. Each is optional: when absent in
   * both inline config and the external file, the corresponding `SAP_*`
   * environment variable is consulted, then a built-in default. See
   * `src/policy.ts` for the full semantics.
   */
  /** Allow the transport tool family and transport usage (env: SAP_ENABLE_TRANSPORTS). */
  enableTransports: z.boolean(),
  /** Comma-separated glob list of allowed transport request numbers, e.g. `D01K96*` (env: SAP_ALLOWED_TRANSPORTS). */
  allowedTransports: z.string(),
  /** Allow edits (write/create/delete/activate) on transportable (non-$TMP) packages (env: SAP_ALLOW_TRANSPORTABLE_EDITS). */
  allowTransportableEdits: z.boolean(),
  /** Comma-separated glob list of packages that may be edited, e.g. `Z*,$TMP` (env: SAP_ALLOWED_PACKAGES). */
  allowedPackages: z.string(),
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
  /** Path of the external file that contributed config (for the startup log). */
  configFileUsed?: string;
}

/** Default external config file name inside the dsh home directory. */
export const DEFAULT_CONFIG_FILE = 'abap-adt.yml';

/** Built-in defaults, applied last (must match the values documented in README). */
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
  | 'allowedPackages';

const SCALAR_KEYS: readonly ScalarKey[] = [
  'demo',
  'demoPort',
  'defaultDestination',
  'enableTransports',
  'allowedTransports',
  'allowTransportableEdits',
  'allowedPackages',
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

/** Path of the auto-discovered external config file (existence not checked). */
export function autoDiscoverConfigFile(): string {
  return join(dshHome(), DEFAULT_CONFIG_FILE);
}

/**
 * Pure merge of config layers: inline > external file > built-in defaults.
 * `destinations` merge by `name` — a same-name inline entry replaces the file
 * entry, new names are appended (so a shipped `destinations: []` never masks
 * the file). Policy keys stay `undefined` when absent in both layers, leaving
 * them to the `SAP_*` env fallback in `AdtPolicy.resolve`.
 */
export function mergeConfig(
  inline: Partial<PluginConfig>,
  file?: Partial<PluginConfig>,
): EffectiveConfig {
  const merged = builtinDefaults();
  // Scalar assignment goes through a widened record view: the loop variable
  // key is a union, so a direct `merged[key] = value` would be `never`.
  const target = merged as unknown as Record<ScalarKey, string | number | boolean>;
  const applyLayer = (src: Partial<PluginConfig> | undefined): void => {
    if (!src) return;
    for (const key of SCALAR_KEYS) {
      const value = src[key];
      if (value !== undefined) target[key] = value;
    }
  };
  applyLayer(file);
  applyLayer(inline);

  const byName = new Map<string, DestinationConfig>();
  for (const dest of file?.destinations ?? []) byName.set(dest.name, dest);
  for (const dest of inline.destinations ?? []) byName.set(dest.name, dest);
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
  }
  return validated;
}

/**
 * Resolve the effective plugin config from the inline config plus the
 * external file (explicit `configFile`, else auto-discovered). A missing
 * explicitly-configured file is a warning, not an error — the plugin stays
 * usable with inline config + defaults.
 */
export async function resolveEffectiveConfig(
  inline: PluginConfig,
): Promise<{ config: EffectiveConfig; warnings: string[] }> {
  const warnings: string[] = [];
  let file: Partial<PluginConfig> | undefined;
  let usedPath: string | undefined;

  if (inline.configFile) {
    const path = resolveConfigFilePath(inline.configFile);
    if (existsSync(path)) {
      file = await loadExternalConfigFile(path);
      usedPath = path;
    } else {
      warnings.push(`configFile not found, ignored: ${path}`);
    }
  } else {
    const path = autoDiscoverConfigFile();
    if (existsSync(path)) {
      file = await loadExternalConfigFile(path);
      usedPath = path;
    }
  }

  const config = mergeConfig(inline, file);
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
