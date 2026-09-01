import { AdtClient, type AdtDestination } from '@nefevcore/abap-adt-protocol';
import type { DestinationConfig, EffectiveConfig, PluginConfig } from './config.js';
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
/** Async password resolution seam (see config.ts resolvePassword). */
type CredentialResolver = (ref: string) => Promise<string | undefined>;
/**
 * Owns the configured destinations and their live ADT clients. Also starts
 * the in-process mock ADT server when `demo` is enabled, so the whole tool
 * family works out of the box without any SAP system.
 */
export declare class AdtRegistry {
    private readonly credentialResolver?;
    readonly destinations: Map<string, RegistryDestination>;
    /** Effective permission policy (config > SAP_* env > defaults); swapped by reload(). */
    policy: AdtPolicy;
    /** Destination used when a tool call omits `destination`. */
    defaultName: string;
    private mockServer?;
    private mockPort?;
    /** Top-level policy inputs (global defaults for every destination). */
    private globalPolicyInputs;
    /** Workspace file store (mtime-cached, per-tool-call layer). */
    private readonly workspace;
    /** Client reuse for workspace-layer destinations, keyed by full config. */
    private readonly clientCache;
    private constructor();
    /** Accepts the fully-resolved config from `resolveEffectiveConfig`. */
    static create(config: EffectiveConfig, options?: {
        credentialResolver?: CredentialResolver;
    }): Promise<AdtRegistry>;
    /**
     * Re-apply a resolved config in place (settings hot reload): swaps the
     * policy, rebuilds the destination table, and restarts the mock server
     * only when its flags actually changed. Object identity is stable, so
     * every tool holding this registry sees the new state.
     */
    reload(config: EffectiveConfig): Promise<void>;
    private startMock;
    private add;
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
    private buildEntry;
    /**
     * Compose the destination view for one caller: global destinations with the
     * workspace file layered on top (nearest wins — same-name entries replace,
     * new names append, `defaultDestination` and top-level policy keys
     * override). `cwd` is the session workspace directory; omit it to see the
     * shared global state (tests, startup logs). Async because workspace
     * entries resolve their password through the credential service per call.
     */
    viewFor(cwd?: string): Promise<RegistryView>;
    /**
     * Get a client by destination name (workspace-aware); empty/undefined uses
     * the workspace's default. Pass the session cwd so workspace-file
     * destinations participate.
     */
    require(name?: string, cwd?: string): Promise<RegistryDestination>;
    /** Probe every destination of a view (workspace-aware); updates cached status. */
    pingAll(signal?: AbortSignal, cwd?: string): Promise<Array<{
        name: string;
        mock: boolean;
        ok: boolean;
        detail: string;
    }>>;
    /**
     * Ping a destination config that is not yet saved anywhere (pre-save
     * verification for `adt_create_destination`): builds a transient entry
     * with the same password resolution as a live one. Policy inputs do not
     * affect reachability, so the global defaults apply.
     */
    pingUnsaved(dest: DestinationConfig, signal?: AbortSignal): Promise<{
        ok: boolean;
        status?: number;
        detail?: string;
    }>;
    /** Snapshot for the `adt_permissions` tool: global defaults + per destination (workspace-aware). */
    describePolicies(cwd?: string): Promise<{
        global: ReturnType<AdtPolicy['describe']>;
        perDestination: Record<string, ReturnType<AdtPolicy['describe']>>;
    }>;
    /**
     * Create or update a destination in the workspace config file of `cwd`
     * (used by `adt_create_destination`). Refuses to replace a same-name entry
     * unless `overwrite` is set; `setDefault` also writes `defaultDestination`.
     * The written layer is validated before the atomic tmp+rename write, and
     * the workspace cache is refreshed so the very next view reflects it.
     */
    saveWorkspaceDestination(cwd: string, dest: DestinationConfig, options?: {
        setDefault?: boolean;
        overwrite?: boolean;
    }): {
        path: string;
        created: boolean;
        layer: Partial<PluginConfig>;
    };
    dispose(): Promise<void>;
}
export {};
//# sourceMappingURL=registry.d.ts.map