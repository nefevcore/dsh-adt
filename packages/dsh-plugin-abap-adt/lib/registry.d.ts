import { AdtClient, type AdtDestination } from '@abap-adt/protocol';
import type { PluginConfig } from './config.js';
export interface RegistryDestination {
    config: AdtDestination;
    /** `true` when backed by the in-process mock server. */
    mock: boolean;
    client: AdtClient;
    /** Cached last ping result. */
    status?: {
        ok: boolean;
        detail?: string;
        checkedAt?: string;
    };
}
/**
 * Owns the configured destinations and their live ADT clients. Also starts
 * the in-process mock ADT server when `demo` is enabled, so the whole tool
 * family works out of the box without any SAP system.
 */
export declare class AdtRegistry {
    readonly destinations: Map<string, RegistryDestination>;
    private mockServer?;
    private mockPort?;
    private constructor();
    static create(config: PluginConfig): Promise<AdtRegistry>;
    private startMock;
    private add;
    defaultName: string;
    /** Get a client by destination name; falls back to the default. */
    require(name?: string): RegistryDestination;
    /** Probe every destination; updates cached status. */
    pingAll(): Promise<Array<{
        name: string;
        mock: boolean;
        ok: boolean;
        detail: string;
    }>>;
    dispose(): Promise<void>;
}
/** Not used at runtime; exported for tool typing. */
export type { PluginConfig };
//# sourceMappingURL=registry.d.ts.map