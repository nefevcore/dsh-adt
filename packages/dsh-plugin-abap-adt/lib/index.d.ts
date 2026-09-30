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
import type { Context } from '@deepseek-ai/cordis';
import type { Volatile } from '@deepseek-ai/cosmokit';
import { Config as CoreConfig, type PluginConfig } from '@nefevcore/abap-adt-core';
/**
 * Loader event contract (declared by `@deepseek-ai/cordis-plugin-loader`,
 * restated here so this package stays dependency-free): volatile config
 * values were committed into the running fiber's references without a
 * remount; dispatched to the owning fiber only, after every value is
 * committed.
 */
declare module '@deepseek-ai/cordis' {
    interface Events {
        'loader/volatile-update'(paths: readonly (readonly string[])[]): void;
    }
}
declare const name = "abap-adt";
/**
 * The DSH entry schema: the core's host-neutral Config wrapped `.volatile()`
 * (DSH ≥ 0.2.0 hot-reload model). The Loader parses the plugin row's config
 * through THIS schema, so the value `apply` receives is a live
 * `Volatile<PluginConfig>` reference: settings edits persist into the active
 * profile's Cordis patch, HMR reconciles the entry, and the Loader commits
 * the new snapshot behind the same reference — emitting
 * `loader/volatile-update` — instead of remounting the plugin.
 */
declare const Config: ReturnType<typeof CoreConfig.volatile>;
declare const inject: string[];
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
declare function apply(ctx: Context, config: Volatile<PluginConfig>): Promise<() => Promise<void>>;
export { Config, apply, inject, name };
export type { PluginConfig };
export { AdtRegistry } from '@nefevcore/abap-adt-core';
export { TYPE_MAP, resolveObject, resolveObjects, refFromName, normalizeType, typeLabel, } from '@nefevcore/abap-adt-core';
export { AdtClient, AdtError } from '@nefevcore/abap-adt-protocol';
export { createMockAdtServer } from '@nefevcore/abap-adt-mock';
//# sourceMappingURL=index.d.ts.map