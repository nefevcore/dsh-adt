/**
 * Workspace-scoped destination config: `<cwd>/.dsh-abap-adt/destinations.yaml`.
 *
 * A session's workspace is its working directory (`exec.agent.session.header
 * .cwd`). The plugin's preset mount is SHARED across every session on the
 * preset (a standing mount), so the workspace file cannot participate in the
 * one-shot plugin-load resolution — it is resolved per tool call instead
 * (see registry.ts `viewFor()`), synchronized through this store with an
 * mtime+size cache so the typical call pays one `stat`.
 *
 * The same schema as every other config layer applies (validated by
 * `parseExternalConfigText`); a broken file fails loudly with its path.
 * `adt_create_destination` writes here (atomic tmp+rename, like the lock
 * ledger), and manual edits hot-apply on the next tool call.
 */
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { stringify } from 'yaml';
import { parseExternalConfigText, validateExternalConfig, workspaceConfigCandidates, } from './config.js';
/** Header comment written above managed workspace config files. */
const WORKSPACE_FILE_HEADER = '# abap-adt workspace destinations — created by adt_create_destination.\n' +
    '# Manual edits are welcome; changes hot-apply on the next adt_* tool call.\n' +
    '# Layering: this file overrides ~/.dsh/settings.yaml `abap-adt:` (nearest wins).\n';
/**
 * mtime+size-cached synchronous loader/writer for workspace config files.
 * One instance lives on the AdtRegistry; the FILE layer stays synchronous so
 * `viewFor`/`require` only ever await password resolution, never file I/O.
 */
export class WorkspaceConfigStore {
    cache = new Map();
    /** First existing candidate path for a cwd (undefined when none exists). */
    existingPath(cwd) {
        return workspaceConfigCandidates(cwd).find((candidate) => {
            try {
                return statSync(candidate).isFile();
            }
            catch {
                return false;
            }
        });
    }
    /**
     * Load the workspace layer for a cwd (stat-cached). Returns undefined when
     * no workspace file exists. Throws (with the path) when the file exists
     * but is invalid — a broken config must fail loudly, mirroring the global
     * file loader.
     */
    load(cwd) {
        const path = this.existingPath(cwd);
        if (path === undefined)
            return undefined;
        let stats;
        try {
            stats = statSync(path);
        }
        catch {
            // deleted between the exists probe and the stat — treat as absent
            this.cache.delete(path);
            return undefined;
        }
        const cached = this.cache.get(path);
        if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
            return { path, layer: cached.layer };
        }
        const layer = parseExternalConfigText(readFileSync(path, 'utf8'), path);
        this.cache.set(path, { mtimeMs: stats.mtimeMs, size: stats.size, layer });
        return { path, layer };
    }
    /** Drop every cached entry (registry reload/dispose). */
    clear() {
        this.cache.clear();
    }
    /**
     * Atomically write a workspace layer for a cwd. `mutate` receives the
     * CURRENT validated layer (or `{}` for a fresh file) and returns the next
     * one; the write is tmp+rename so a crash can never tear the file.
     * Returns the written path and the persisted layer.
     */
    write(cwd, mutate) {
        // Preferred path: an existing file, else the primary (.yaml) candidate.
        const path = this.existingPath(cwd) ?? workspaceConfigCandidates(cwd)[0];
        let current = {};
        try {
            current = parseExternalConfigText(readFileSync(path, 'utf8'), path);
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
        const next = mutate(JSON.parse(JSON.stringify(current)));
        // Fail fast on an invalid result (same validator as every read path).
        const plain = toPlainConfig(next);
        const validated = validateExternalConfig(plain, path);
        const body = stringify(plain, { lineWidth: 0 });
        mkdirSync(dirname(path), { recursive: true });
        const tmp = join(dirname(path), `.${Math.random().toString(36).slice(2)}.tmp`);
        writeFileSync(tmp, WORKSPACE_FILE_HEADER + body, 'utf8');
        renameSync(tmp, path);
        // Refresh the cache so the very next call sees the new state.
        const stats = statSync(path);
        this.cache.set(path, { mtimeMs: stats.mtimeMs, size: stats.size, layer: validated });
        return { path, layer: validated };
    }
}
/**
 * Strip `undefined` values and drop the self-referential `configFile` key so
 * `yaml.stringify` emits a clean document (JSON round-trip also drops
 * undefined — belt and braces for schemastery-minted objects).
 */
function toPlainConfig(layer) {
    const { configFile: _configFile, ...rest } = layer;
    return JSON.parse(JSON.stringify(rest));
}
/**
 * Upsert one destination into a workspace layer: replaces a same-name entry
 * in place (keeping the list order) or appends it. Returns whether the entry
 * is new (created) or replaced (updated).
 */
export function upsertDestination(layer, dest) {
    const list = [...(layer.destinations ?? [])];
    const index = list.findIndex((entry) => entry.name === dest.name);
    const created = index === -1;
    if (created)
        list.push(dest);
    else
        list[index] = dest;
    return { layer: { ...layer, destinations: list }, created };
}
/** Suggested destination name for a GUI connection label: "IMPC S4 DEV 100" -> "impc-s4-dev-100". */
export function destinationNameFromLabel(label) {
    const slug = label
        .trim()
        .toLowerCase()
        .replace(/[\[\](){}]+/g, ' ')
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return slug || 'sap-system';
}
//# sourceMappingURL=workspace.js.map