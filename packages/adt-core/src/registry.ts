import { AdtClient, type AdtDestination } from '@nefevcore/abap-adt-protocol';
import { createMockAdtServer } from '@nefevcore/abap-adt-mock';
import type { DestinationConfig, EffectiveConfig, PluginConfig } from './config.js';
import { resolvePassword } from './config.js';
import { AdtPolicy, POLICY_KEYS } from './policy.js';
import type { PolicyInputs, PolicyKey } from './policy.js';
import { WorkspaceConfigStore, upsertDestination } from './workspace.js';

export interface RegistryDestination {
  config: AdtDestination;
  /** `true` when backed by the in-process mock server. */
  mock: boolean;
  client: AdtClient;
  /** Effective permission policy of THIS destination (global defaults overlaid
   *  with the destination's `policy:` block); swapped by reload(). */
  policy: AdtPolicy;
  /** Cached last ping result. */
  status?: { ok: boolean; detail?: string; checkedAt?: string };
}

/**
 * Destination table as one caller context sees it: the shared global registry
 * overlaid with the caller's workspace file
 * (`<cwd>/.dsh-abap-adt/destinations.yaml`). The plugin's preset mount is
 * standing (shared by every session on the preset), so per-workspace state
 * resolves at tool-call time through the session cwd, never on the registry
 * itself.
 */
interface RegistryView {
  destinations: Map<string, RegistryDestination>;
  /** Destination used when a tool call omits `destination` (workspace-aware). */
  defaultName: string;
  /** Workspace config file that contributed to this view, when one exists. */
  workspaceFile?: string;
}

