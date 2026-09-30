/**
 * @nefevcore/abap-adt-dsh-plugin — DeepSeek Harness host adapter for SAP
 * ABAP Development.
 *
 * Thin adapter over the host-neutral core (`@nefevcore/abap-adt-core`):
 * this package owns exactly the DSH wiring —
 *
 *   - the `abap-adt` entry config (DSH ≥ 0.2.0 model: the Config schema is
 *     volatile, so the composition row config is a LIVE reference — the
 *     Loader commits settings edits in place and emits
 *     `loader/volatile-update`, and this plugin rebuilds the destination
 *     registry without a remount),
 *   - registration on the DSH tool registry (`ctx.tools`) with the
 *     lossless-JSON boundary sanitization (`deepCompact`).
 *
 * Everything else — the 32 `adt_*` tools, destination registry, policy,
 * OCC snapshots, debugger sessions, config layering — lives in the core and
 * is re-exported below for backward compatibility (the pre-0.7.0 `.` entry
 * exported the same surface).
 */
import { AdtRegistry, assembleAdtTools, composeLayers, Config as CoreConfig, credentialResolverOf, DebuggerManager, deepCompact, LockLedger, resolveEffectiveConfig, } from '@nefevcore/abap-adt-core';
const name = 'abap-adt';
/**
 * The DSH entry schema: the core's host-neutral Config wrapped `.volatile()`
 * (DSH ≥ 0.2.0 hot-reload model). The Loader parses the plugin row's config
 * through THIS schema, so the value `apply` receives is a live
 * `Volatile<PluginConfig>` reference: settings edits persist into the active
 * profile's Cordis patch, HMR reconciles the entry, and the Loader commits
 * the new snapshot behind the same reference — emitting
 * `loader/volatile-update` — instead of remounting the plugin.
 */
const Config = CoreConfig.volatile();
/**
 * DSH declaration on the core's host-detection seam (core
 * `src/hostprofile.ts`): the core keeps its credential/description wording
 * host-neutral and voices it from THIS profile — so `adt_create_destination`
 * tells users about `~/.dsh/.credentials.yaml` because DSH declares it here,
 * not because the core presumes DSH.
 */
const DSH_HOST_PROFILE = {
    id: 'dsh',
    label: 'DSH',
    credentialStore: { label: 'DSH credential store', locationHint: '~/.dsh/.credentials.yaml' },
    passwordResolution: 'process env > ~/.dsh/.credentials.yaml > .env files',
    globalConfigHint: 'the abap-adt form in DSH Settings (Plugins page) or the composition row config',
    workspaceConfigDir: '.dsh-abap-adt',
};
// Only `tools` is a hard dependency (audit D1): without it the plugin has no
// reason to load at all. `fs` is deliberately OPTIONAL — resolved per call
// via `ctx.get('fs')` — so lean profiles without dsh-fs still get every
// tool, with the filesystem-backed capabilities (read snapshots, export,
// push, sourceFile, local check) degrading with clear errors instead of the
// whole plugin sitting in `waiting` forever.
const inject = ['tools'];
/**
 * Apply the plugin: build the destination registry and register every tool.
 *
 * Configuration follows the DSH ≥ 0.2.0 volatile-config model: `config` is a
 * LIVE reference (see {@link Config}). Settings edits (the abap-adt form on
 * the Plugins page) persist into the active profile's Cordis patch, HMR
 * reconciles the entry, the Loader commits the new snapshot behind the same
 * reference, and the `loader/volatile-update` listener below rebuilds the
 * registry — no remount, no restart. Each rebuild clones the current
 * snapshot once (the layering pipeline and registry receive ordinary
 * mutable data, exactly as in a plain mount). An explicit `configFile`
 * (team shared) stays authoritative over the row config, exactly as
 * composed.
 */
