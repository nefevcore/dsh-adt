/**
 * @nefevcore/abap-adt-dsh-plugin — DeepSeek Harness host adapter for SAP
 * ABAP Development.
 *
 * Thin adapter over the host-neutral core (`@nefevcore/abap-adt-core`):
 * this package owns exactly the DSH wiring —
 *
 *   - the `abap-adt` settings namespace (composition row config = base,
 *     `~/.dsh/settings.yaml` `abap-adt:` section = user layer, hot reload),
 *   - registration on the DSH tool registry (`ctx.tools`) with the
 *     lossless-JSON boundary sanitization (`deepCompact`),
 *   - the `abap-adt-preset` CLI (presets for DSH sessions).
 *
 * Everything else — the 46 `adt_*` tools, destination registry, policy,
 * OCC snapshots, debugger sessions, config layering — lives in the core and
 * is re-exported below for backward compatibility (the pre-0.7.0 `.` entry
 * exported the same surface).
 */
import { Context } from '@deepseek-ai/cordis';
import { AdtRegistry, assembleAdtTools, composeLayers, Config, credentialResolverOf, DebuggerManager, deepCompact, LockLedger, resolveEffectiveConfig, } from '@nefevcore/abap-adt-core';
const name = 'abap-adt';
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
    globalConfigHint: 'overrides ~/.dsh/settings.yaml `abap-adt:`',
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
 * Configuration follows the DSH settings seam: the plugin row's `config:`
 * block is the composition `base`, the user's `~/.dsh/settings.yaml`
 * `abap-adt:` section overrides it, and an explicit `configFile` (team
 * shared) is authoritative. When the settings service is not mounted the
 * composition entry alone drives the plugin, exactly as composed. Config
 * changes hot-reload the registry in place — only code changes need a DSH
 * restart.
 */
async function apply(ctx, config) {
    const logger = ctx.logger?.(name);
    const warn = (message) => (logger?.warn ?? console.warn)(`abap-adt: ${message}`);
    const info = (message) => (logger?.info ?? console.info)(`abap-adt: ${message}`);
    const error = (message) => (logger?.error ?? console.error)(`abap-adt: ${message}`);
    // Persistent lock ledger: survives process restarts so `adt_unlock_all` can
    // release locks left behind by crashed sessions (core src/locks.ts).
    const ledger = new LockLedger();
    // Settings wiring (optional service): `source()` returns the resolved
    // namespace value while a provider is attached and falls back to the
    // composition entry otherwise. Every attach/detach/change fires onChange —
    // including one synchronously at attach — so all rebuild state and the
    // registry must exist BEFORE the section is installed.
    let source = () => config;
    let rebuildChain = Promise.resolve();
    let lastSnapshot = '';
    // Set by the disposer BEFORE teardown (audit D4): a settings change queued
    // behind the current rebuild must never run registry.reload() on a disposed
    // registry — that would restart the demo mock outside any disposer's reach
    // (leaked listeners until process exit).
    let disposed = false;
    // Password references (passwordEnv / ADT_<NAME>_PASSWORD) resolve through
    // the DSH credential service when mounted: process env > the user's
    // ~/.dsh/.credentials.yaml > .env files, re-resolved per tool call. The
    // host profile is the STORAGE authority: it fixes the workspace config
    // directory (.dsh-abap-adt) and voices the file's self-documentation.
    const registry = await AdtRegistry.create(composeLayers([config]), {
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
                const resolved = source();
                const settingsAttached = resolved !== config;
                const { config: effective, warnings } = await resolveEffectiveConfig({
                    entry: config,
                    resolved: settingsAttached ? resolved : undefined,
                });
                for (const warning of warnings)
                    warn(warning);
                const snapshot = JSON.stringify(effective);
                if (snapshot === lastSnapshot)
                    return;
                await registry.reload(effective);
                lastSnapshot = snapshot;
                info(`config applied: ${registry.destinations.size} destination(s): ` +
                    `${[...registry.destinations.keys()].join(', ') || '(none)'}` +
                    (settingsAttached ? ' [settings]' : '') +
                    (effective.configFileUsed ? `; config file: ${effective.configFileUsed}` : ''));
            }
            catch (err) {
                error(`config reload failed, keeping last good state: ${err.message}`);
            }
        });
        return rebuildChain;
    }
    // Installed last: attach fires onChange immediately, and rebuild() above
    // is ready for it by this point. (dsh ≥ 0.1.2 settings seam: the old
    // module-level installSettingsSection() moved onto the service —
    // ctx.inject wires the optional dependency and settingsCtx.settings
    // owns the section lifecycle, with identical attach/detach semantics.)
    ctx.inject(['settings'], (settingsCtx) => {
        settingsCtx.settings.installSection(ctx, name, Config, config, {
            setSource: (current) => {
                source = current;
            },
            onChange: () => {
                void rebuild();
            },
        });
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