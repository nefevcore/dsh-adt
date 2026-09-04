import type { ToolHost } from './tooldef.js';
/**
 * How passwords are kept and resolved on one host. Plain data: hosts
 * construct it inline (the DSH plugin and AgentChat each declare theirs) —
 * the core has zero runtime dependency on any host package.
 */
export interface HostProfile {
    /** Stable host id, e.g. 'dsh' | 'agentchat' | 'standalone'. */
    id: string;
    /**
     * Human-facing host name used mid-sentence (e.g. 'DSH', 'the host') —
     * keep it lowercase-safe for sentence embedding.
     */
    label: string;
    /** The host's secret store, when one exists. */
    credentialStore?: {
        /** Store name as it should appear to users (e.g. 'DSH credential store'). */
        label: string;
        /** Where the store keeps its data (e.g. '~/.dsh/.credentials.yaml'). */
        locationHint?: string;
    };
    /**
     * Human-readable resolution chain of a `passwordEnv` reference on this
     * host, nearest first (e.g. 'process env > ~/.dsh/.credentials.yaml >
     * .env files' on DSH, 'host credential store > process env' when
     * inferred, 'process environment variables only' when nothing is
     * mounted). Must stay truthful: it is shown to users and agents.
     */
    passwordResolution: string;
    /**
     * Sentence fragment completing "Layering: this file …" in the generated
     * destinations.yaml header, naming the host's global config layer (DSH
     * declares 'overrides ~/.dsh/settings.yaml `abap-adt:`'). Omitted → a
     * host-neutral sentence is used.
     */
    globalConfigHint?: string;
    /**
     * Directory (relative to a session workspace) where THIS host keeps its
     * workspace destinations file: `<cwd>/<dir>/destinations.yaml`. DSH
     * declares '.dsh-abap-adt'; other hosts their own location (an AgentChat
     * row, say, '.agentchat/abap-adt' inside its data root). The special
     * value `'.'` means the anchor directory itself IS the config directory
     * (`<cwd>/destinations.yaml`) — for hosts that scope the anchor per
     * caller (e.g. one anchor per agent) and don't want a nested constant
     * dir inside every scope. Omitted → the core default '.dsh-abap-adt', so
     * undeclared hosts and existing workspaces keep working unchanged.
     * Storage is REGISTRY-level: hosts declare the profile at
     * `AdtRegistry.create` (declaring a different dir means files in the
     * previous dir are no longer read — hosts migrate).
     */
    workspaceConfigDir?: string;
}
/**
 * Detect the host profile of a context: a valid `ctx.get('host')`
 * declaration wins; otherwise the credential-service capability decides
 * (store present vs. environment-variables-only). Re-resolved per call so
 * a service appearing or disappearing between operations is respected.
 * (No extra try/catch on purpose: a `get()` that throws would already break
 * the credential seam — same contract as `credentialsOf`.)
 */
export declare function hostProfileOf(ctx: ToolHost): HostProfile;
/**
 * Note for a password that landed in the host credential store: names the
 * store (and its backing location when the profile declares one) and says
 * that destinations.yaml keeps only the reference.
 */
export declare function credentialStoreNote(profile: HostProfile, ref: string): string;
/**
 * Note for a password that had to be written PLAINTEXT into
 * destinations.yaml. `reason` picks the wording: 'explicit' (passwordInFile),
 * 'not-writable' (a read-only store), 'none' (no store on this host).
 */
export declare function plaintextFallbackNote(profile: HostProfile, ref: string, reason: 'explicit' | 'not-writable' | 'none'): string;
/**
 * Follow-up hint when a destination was created with a username but no
 * password: where to put the secret on THIS host, then verify.
 */
export declare function passwordReferenceHint(profile: HostProfile, ref: string): string;
/**
 * One sentence for schema descriptions: what a `passwordEnv` reference
 * resolves through on this host ('DSH resolves it layer-wise: process env >
 * ~/.dsh/.credentials.yaml > .env files' / 'It resolves through process
 * environment variables only').
 */
export declare function passwordResolutionSentence(profile: HostProfile): string;
/**
 * The resolution chain written into the self-documenting `passwordEnv`
 * comment of destinations.yaml (host-voiced; host-neutral default when no
 * profile is available).
 */
export declare function passwordRefChain(profile: HostProfile | undefined): string;
/**
 * The layering sentence for the destinations.yaml header comment: the
 * host's declared fragment when present, else a host-neutral one.
 */
export declare function globalConfigSentence(profile: HostProfile | undefined): string;
/**
 * The workspace config directory a host's destinations file lives in
 * (`<cwd>/<dir>/destinations.yaml`): the host's declared dir, else the core
 * default '.dsh-abap-adt'.
 */
export declare function workspaceConfigDirOf(profile: HostProfile | undefined): string;
/**
 * Human-facing location label for tool descriptions: `'.'` (anchor IS the
 * config dir) renders without a path segment, anything else as
 * `<dir>/destinations.yaml`.
 */
export declare function workspaceConfigLocationLabel(dir: string): string;
//# sourceMappingURL=hostprofile.d.ts.map