async function apply(ctx, config) {
    const logger = ctx.logger?.(name);
    const warn = (message) => (logger?.warn ?? console.warn)(`abap-adt: ${message}`);
    const info = (message) => (logger?.info ?? console.info)(`abap-adt: ${message}`);
    const error = (message) => (logger?.error ?? console.error)(`abap-adt: ${message}`);
    /** One mutable copy of the current committed config snapshot. */
    const currentEntry = () => structuredClone(config.get());
    // Persistent lock ledger: survives process restarts so `adt_unlock_all` can
    // release locks left behind by crashed sessions (core src/locks.ts).
    const ledger = new LockLedger();
    // Hot reload: every loader/volatile-update queues a rebuild — serialized
    // through `rebuildChain`, deduplicated against the last applied snapshot.
    let rebuildChain = Promise.resolve();
    let lastSnapshot = '';
    // Set by the disposer BEFORE teardown (audit D4): a volatile change queued
    // behind the current rebuild must never run registry.reload() on a disposed
    // registry — that would restart the demo mock outside any disposer's reach
    // (leaked listeners until process exit).
    let disposed = false;
    // Password references (passwordEnv / ADT_<NAME>_PASSWORD) resolve through
    // the DSH credential service when mounted: process env > the user's
    // ~/.dsh/.credentials.yaml > .env files, re-resolved per tool call. The
    // host profile is the STORAGE authority: it fixes the workspace config
    // directory (.dsh-abap-adt) and voices the file's self-documentation.
    const registry = await AdtRegistry.create(composeLayers([currentEntry()]), {
        credentialResolver: credentialResolverOf(ctx),
        hostProfile: DSH_HOST_PROFILE,
    });
    // Plugin-level debugger session manager (core src/debugger.ts): the
    // listener identity outlives single tool calls, and the disposer detaches
    // every registered listener so an unloaded plugin leaks no debug sessions.
    const debuggerManager = new DebuggerManager(registry);
    async function rebuild() {
        rebuildChain = rebuildChain.then(async () => {
            if (disposed)
                return; // plugin already unloaded — do not revive the registry
            try {
                const { config: effective, warnings } = await resolveEffectiveConfig({ entry: currentEntry() });
                for (const warning of warnings)
                    warn(warning);
                const snapshot = JSON.stringify(effective);
                if (snapshot === lastSnapshot)
                    return;
                await registry.reload(effective);
                lastSnapshot = snapshot;
                info(`config applied: ${registry.destinations.size} destination(s): ` +
                    `${[...registry.destinations.keys()].join(', ') || '(none)'}` +
                    (effective.configFileUsed ? `; config file: ${effective.configFileUsed}` : ''));
            }
            catch (err) {
                error(`config reload failed, keeping last good state: ${err.message}`);
            }
        });
        return rebuildChain;
    }
    // The Loader commits volatile values BEFORE dispatching, so the rebuild
    // above always reads the already-updated `config` (cordis-plugin-loader
    // `_commitVolatile`; a listener failure is logged by the Loader and never
    // fails the entry update).
    ctx.on('loader/volatile-update', () => {
        void rebuild();
    });
    const deps = { registry, ledger, debugger: debuggerManager };
    // Host facade for the core's environment-detection seam: declares the DSH
    // identity (`get('host')`, see DSH_HOST_PROFILE above) and forwards every
    // other service lookup to the DSH context unchanged. The logger seam rides
    // along only when the context provides one (lean profiles may not).
    const dshLogger = ctx.logger;
    const host = {
        get: (serviceName) => (serviceName === 'host' ? DSH_HOST_PROFILE : ctx.get(serviceName)),
        ...(dshLogger ? { logger: dshLogger } : {}),
    };
    // Full catalog assembly lives in the core — this wrapper only adds the
    // DSH registry boundary behavior below.
    const tools = assembleAdtTools(deps, host);
    for (const tool of tools) {
        // Sanitize every tool's output at the registry boundary: strip `undefined`
        // property values so the value passes the DSH lossless-JSON validation
        // (the registry rejects undefined anywhere in the returned value). The
        // presentResult cast only crosses vocabulary: the core's ToolResultView
        // record vs. the DSH presentation union (the produced shapes are the
        // DSH cards).
        const { execute, presentResult, ...rest } = tool;
        ctx.tools.register({
            ...rest,
            ...(presentResult ? { presentResult: presentResult } : {}),
            execute: async (args, exec) => deepCompact(await execute(args, exec)),
        });
    }
    info(`plugin active: ${tools.length} tools registered`);
    // Fiber disposer: flag the plugin as disposed FIRST (kills every queued
    // rebuild), let the in-flight one settle, detach every debug listener (the
    // sessions belong to this Fiber), then close the mock server and drop the
    // clients.
    return async () => {
        disposed = true;
        await rebuildChain.catch(() => undefined);
        await debuggerManager.dispose();
        await registry.dispose();
    };
}
export { Config, apply, inject, name };
// --- Backward-compat surface (the pre-0.7.0 `.` entry exported these) ---
// The engine surface now lives in @nefevcore/abap-adt-core; existing DSH
// consumers (presets, scripts) keep importing them from here unchanged.
export { AdtRegistry } from '@nefevcore/abap-adt-core';
export { TYPE_MAP, resolveObject, resolveObjects, refFromName, normalizeType, typeLabel, } from '@nefevcore/abap-adt-core';
export { AdtClient, AdtError } from '@nefevcore/abap-adt-protocol';
export { createMockAdtServer } from '@nefevcore/abap-adt-mock';
//# sourceMappingURL=index.js.map