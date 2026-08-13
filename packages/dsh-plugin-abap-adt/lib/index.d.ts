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
declare const name = "abap-adt";
declare const inject: string[];
/** Apply the plugin: build the destination registry and register every tool. */
declare function apply(ctx: Context, config: PluginConfig): Promise<() => Promise<void>>;
export { Config, apply, inject, name };
export type { PluginConfig };
export { AdtRegistry } from './registry.js';
export { TYPE_MAP, resolveObject, resolveObjects, refFromName, normalizeType, typeLabel } from './resolve.js';
export { AdtClient, AdtError } from '@abap-adt/protocol';
export { createMockAdtServer } from '@abap-adt/mock';
//# sourceMappingURL=index.d.ts.map