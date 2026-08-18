import { AdtClient, type AdtDestination } from '@nefevcore/abap-adt-protocol';
import { createMockAdtServer } from '@nefevcore/abap-adt-mock';
import type { DestinationConfig, EffectiveConfig, PluginConfig } from './config.js';
import { resolvePassword } from './config.js';
import { AdtPolicy } from './policy.js';

export interface RegistryDestination {
  config: AdtDestination;
  /** `true` when backed by the in-process mock server. */
  mock: boolean;
  client: AdtClient;
  /** Cached last ping result. */
  status?: { ok: boolean; detail?: string; checkedAt?: string };
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
  private mockServer?: Awaited<ReturnType<typeof createMockAdtServer>>;
  private mockPort?: number;

  private constructor(policy: AdtPolicy) {
    this.policy = policy;
  }

  /** Accepts the fully-resolved config from `resolveEffectiveConfig`. */
  static async create(config: EffectiveConfig): Promise<AdtRegistry> {
    const registry = new AdtRegistry(AdtPolicy.resolve(config));
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

    // Rebuild the non-mock destinations (fresh clients; dropped names go away).
    for (const [name, entry] of [...this.destinations]) {
      if (!entry.mock) this.destinations.delete(name);
    }
    for (const dest of config.destinations) {
      this.add(dest);
    }
    if (config.defaultDestination) {
      this.defaultName = config.defaultDestination;
    }
    this.policy = AdtPolicy.resolve(config);
  }

  private async startMock(port: number): Promise<void> {
    const mock = createMockAdtServer({
      port,
      host: '127.0.0.1',
      username: process.env.ADT_MOCK_USER,
      password: process.env.ADT_MOCK_PASSWORD,
    });
    let actualPort: number;
    try {
      actualPort = await mock.listen();
    } catch (error) {
      // HMR reload can race the previous mock's port release; fall back to a
      // random free port instead of failing the whole plugin load.
      if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        const retry = createMockAdtServer({
          port: 0,
          host: '127.0.0.1',
          username: process.env.ADT_MOCK_USER,
          password: process.env.ADT_MOCK_PASSWORD,
        });
        actualPort = await retry.listen();
        void mock.close().catch(() => undefined);
        this.mockServer = retry;
      } else {
        throw error;
      }
    }
    if (!this.mockServer) this.mockServer = mock;
    this.mockPort = actualPort;
    this.destinations.set('demo', {
      config: {
        name: 'demo',
        url: `http://127.0.0.1:${actualPort}`,
        client: '000',
        language: 'EN',
        auth: { type: 'basic', username: 'demo', password: 'demo' },
      },
      mock: true,
      client: new AdtClient({
        name: 'demo',
        url: `http://127.0.0.1:${actualPort}`,
        client: '000',
        language: 'EN',
        auth: { type: 'basic', username: 'demo', password: 'demo' },
      }),
    });
  }

  private add(dest: DestinationConfig): void {
    const password = resolvePassword(dest);
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
    this.destinations.set(dest.name, {
      config: adtDest,
      mock: false,
      client: new AdtClient(adtDest),
    });
  }

  defaultName = 'demo';

  /** Get a client by destination name; empty/undefined uses the default. */
  require(name?: string): RegistryDestination {
    // An explicitly-given name MUST exist: silently falling back to the
    // default destination would point a typo at the wrong SAP system.
    if (name) {
      const named = this.destinations.get(name);
      if (!named) {
        const availableNames = [...this.destinations.keys()].join(', ') || '(none)';
        throw new Error(
          `Unknown ADT destination '${name}'. Configured destinations: ${availableNames}. ` +
            'Pass no `destination` to use the default, or fix the name in the tool call / plugin config.',
        );
      }
      return named;
    }
    const entry = this.destinations.get(this.defaultName);
    if (!entry) {
      const available = [...this.destinations.keys()].join(', ') || '(none)';
      throw new Error(
        `No ADT destination '${this.defaultName}' (default). Configured destinations: ${available}. ` +
          'Add one via the plugin config (cordis.patch.yml) or enable demo mode.',
      );
    }
    return entry;
  }

  /** Probe every destination; updates cached status. */
  async pingAll(signal?: AbortSignal): Promise<Array<{ name: string; mock: boolean; ok: boolean; detail: string }>> {
    const results = [];
    for (const [name, entry] of this.destinations) {
      const status = await entry.client.ping({ signal });
      entry.status = { ...status, checkedAt: new Date().toISOString() };
      results.push({ name, mock: entry.mock, ok: status.ok, detail: status.detail ?? '' });
    }
    return results;
  }

  async dispose(): Promise<void> {
    if (this.mockServer) {
      await this.mockServer.close().catch(() => undefined);
      this.mockServer = undefined;
    }
    this.destinations.clear();
  }
}

/** Not used at runtime; exported for tool typing. */
export type { PluginConfig, EffectiveConfig, DestinationConfig };
