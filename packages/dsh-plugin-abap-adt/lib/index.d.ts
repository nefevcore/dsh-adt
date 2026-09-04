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
import { Config, type PluginConfig } from '@nefevcore/abap-adt-core';
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
export { AdtRegistry } from '@nefevcore/abap-adt-core';
export { TYPE_MAP, resolveObject, resolveObjects, refFromName, normalizeType, typeLabel, } from '@nefevcore/abap-adt-core';
export { AdtClient, AdtError } from '@nefevcore/abap-adt-protocol';
export { createMockAdtServer } from '@nefevcore/abap-adt-mock';
//# sourceMappingURL=index.d.ts.map