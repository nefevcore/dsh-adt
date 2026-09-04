/**
 * Host environment detection seam: how the tool core adapts its destination
 * / credential management (wording and fallbacks) to the runtime host.
 *
 * The core itself is host-neutral and never sniffs for a specific host —
 * detection is two-staged, most specific first:
 *
 *   1. DECLARED — `ctx.get('host')` returns a {@link HostProfile}. Host
 *      adapters state their identity and their credential-store vocabulary
 *      explicitly: the DSH plugin declares `id: 'dsh'` with the
 *      `~/.dsh/.credentials.yaml` store, AgentChat's `ac-sap-adt` row
 *      declares its own encrypted store, and any future host does the same.
 *   2. INFERRED — no declaration → capability probing: a mounted credential
 *      service (`ctx.get('credentials')`, see src/credentials.ts) means
 *      "a host secret store exists"; none means "environment variables
 *      only". Both inferred profiles use host-neutral wording, so an
 *      undeclared host degrades gracefully instead of being told to edit a
 *      `~/.dsh/...` file it will never read.
 *
 * What the profile drives today (all wording-level — the storage BEHAVIOR
 * already adapts via the optional credential service):
 *
 *   - `adt_create_destination` tool/parameter descriptions (where passwords
 *     go on THIS host, what a `passwordEnv` reference resolves through),
 *   - the notes/hint of a created destination,
 *   - the self-documenting `passwordEnv` comment in destinations.yaml.
 *
 * It is the extension point for future per-host destination STORAGE forms
 * (e.g. a different workspace config location): add a field, hosts declare
 * it, the core reads it — no host sniffing.
 */
import { credentialsOf } from './credentials.js';
import { DEFAULT_WORKSPACE_CONFIG_DIR } from './config.js';
/** Loose shape check for a host-declared profile (invalid → ignored). */
function declaredProfileOf(service) {
    if (service === null || typeof service !== 'object')
        return undefined;
    const candidate = service;
    if (typeof candidate.id !== 'string' ||
        candidate.id === '' ||
        typeof candidate.label !== 'string' ||
        candidate.label === '' ||
        typeof candidate.passwordResolution !== 'string' ||
        candidate.passwordResolution === '') {
        return undefined;
    }
    if (candidate.credentialStore === undefined)
        return candidate;
    const store = candidate.credentialStore;
    if (typeof store.label !== 'string' || store.label === '')
        return undefined;
    if (store.locationHint !== undefined && typeof store.locationHint !== 'string')
        return undefined;
    return candidate;
}
/** Inferred profile: a credential service is mounted (store may or may not be writable). */
const HOST_STORE_PROFILE = {
    id: 'host',
    label: 'the host',
    credentialStore: { label: 'host credential store' },
    passwordResolution: 'host credential store > process env',
};
/** Inferred profile: no credential service at all — references are env vars. */
const STANDALONE_PROFILE = {
    id: 'standalone',
    label: 'the runtime',
    passwordResolution: 'process environment variables only',
};
/**
 * Detect the host profile of a context: a valid `ctx.get('host')`
 * declaration wins; otherwise the credential-service capability decides
 * (store present vs. environment-variables-only). Re-resolved per call so
 * a service appearing or disappearing between operations is respected.
 * (No extra try/catch on purpose: a `get()` that throws would already break
 * the credential seam — same contract as `credentialsOf`.)
 */
export function hostProfileOf(ctx) {
    const declared = declaredProfileOf(ctx.get?.('host'));
    if (declared !== undefined)
        return declared;
    return credentialsOf(ctx) !== undefined ? HOST_STORE_PROFILE : STANDALONE_PROFILE;
}
// ---------------------------------------------------------------------------
// Wording helpers (single source for every password-related string the
// destination tools show; hosts get their vocabulary from their profile)
// ---------------------------------------------------------------------------
/**
 * Note for a password that landed in the host credential store: names the
 * store (and its backing location when the profile declares one) and says
 * that destinations.yaml keeps only the reference.
 */
export function credentialStoreNote(profile, ref) {
    const store = profile.credentialStore;
    const hint = store?.locationHint !== undefined ? `; backing file ${store.locationHint}` : '';
    return `password stored in the ${store?.label ?? 'host credential store'} (reference ${ref}${hint}) — destinations.yaml keeps only the reference`;
}
/**
 * Note for a password that had to be written PLAINTEXT into
 * destinations.yaml. `reason` picks the wording: 'explicit' (passwordInFile),
 * 'not-writable' (a read-only store), 'none' (no store on this host).
 */
export function plaintextFallbackNote(profile, ref, reason) {
    if (reason === 'explicit') {
        return 'password written PLAINTEXT into destinations.yaml as requested (passwordInFile) — do not commit this file, prefer the credential store';
    }
    if (reason === 'not-writable') {
        return `the ${profile.credentialStore?.label ?? 'host credential store'} is mounted but cannot store values: password written PLAINTEXT into destinations.yaml — do not commit this file; prefer exporting ${ref} as an environment variable`;
    }
    return `no ${profile.credentialStore?.label ?? 'host credential store'} on ${profile.label}: password written PLAINTEXT into destinations.yaml — do not commit this file; prefer exporting ${ref} as an environment variable`;
}
/**
 * Follow-up hint when a destination was created with a username but no
 * password: where to put the secret on THIS host, then verify.
 */
export function passwordReferenceHint(profile, ref) {
    const store = profile.credentialStore;
    const where = store
        ? `${store.label}${store.locationHint !== undefined ? ` ${store.locationHint}` : ''} or an env var of that name`
        : 'an environment variable of that name';
    return `set the password under reference ${ref} (${where}), then verify with adt_ping`;
}
/**
 * One sentence for schema descriptions: what a `passwordEnv` reference
 * resolves through on this host ('DSH resolves it layer-wise: process env >
 * ~/.dsh/.credentials.yaml > .env files' / 'It resolves through process
 * environment variables only').
 */
export function passwordResolutionSentence(profile) {
    return profile.credentialStore !== undefined
        ? `${profile.label} resolves it layer-wise: ${profile.passwordResolution}`
        : `It resolves through ${profile.passwordResolution}`;
}
/**
 * The resolution chain written into the self-documenting `passwordEnv`
 * comment of destinations.yaml (host-voiced; host-neutral default when no
 * profile is available).
 */
export function passwordRefChain(profile) {
    return profile?.passwordResolution ?? 'process env / host credential store';
}
/**
 * The layering sentence for the destinations.yaml header comment: the
 * host's declared fragment when present, else a host-neutral one.
 */
export function globalConfigSentence(profile) {
    return profile?.globalConfigHint !== undefined
        ? `this file ${profile.globalConfigHint}`
        : 'this file overrides the global abap-adt configuration';
}
/**
 * The workspace config directory a host's destinations file lives in
 * (`<cwd>/<dir>/destinations.yaml`): the host's declared dir, else the core
 * default '.dsh-abap-adt'.
 */
export function workspaceConfigDirOf(profile) {
    return profile?.workspaceConfigDir ?? DEFAULT_WORKSPACE_CONFIG_DIR;
}
/**
 * Human-facing location label for tool descriptions: `'.'` (anchor IS the
 * config dir) renders without a path segment, anything else as
 * `<dir>/destinations.yaml`.
 */
export function workspaceConfigLocationLabel(dir) {
    return dir === '.' ? 'destinations.yaml (in the session workspace anchor)' : `${dir}/destinations.yaml`;
}
//# sourceMappingURL=hostprofile.js.map