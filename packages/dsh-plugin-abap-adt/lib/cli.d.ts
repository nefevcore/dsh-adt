#!/usr/bin/env node
/** The plugin row appended to the copied composition. */
export declare const PLUGIN_ROW = "\n# --- abap-adt (appended by abap-adt-preset) ---\n# This row is what scopes the adt_* tools to sessions on this preset; the\n# source preset (and global sessions) never loads them.\n# Destinations live in the session WORKSPACE file\n# <workspace>/.dsh-abap-adt/destinations.yaml (create them conversationally\n# with adt_create_destination \u2014 imports from the local SAP GUI \u2014 or by hand);\n# global fallbacks/policy live in ~/.dsh/settings.yaml under abap-adt:\n# (both hot-apply); demo starts an in-process mock destination.\n- id: abap-adt\n  name: '@nefevcore/abap-adt-dsh-plugin'\n  config:\n    demo: true\n";
/** preset.yml body for the generated preset. */
export declare function renderPresetYml(name: string, description: string): string;
/**
 * The default source preset: always `standard` (audit D2). Deliberately NOT
 * the deployment default from settings.yaml — on deployments where that is
 * `cordis`, the copy would drag in the `tool-cordis` row, whose Host Cordis
 * inspect provider collides with an active cordis session at standing mount,
 * and hand every ABAP session the plugin-authoring toolset. `standard` is
 * the same full coding agent without that toolset; `--from` overrides.
 */
export declare function defaultSourcePresetId(): string;
/**
 * Rows stripped from every generated composition (audit D2): plugin-authoring
 * machinery an ABAP session has no use for, which additionally breaks the
 * standing-mount acceptance gate when copied from `cordis`.
 */
export declare const STRIPPED_PRESET_ROWS: string[];
/**
 * Remove top-level `- id: <id>` rows (and their indented continuation lines)
 * from a composition. Comment lines above a stripped row are kept (they are
 * documentation of the source preset); nested (indented) rows are never
 * touched. Returns the cleaned composition plus the ids actually removed.
 */
export declare function stripPresetRows(composition: string, ids: string[]): {
    composition: string;
    removed: string[];
};
/**
 * Locate the installed dsh package root (the directory holding
 * config/agent-presets). Search order, first hit wins:
 *   1. `$DSH_PRESET_SOURCE` (explicit override for exotic layouts)
 *   2. resolvable from the working directory (preset/dep install)
 *   3. `~/node_modules/@deepseek-ai/dsh` (per-user npm prefix layout)
 *   4. `npm root -g` output (global npm layout)
 *   5. `dirname(process.execPath)/node_modules/@deepseek-ai/dsh` (nvm layouts)
 */
export declare function findDshPresetRoot(cwd: string): string | undefined;
/** Parse the minimal flag set this CLI supports. */
interface CliArgs {
    id: string;
    from?: string;
    name: string;
    force: boolean;
    dryRun: boolean;
    help: boolean;
}
export declare function parseArgs(argv: string[]): CliArgs;
export declare function main(argv: string[]): number;
export {};
//# sourceMappingURL=cli.d.ts.map