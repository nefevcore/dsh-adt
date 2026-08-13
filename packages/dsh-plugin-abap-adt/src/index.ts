/**
 * @abap-adt/dsh-plugin — DeepSeek Harness plugin for SAP ABAP Development.
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
import { Config, type PluginConfig } from './config.js';
import { AdtRegistry } from './registry.js';
import { systemTools } from './tools/system.js';
import { searchTools } from './tools/search.js';
import { sourceTools } from './tools/source.js';
import { lifecycleTools } from './tools/lifecycle.js';
import { testingTools } from './tools/testing.js';
import { transportTools } from './tools/transports.js';
import { packageTools } from './tools/packages.js';
import { batchTools } from './tools/batch.js';

const name = 'abap-adt';
const inject = ['tools', 'fs'];

/** Apply the plugin: build the destination registry and register every tool. */
async function apply(ctx: Context, config: PluginConfig): Promise<() => Promise<void>> {
  const registry = await AdtRegistry.create(config);

  const deps = { registry };
  const tools = [
    ...systemTools(deps),
    ...searchTools(deps),
    ...sourceTools(deps),
    ...lifecycleTools(deps),
    ...testingTools(deps),
    ...transportTools(deps),
    ...packageTools(deps),
    ...batchTools(deps, ctx),
  ];

  for (const tool of tools) {
    ctx.tools.register(tool);
  }

  const logger = ctx.logger?.(name);
  (logger?.info ?? console.info)(
    `abap-adt plugin active: ${tools.length} tools registered, ` +
      `${registry.destinations.size} destination(s): ${[...registry.destinations.keys()].join(', ') || '(none)'}`,
  );

  // Fiber disposer: close the mock server and drop clients on unload.
  return () => registry.dispose();
}

export { Config, apply, inject, name };
export type { PluginConfig };
export { AdtRegistry } from './registry.js';
export { TYPE_MAP, resolveObject, resolveObjects, refFromName, normalizeType, typeLabel } from './resolve.js';
export { AdtClient, AdtError } from '@abap-adt/protocol';
export { createMockAdtServer } from '@abap-adt/mock';
