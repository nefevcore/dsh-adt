import { AdtClient, type AdtDestination } from '@nefevcore/abap-adt-protocol';
import type { EffectiveConfig } from './config.js';
import { AdtPolicy } from './policy.js';
export interface RegistryDestination {
    config: AdtDestination;
    /** `true` when backed by the in-process mock server. */
    mock: boolean;
    client: AdtClient;
    /** Effective permission policy of THIS destination (global defaults overlaid
     *  with the destination's `policy:` block); swapped by reload(). */
    policy: AdtPolicy;
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
    /** Effective permission policy (config > SAP_* env > defaults); swapped by reload(). */
    policy: AdtPolicy;
    /** Destination used when a tool call omits `destination`. */
    defaultName: string;
    private mockServer?;
    private mockPort?;
    /** Top-level policy inputs (global defaults for every destination). */
    private globalPolicyInputs;
    private constructor();
    /** Accepts the fully-resolved config from `resolveEffectiveConfig`. */
    static create(config: EffectiveConfig): Promise<AdtRegistry>;
    /**
     * Re-apply a resolved config in place (settings hot reload): swaps the
     * policy, rebuilds the destination table, and restarts the mock server
     * only when its flags actually changed. Object identity is stable, so
     * every tool holding this registry sees the new state.
     */
    reload(config: EffectiveConfig): Promise<void>;
    private startMock;
    private add;
    /** Get a client by destination name; empty/undefined uses the default. */
    require(name?: string): RegistryDestination;
    /** Probe every destination; updates cached status. */
    pingAll(signal?: AbortSignal): Promise<Array<{
        name: string;
        mock: boolean;
        ok: boolean;
        detail: string;
    }>>;
    /** Snapshot for the `adt_permissions` tool: global defaults + per destination. */
    describePolicies(): {
        global: ReturnType<AdtPolicy['describe']>;
        perDestination: Record<string, ReturnType<AdtPolicy['describe']>>;
    };
    dispose(): Promise<void>;
}
//# sourceMappingURL=registry.d.ts.map