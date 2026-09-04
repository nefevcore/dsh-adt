import { type DestinationConfig, type PluginConfig } from './config.js';
import { type HostProfile } from './hostprofile.js';
/** One loaded workspace file: its absolute path and the validated layer. */
interface WorkspaceLayer {
    path: string;
    layer: Partial<PluginConfig>;
}
/**
 * mtime+size-cached synchronous loader/writer for workspace config files.
 * One instance lives on the AdtRegistry; the FILE layer stays synchronous so
 * `viewFor`/`require` only ever await password resolution, never file I/O.
 * The host profile (from the registry) fixes TWO host properties for the
 * store's lifetime: the config DIRECTORY the file lives in
 * (`HostProfile.workspaceConfigDir`) and the voice of the self-documenting
 * comments (see {@link workspaceFileHeader} / {@link passwordRefChain}).
 */
export declare class WorkspaceConfigStore {
    private readonly hostProfile?;
    private cache;
    constructor(hostProfile?: HostProfile | undefined);
    /** First existing candidate path for a cwd (undefined when none exists). */
    existingPath(cwd: string): string | undefined;
    /**
     * Load the workspace layer for a cwd (stat-cached). Returns undefined when
     * no workspace file exists. Throws (with the path) when the file exists
     * but is invalid — a broken config must fail loudly, mirroring the global
     * file loader.
     */
    load(cwd: string): WorkspaceLayer | undefined;
    /** Drop every cached entry (registry reload/dispose). */
    clear(): void;
    /**
     * Atomically write a workspace layer for a cwd. `mutate` receives the
     * CURRENT raw layer (or `{}` for a fresh file — no schema defaults minted,
     * so unset options stay unset) and returns the next one; the write is
     * tmp+rename so a crash can never tear the file. The rendered body lists
     * every unset option as a commented template (see renderWorkspaceConfig),
     * and the file lands in the host-declared config directory under the
     * store's profile (constructor). Returns the written path and layer.
     */
    write(cwd: string, mutate: (current: Partial<PluginConfig>) => Partial<PluginConfig>): {
        path: string;
        layer: Partial<PluginConfig>;
    };
}
/**
 * Upsert one destination into a workspace layer: replaces a same-name entry
 * in place (keeping the list order) or appends it. Returns whether the entry
 * is new (created) or replaced (updated).
 */
export declare function upsertDestination(layer: Partial<PluginConfig>, dest: DestinationConfig): {
    layer: Partial<PluginConfig>;
    created: boolean;
};
/** Suggested destination name for a GUI connection label: "IMPC S4 DEV 100" -> "impc-s4-dev-100". */
export declare function destinationNameFromLabel(label: string): string;
export {};
//# sourceMappingURL=workspace.d.ts.map