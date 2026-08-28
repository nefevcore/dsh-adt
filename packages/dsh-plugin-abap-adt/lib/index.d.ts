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
import { Config, type PluginConfig } from './config.js';
declare const name = "abap-adt";
declare const inject: string[];
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
declare function apply(ctx: Context, config: PluginConfig): Promise<() => Promise<void>>;
export { Config, apply, inject, name };
export type { PluginConfig };
export { AdtRegistry } from './registry.js';
export { TYPE_MAP, resolveObject, resolveObjects, refFromName, normalizeType, typeLabel } from './resolve.js';
export { AdtClient, AdtError } from '@nefevcore/abap-adt-protocol';
export { createMockAdtServer } from '@nefevcore/abap-adt-mock';
//# sourceMappingURL=index.d.ts.map