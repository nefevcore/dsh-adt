import { AdtClient, type AdtDestination } from '@abap-adt/protocol';
import { createMockAdtServer } from '@abap-adt/mock';
import type { PluginConfig } from './config.js';
import { resolvePassword } from './config.js';

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
  private mockServer?: Awaited<ReturnType<typeof createMockAdtServer>>;
  private mockPort?: number;

  private constructor() {}

  static async create(config: PluginConfig): Promise<AdtRegistry> {
    const registry = new AdtRegistry();
    if (config.demo) {
      await registry.startMock(config.demoPort);
    }
    for (const dest of config.destinations) {
      registry.add(dest);
    }
    if (config.defaultDestination) {
      registry.defaultName = config.defaultDestination;
    }
    return registry;
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

  private add(dest: PluginConfig['destinations'][number]): void {
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

  /** Get a client by destination name; falls back to the default. */
  require(name?: string): RegistryDestination {
    const key = name && this.destinations.has(name) ? name : this.defaultName;
    const entry = this.destinations.get(key);
    if (!entry) {
      const available = [...this.destinations.keys()].join(', ') || '(none)';
      throw new Error(
        `No ADT destination '${key}'. Configured destinations: ${available}. ` +
          'Add one via the plugin config (cordis.patch.yml) or enable demo mode.',
      );
    }
    return entry;
  }

  /** Probe every destination; updates cached status. */
  async pingAll(): Promise<Array<{ name: string; mock: boolean; ok: boolean; detail: string }>> {
    const results = [];
    for (const [name, entry] of this.destinations) {
      const status = await entry.client.ping();
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
export type { PluginConfig };
