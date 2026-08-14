import { AdtClient } from '@abap-adt/protocol';
import { createMockAdtServer } from '@abap-adt/mock';
import { resolvePassword } from './config.js';
import { AdtPolicy } from './policy.js';
/**
 * Owns the configured destinations and their live ADT clients. Also starts
 * the in-process mock ADT server when `demo` is enabled, so the whole tool
 * family works out of the box without any SAP system.
 */
export class AdtRegistry {
    destinations = new Map();
    /** Effective permission policy (config > SAP_* env > defaults). */
    policy;
    mockServer;
    mockPort;
    constructor(policy) {
        this.policy = policy;
    }
    static async create(config) {
        const registry = new AdtRegistry(AdtPolicy.resolve(config));
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
    async startMock(port) {
        const mock = createMockAdtServer({
            port,
            host: '127.0.0.1',
            username: process.env.ADT_MOCK_USER,
            password: process.env.ADT_MOCK_PASSWORD,
        });
        let actualPort;
        try {
            actualPort = await mock.listen();
        }
        catch (error) {
            // HMR reload can race the previous mock's port release; fall back to a
            // random free port instead of failing the whole plugin load.
            if (error.code === 'EADDRINUSE') {
                const retry = createMockAdtServer({
                    port: 0,
                    host: '127.0.0.1',
                    username: process.env.ADT_MOCK_USER,
                    password: process.env.ADT_MOCK_PASSWORD,
                });
                actualPort = await retry.listen();
                void mock.close().catch(() => undefined);
                this.mockServer = retry;
            }
            else {
                throw error;
            }
        }
        if (!this.mockServer)
            this.mockServer = mock;
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
    add(dest) {
        const password = resolvePassword(dest);
        const adtDest = {
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
    require(name) {
        const key = name && this.destinations.has(name) ? name : this.defaultName;
        const entry = this.destinations.get(key);
        if (!entry) {
            const available = [...this.destinations.keys()].join(', ') || '(none)';
            throw new Error(`No ADT destination '${key}'. Configured destinations: ${available}. ` +
                'Add one via the plugin config (cordis.patch.yml) or enable demo mode.');
        }
        return entry;
    }
    /** Probe every destination; updates cached status. */
    async pingAll() {
        const results = [];
        for (const [name, entry] of this.destinations) {
            const status = await entry.client.ping();
            entry.status = { ...status, checkedAt: new Date().toISOString() };
            results.push({ name, mock: entry.mock, ok: status.ok, detail: status.detail ?? '' });
        }
        return results;
    }
    async dispose() {
        if (this.mockServer) {
            await this.mockServer.close().catch(() => undefined);
            this.mockServer = undefined;
        }
        this.destinations.clear();
    }
}
//# sourceMappingURL=registry.js.map