/**
 * @nefevcore/abap-adt-dsh-plugin — DeepSeek Harness plugin for SAP ABAP Development.
 *
 * Registers the `adt_*` tool family on `ctx.tools`: destinations/system
 * introspection, object search, source read/write/create/delete, activation,
 * syntax checks, ABAP Unit, ATC, transports, packages — plus batch quality
 * checks and local source export that go beyond the interactive VS Code ADT
 * workflow. The plugin speaks the ADT REST protocol directly (no SAP
 * proprietary libraries) and ships a demo mode backed by an in-process mock
 * server for zero-setup end-to-end use.
 */

import { Context } from '@deepseek-ai/cordis';
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings';
import { Config, composeLayers, resolveEffectiveConfig, type PluginConfig } from './config.js';
import { AdtRegistry } from './registry.js';
import { LockLedger } from './locks.js';
import { deepCompact } from './tools/common.js';
import { systemTools } from './tools/system.js';
import { searchTools } from './tools/search.js';
import { sourceTools } from './tools/source.js';
import { lifecycleTools } from './tools/lifecycle.js';
import { testingTools } from './tools/testing.js';
import { atcRunTools } from './tools/atc_runs.js';
import { transportTools } from './tools/transports.js';
import { packageTools } from './tools/packages.js';
import { batchTools } from './tools/batch.js';
import { localTools } from './tools/local.js';
import { whereUsedTools } from './tools/whereused.js';
import { dataPreviewTools } from './tools/datapreview.js';
import { lockTools } from './tools/lock.js';
import { versionTools } from './tools/versions.js';
import { gateTools } from './tools/gate.js';
import { policyTools } from './tools/policy.js';

const name = 'abap-adt';
const inject = ['tools', 'fs'];

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
async function apply(ctx: Context, config: PluginConfig): Promise<() => Promise<void>> {
  const logger = ctx.logger?.(name);
  const warn = (message: string) => (logger?.warn ?? console.warn)(`abap-adt: ${message}`);
  const info = (message: string) => (logger?.info ?? console.info)(`abap-adt: ${message}`);
  const error = (message: string) => (logger?.error ?? console.error)(`abap-adt: ${message}`);

  // Persistent lock ledger: survives process restarts so `adt_unlock_all` can
  // release locks left behind by crashed sessions (see src/locks.ts).
  const ledger = new LockLedger();

  // Settings wiring (optional service): `source()` returns the resolved
  // namespace value while a provider is attached and falls back to the
  // composition entry otherwise. Every attach/detach/change fires onChange —
  // including one synchronously at attach — so all rebuild state and the
  // registry must exist BEFORE the section is installed.
  let source: () => PluginConfig = () => config;
  let rebuildChain: Promise<void> = Promise.resolve();
  let lastSnapshot = '';
  const registry = await AdtRegistry.create(composeLayers([config]));
  async function rebuild(): Promise<void> {
    rebuildChain = rebuildChain.then(async () => {
      try {
        const resolved = source();
        const settingsAttached = resolved !== config;
        const { config: effective, warnings } = await resolveEffectiveConfig({
          entry: config,
          resolved: settingsAttached ? resolved : undefined,
        });
        for (const warning of warnings) warn(warning);
        const snapshot = JSON.stringify(effective);
        if (snapshot === lastSnapshot) return;
        await registry.reload(effective);
        lastSnapshot = snapshot;
        info(
          `config applied: ${registry.destinations.size} destination(s): ` +
            `${[...registry.destinations.keys()].join(', ') || '(none)'}` +
            (settingsAttached ? ' [settings]' : '') +
            (effective.configFileUsed ? `; config file: ${effective.configFileUsed}` : ''),
        );
      } catch (err) {
        error(`config reload failed, keeping last good state: ${(err as Error).message}`);
      }
    });
    return rebuildChain;
  }

  // Installed last: attach fires onChange immediately, and rebuild() above
  // is ready for it by this point.
  installSettingsSection(ctx, settingsNamespace(name), Config, config, {
    setSource: (current) => {
      source = current;
    },
    onChange: () => {
      void rebuild();
    },
  });

  const deps = { registry, ledger };
  const tools = [
    ...systemTools(deps),
    ...searchTools(deps),
    ...sourceTools(deps, ctx),
    ...lifecycleTools(deps),
    ...testingTools(deps),
    ...atcRunTools(deps),
    ...transportTools(deps),
    ...packageTools(deps),
    ...batchTools(deps, ctx),
    ...localTools(deps, ctx),
    ...whereUsedTools(deps),
    ...dataPreviewTools(deps),
    ...lockTools(deps),
    ...versionTools(deps),
    ...gateTools(deps),
    ...policyTools(deps),
  ];

  for (const tool of tools) {
    // Sanitize every tool's output at the registry boundary: strip `undefined`
    // property values so the value passes the DSH lossless-JSON validation
    // (the registry rejects undefined anywhere in the returned value).
    const { execute, ...rest } = tool;
    ctx.tools.register({
      ...rest,
      execute: async (args, exec) => deepCompact(await execute(args, exec)),
    });
  }

  info(`plugin active: ${tools.length} tools registered`);

  // Fiber disposer: close the mock server and drop clients on unload.
  return () => registry.dispose();
}

export { Config, apply, inject, name };
export type { PluginConfig };
export { AdtRegistry } from './registry.js';
export { TYPE_MAP, resolveObject, resolveObjects, refFromName, normalizeType, typeLabel } from './resolve.js';
export { AdtClient, AdtError } from '@nefevcore/abap-adt-protocol';
export { createMockAdtServer } from '@nefevcore/abap-adt-mock';