/** Small non-crypto hash so passwords never sit in a cache key string. */
function hashSecret(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

/** Cap for cached workspace-layer clients (per-config-key AdtClient reuse). */
const CLIENT_CACHE_CAP = 64;

/** Async password resolution seam (see config.ts resolvePassword). */
type CredentialResolver = (ref: string) => Promise<string | undefined>;

/** Stable cache key over everything that shapes a built destination entry. */
function clientCacheKey(
  dest: DestinationConfig,
  inputs: PolicyInputs,
  password: string,
): string {
  return JSON.stringify({
    n: dest.name,
    u: dest.url,
    c: dest.client,
    l: dest.language,
    un: dest.username,
    pe: dest.passwordEnv,
    pw: hashSecret(password),
    ssl: dest.strictSSL,
    t: dest.timeoutMs,
    pol: dest.policy,
    prof: dest.profile,
    gi: inputs,
  });
}

/**
 * Owns the configured destinations and their live ADT clients. Also starts
 * the in-process mock ADT server when `demo` is enabled, so the whole tool
 * family works out of the box without any SAP system.
 */
export class AdtRegistry {
  readonly destinations = new Map<string, RegistryDestination>();
  /** Effective permission policy (config > SAP_* env > defaults); swapped by reload(). */
  policy: AdtPolicy;
  /** Destination used when a tool call omits `destination`. */
  defaultName = 'demo';
  private mockServer?: Awaited<ReturnType<typeof createMockAdtServer>>;
  private mockPort?: number;
  /** Top-level policy inputs (global defaults for every destination). */
  private globalPolicyInputs: PolicyInputs = {};
  /** Workspace file store (mtime-cached, per-tool-call layer). */
  private readonly workspace = new WorkspaceConfigStore();
  /** Client reuse for workspace-layer destinations, keyed by full config. */
  private readonly clientCache = new Map<string, RegistryDestination>();

  private constructor(
    policy: AdtPolicy,
    private readonly credentialResolver?: CredentialResolver,
  ) {
    this.policy = policy;
  }

  /** Accepts the fully-resolved config from `resolveEffectiveConfig`. */
  static async create(
    config: EffectiveConfig,
    options: { credentialResolver?: CredentialResolver } = {},
  ): Promise<AdtRegistry> {
    const registry = new AdtRegistry(AdtPolicy.resolve(config), options.credentialResolver);
    await registry.reload(config);
    return registry;
  }

  /**
   * Re-apply a resolved config in place (settings hot reload): swaps the
   * policy, rebuilds the destination table, and restarts the mock server
   * only when its flags actually changed. Object identity is stable, so
   * every tool holding this registry sees the new state.
   */
  async reload(config: EffectiveConfig): Promise<void> {
    const wantMock = config.demo;
    const mockChanged =
      (this.mockServer !== undefined) !== wantMock ||
      (wantMock && this.mockPort !== undefined && this.mockPort !== config.demoPort);
    if (mockChanged && this.mockServer) {
      await this.mockServer.close().catch(() => undefined);
      this.mockServer = undefined;
      this.mockPort = undefined;
      this.destinations.delete('demo');
    }
    if (wantMock && this.mockServer === undefined) {
      await this.startMock(config.demoPort);
    }

    // Global policy inputs (top-level keys) — each destination overlays its
    // own `policy:` block and its `profile` tier on these.
    this.globalPolicyInputs = {
      enableTransports: config.enableTransports,
      allowedTransports: config.allowedTransports,
      allowTransportableEdits: config.allowTransportableEdits,
      allowedPackages: config.allowedPackages,
      allowExecution: config.allowExecution,
      allowBatchWrites: config.allowBatchWrites,
      blockedTablesProfile: config.blockedTablesProfile,
      blockedTables: config.blockedTables,
      allowedTables: config.allowedTables,
      allowDebugger: config.allowDebugger,
      allowDebugVariables: config.allowDebugVariables,
    };

    // Rebuild the non-mock destinations (fresh clients; dropped names go away).
    for (const [name, entry] of [...this.destinations]) {
      if (!entry.mock) this.destinations.delete(name);
    }
    // Global layers changed: cached workspace entries embed the OLD policy
    // inputs, so drop both caches (the workspace file reloads by mtime).
    this.clientCache.clear();
    this.workspace.clear();
    for (const dest of config.destinations) {
      await this.add(dest);
    }
    if (config.defaultDestination) {
      this.defaultName = config.defaultDestination;
    }
    this.policy = AdtPolicy.resolve(this.globalPolicyInputs);
    // The demo destination follows the global policy (no per-dest override).
    const demo = this.destinations.get('demo');
    if (demo) demo.policy = this.policy;
  }

  private async startMock(port: number): Promise<void> {
    // One credential pair drives BOTH sides of the demo destination (audit M5):
    // the mock server validates it and the demo client sends it. Defaults to
    // demo/demo; ADT_MOCK_USER / ADT_MOCK_PASSWORD override both together, so
    // setting them can never desync the pair into a 401 loop.
    const username = process.env.ADT_MOCK_USER || 'demo';
    const password = process.env.ADT_MOCK_PASSWORD || 'demo';
    const mock = createMockAdtServer({
      port,
      host: '127.0.0.1',
      username,
      password,
    });
    let actualPort: number;
    try {
      actualPort = await mock.listen();
    } catch (error) {
      // HMR reload can race the previous mock's port release; re-listen the
      // SAME server on a random free port instead of failing the load.
      if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        actualPort = await mock.listen(0);
      } else {
        throw error;
      }
    }
    this.mockServer = mock;
    this.mockPort = actualPort;
    this.destinations.set('demo', {
      config: {
        name: 'demo',
        url: `http://127.0.0.1:${actualPort}`,
        client: '000',
        language: 'EN',
        auth: { type: 'basic', username, password },
      },
      mock: true,
      client: new AdtClient({
        name: 'demo',
        url: `http://127.0.0.1:${actualPort}`,
        client: '000',
        language: 'EN',
        auth: { type: 'basic', username, password },
      }),
      // refreshed at the end of reload() with the global policy
      policy: this.policy,
    });
  }

  private async add(dest: DestinationConfig): Promise<void> {
    this.destinations.set(dest.name, await this.buildEntry(dest, this.globalPolicyInputs, false));
  }

  /**
   * Materialize a RegistryDestination from a destination config overlaid on
   * the given policy inputs. The password resolves PER CALL through the
   * credential layers (config > DSH credential store/.env > process env — see
   * resolvePassword), so an edited `~/.dsh/.credentials.yaml` reaches the next
   * tool call without a restart. When `useCache` is set (workspace-layer
   * destinations) the entry — including its AdtClient, so CSRF tokens and
   * session cookies survive across calls — is reused while the resolved
   * config is unchanged.
   */
  private async buildEntry(
    dest: DestinationConfig,
    policyInputs: PolicyInputs,
    useCache: boolean,
  ): Promise<RegistryDestination> {
    const password = await resolvePassword(dest, this.credentialResolver);
    const cacheKey = useCache ? clientCacheKey(dest, policyInputs, password) : undefined;
    if (cacheKey !== undefined) {
      const cached = this.clientCache.get(cacheKey);
      if (cached) return cached;
    }
    const adtDest: AdtDestination = {
      name: dest.name,
      url: dest.url,
      client: dest.client || '000',
      language: dest.language || 'EN',
      strictSSL: dest.strictSSL,
      timeoutMs: dest.timeoutMs,
      auth: password
        ? { type: 'basic', username: dest.username ?? '', password }
        : { type: 'none' },
    };
    const entry: RegistryDestination = {
      config: adtDest,
      mock: false,
      client: new AdtClient(adtDest),
      // Global defaults overlaid with the destination's own policy block and
      // its environment profile (qa/prd tighten; see policy.ts).
      policy: AdtPolicy.resolve({ ...policyInputs, ...dest.policy, profile: dest.profile }),
    };
    if (cacheKey !== undefined) {
      this.clientCache.set(cacheKey, entry);
      // Insertion-order eviction keeps the cache bounded.
      while (this.clientCache.size > CLIENT_CACHE_CAP) {
        this.clientCache.delete(this.clientCache.keys().next().value!);
      }
    }
    return entry;
  }

  /**
   * Compose the destination view for one caller: global destinations with the
   * workspace file layered on top (nearest wins — same-name entries replace,
   * new names append, `defaultDestination` and top-level policy keys
   * override). `cwd` is the session workspace directory; omit it to see the
   * shared global state (tests, startup logs). Async because workspace
   * entries resolve their password through the credential service per call.
   */
  async viewFor(cwd?: string): Promise<RegistryView> {
    const destinations = new Map(this.destinations);
    let defaultName = this.defaultName;
    let workspaceFile: string | undefined;
    if (cwd) {
      const loaded = this.workspace.load(cwd);
      if (loaded) {
        workspaceFile = loaded.path;
        const workspaceInputs: PolicyInputs = { ...this.globalPolicyInputs };
        const layer = loaded.layer as Partial<
          Record<PolicyKey, boolean | string | string[]>
        >;
        for (const key of POLICY_KEYS) {
          const value = layer[key];
          if (value !== undefined) {
            (workspaceInputs as Record<string, unknown>)[key] = value;
          }
        }
        for (const dest of loaded.layer.destinations ?? []) {
          destinations.set(dest.name, await this.buildEntry(dest, workspaceInputs, true));
        }
        if (loaded.layer.defaultDestination) defaultName = loaded.layer.defaultDestination;
      }
    }
    return { destinations, defaultName, workspaceFile };
  }

  /**
   * Get a client by destination name (workspace-aware); empty/undefined uses
   * the workspace's default. Pass the session cwd so workspace-file
   * destinations participate.
   */
  async require(name?: string, cwd?: string): Promise<RegistryDestination> {
    const view = await this.viewFor(cwd);
    // An explicitly-given name MUST exist: silently falling back to the
    // default destination would point a typo at the wrong SAP system.
    if (name) {
      const named = view.destinations.get(name);
      if (!named) {
        const availableNames = [...view.destinations.keys()].join(', ') || '(none)';
        throw new Error(
          `Unknown ADT destination '${name}'. Configured destinations: ${availableNames}. ` +
            (view.workspaceFile ? `Workspace file: ${view.workspaceFile}. ` : '') +
            'Pass no `destination` to use the default, create one with adt_create_destination, ' +
            'or fix the name in the tool call / config.',
        );
      }
      return named;
    }
    const entry = view.destinations.get(view.defaultName);
    if (!entry) {
      const available = [...view.destinations.keys()].join(', ') || '(none)';
      throw new Error(
        `No ADT destination '${view.defaultName}' (default). Configured destinations: ${available}. ` +
          (view.workspaceFile ? `Workspace file: ${view.workspaceFile}. ` : '') +
          'Add one with adt_create_destination, the plugin config (cordis.patch.yml), or enable demo mode.',
      );
    }
    return entry;
  }

  /** Probe every destination of a view (workspace-aware); updates cached status. */
  async pingAll(
    signal?: AbortSignal,
    cwd?: string,
  ): Promise<Array<{ name: string; mock: boolean; ok: boolean; detail: string }>> {
    const results = [];
    const view = await this.viewFor(cwd);
    for (const [name, entry] of view.destinations) {
      const status = await entry.client.ping({ signal });
      entry.status = { ...status, checkedAt: new Date().toISOString() };
      results.push({ name, mock: entry.mock, ok: status.ok, detail: status.detail ?? '' });
    }
    return results;
  }

  /**
   * Ping a destination config that is not yet saved anywhere (pre-save
   * verification for `adt_create_destination`): builds a transient entry
   * with the same password resolution as a live one. Policy inputs do not
   * affect reachability, so the global defaults apply.
   */
  async pingUnsaved(
    dest: DestinationConfig,
    signal?: AbortSignal,
  ): Promise<{ ok: boolean; status?: number; detail?: string }> {
    const entry = await this.buildEntry(dest, this.globalPolicyInputs, false);
    return entry.client.ping({ signal });
  }

  /** Snapshot for the `adt_permissions` tool: global defaults + per destination (workspace-aware). */
  async describePolicies(cwd?: string): Promise<{
    global: ReturnType<AdtPolicy['describe']>;
    perDestination: Record<string, ReturnType<AdtPolicy['describe']>>;
  }> {
    const perDestination: Record<string, ReturnType<AdtPolicy['describe']>> = {};
    for (const [name, entry] of (await this.viewFor(cwd)).destinations) {
      perDestination[name] = entry.policy.describe();
    }
    return { global: this.policy.describe(), perDestination };
  }

  /**
   * Create or update a destination in the workspace config file of `cwd`
   * (used by `adt_create_destination`). Refuses to replace a same-name entry
   * unless `overwrite` is set; `setDefault` also writes `defaultDestination`.
   * The written layer is validated before the atomic tmp+rename write, and
   * the workspace cache is refreshed so the very next view reflects it.
   */
  saveWorkspaceDestination(
    cwd: string,
    dest: DestinationConfig,
    options: { setDefault?: boolean; overwrite?: boolean } = {},
  ): { path: string; created: boolean; layer: Partial<PluginConfig> } {
    let created = false;
    const { path, layer } = this.workspace.write(cwd, (current) => {
      const existing = (current.destinations ?? []).find((entry) => entry.name === dest.name);
      if (existing && !options.overwrite) {
        throw new Error(
          `destination "${dest.name}" already exists in the workspace file (url: ${existing.url}). ` +
            'Pass overwrite: true to replace it.',
        );
      }
      const upserted = upsertDestination(current, dest);
      created = upserted.created;
      return options.setDefault ? { ...upserted.layer, defaultDestination: dest.name } : upserted.layer;
    });
    return { path, created, layer };
  }

  async dispose(): Promise<void> {
    if (this.mockServer) {
      await this.mockServer.close().catch(() => undefined);
      this.mockServer = undefined;
    }
    this.destinations.clear();
    this.clientCache.clear();
    this.workspace.clear();
  }
}
