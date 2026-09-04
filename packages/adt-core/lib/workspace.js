/**
 * Workspace-scoped destination config:
 * `<cwd>/<host config dir>/destinations.yaml` (host-declared dir, default
 * '.dsh-abap-adt' — see hostprofile.ts / config.ts).
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
 *
 * Written files are SELF-DOCUMENTING: every option the writer did not set is
 * emitted as a commented line carrying its default and a one-line purpose
 * (see {@link renderWorkspaceConfig}), so hand-editing needs no schema
 * knowledge. To keep unset options unset across managed rewrites, `write()`
 * parses the current file RAW (no schemastery default minting) before
 * mutating — a validated read would materialize `strictSSL`/`timeoutMs`/
 * `defaultDestination` defaults into the file.
 */
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { stringify } from 'yaml';
import { parseExternalConfigText, parseYamlDocument, passwordRefNames, validateExternalConfig, workspaceConfigCandidates, } from './config.js';
import { POLICY_DEFAULTS, POLICY_ENV, POLICY_KEYS } from './policy.js';
import { globalConfigSentence, passwordRefChain, workspaceConfigDirOf, } from './hostprofile.js';
/**
 * Header comment written above managed workspace config files. Host-voiced:
 * the layering line names the host's global config layer when the caller
 * detected a host profile (see hostprofile.ts), else stays host-neutral.
 */
function workspaceFileHeader(profile) {
    return ('# abap-adt workspace destinations — created by adt_create_destination.\n' +
        '# Manual edits are welcome; changes hot-apply on the next adt_* tool call.\n' +
        `# Layering: ${globalConfigSentence(profile)} (nearest wins).\n` +
        '# Every option left unset is listed below as a commented line with its\n' +
        '# default — uncomment (and edit) a line to set it. Managed writes keep the\n' +
        '# values you set and regenerate the commented templates.\n');
}
// ---------------------------------------------------------------------------
// Self-documenting YAML rendering
// ---------------------------------------------------------------------------
/** YAML-serialize one scalar (round-trip-safe quoting, e.g. "100" stays text). */
function scalar(value) {
    return stringify(value).trim();
}
/**
 * Serialize a value as YAML lines under `key` at the given indent: scalars
 * inline, arrays as a block sequence (`key:\n  - item`) — inline sequences
 * (`key: - item`) are NOT valid YAML.
 */
function yamlValueLines(key, value, indent) {
    if (Array.isArray(value)) {
        if (value.length === 0)
            return [`${indent}${key}: []`];
        return [`${indent}${key}:`, ...value.map((item) => `${indent}  - ${scalar(item)}`)];
    }
    return [`${indent}${key}: ${scalar(value)}`];
}
/** Cap for the column the `# description` is padded to (long ref names exist). */
const TEMPLATE_PAD_CAP = 48;
/** Render one commented template line, descriptions vertically aligned. */
function templateLine(indent, template, width) {
    if (template.description === '')
        return `${indent}# ${template.label}`;
    const pad = template.label.length >= width ? '  ' : ' '.repeat(width - template.label.length + 2);
    return `${indent}# ${template.label}${pad}# ${template.description}`;
}
function templateWidth(templates) {
    return Math.min(Math.max(0, ...templates.map((t) => t.label.length)), TEMPLATE_PAD_CAP);
}
/** One-line purposes of the policy keys (full semantics in policy.ts). */
const POLICY_DESCRIPTIONS = {
    enableTransports: 'allow the transport tool family and transport usage',
    allowedTransports: 'comma-separated glob allowlist of transport numbers',
    allowTransportableEdits: 'allow edits in transportable (non-$TMP) packages',
    allowedPackages: 'glob allowlist of editable packages',
    allowExecution: 'allow running programs/classes via adt_execute',
    allowBatchWrites: 'allow write parts inside adt_batch',
    blockedTablesProfile: 'read-side governance of adt_data_preview row reads (off|minimal|standard|strict)',
    blockedTables: 'extra blocked table names/patterns (SAP-name globs) added on top of the catalog',
    allowedTables: 'exemptions from the blocked-table catalog — audited on every use',
    allowDebugger: 'allow the ABAP debugger tool family (adt_debug_*) — holds a stateful session',
    allowDebugVariables: 'allow changing debuggee variable values in the debugger — double opt-in',
    profile: 'destination environment profile (dev|qa|prd) — only meaningful inside a destinations entry',
};
const POLICY_KEY_SET = new Set(POLICY_KEYS);
/**
 * Render a workspace layer as self-documenting YAML: set keys as real lines
 * (canonical order), every known-but-unset option as a commented template
 * with its default and purpose. Keys the schema accepts but a workspace file
 * never acts on (demo/demoPort) are preserved when set but not advertised.
 */
function renderWorkspaceConfig(layer, profile) {
    const record = layer;
    const lines = [];
    const templates = [];
    const emit = (key, template) => {
        if (record[key] !== undefined)
            lines.push(...yamlValueLines(key, record[key], ''));
        else
            templates.push(template);
    };
    emit('defaultDestination', {
        label: `defaultDestination: ${scalar(layer.destinations?.[0]?.name ?? 'dev')}`,
        description: 'destination used when a tool call omits `destination`',
    });
    for (const key of POLICY_KEYS) {
        emit(key, {
            label: `${key}: ${scalar(POLICY_DEFAULTS[key])}`,
            description: `${POLICY_DESCRIPTIONS[key]} (or env ${POLICY_ENV[key]})`,
        });
    }
    // Other set scalar keys (accepted, inert in the workspace layer): verbatim.
    // (No undefined check needed: the writer feeds a JSON-round-tripped layer.)
    for (const key of Object.keys(record)) {
        if (key === 'destinations' || key === 'defaultDestination' || POLICY_KEY_SET.has(key))
            continue;
        lines.push(...yamlValueLines(key, record[key], ''));
    }
    for (const template of templates)
        lines.push(templateLine('', template, templateWidth(templates)));
    if (record.destinations !== undefined) {
        const destinations = record.destinations;
        if (destinations.length === 0) {
            lines.push('destinations: []');
        }
        else {
            if (lines.length > 0)
                lines.push('');
            lines.push('destinations:');
            for (const dest of destinations)
                renderDestination(dest, lines, profile);
        }
    }
    return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}
/** Render one destination entry: real lines for set keys, then the commented
 *  template menu for the rest (same canonical order as the config schema). */
function renderDestination(dest, lines, profile) {
    const record = dest;
    lines.push(`  - name: ${scalar(dest.name)}`);
    lines.push(`    url: ${scalar(dest.url)}`);
    const templates = [];
    const emit = (key, template) => {
        if (record[key] !== undefined)
            lines.push(`    ${key}: ${scalar(record[key])}`);
        else
            templates.push(template);
    };
    emit('client', { label: `client: ${scalar('000')}`, description: 'SAP client (mandant), e.g. "100"' });
    emit('language', { label: `language: ${scalar('EN')}`, description: 'logon language' });
    emit('username', { label: `username: ${scalar('YOUR_USER')}`, description: 'ABAP user name' });
    emit('password', {
        label: `password: ${scalar('CHANGE_ME')}`,
        description: `plaintext password stored IN THIS FILE — prefer passwordEnv (${passwordRefChain(profile)})`,
    });
    emit('passwordEnv', {
        label: `passwordEnv: ${scalar(passwordRefNames(dest)[0])}`,
        description: `credential reference: ${passwordRefChain(profile)}`,
    });
    emit('strictSSL', {
        label: `strictSSL: ${scalar(true)}`,
        description: 'verify TLS certificates — false for self-signed intranet certificates',
    });
    emit('timeoutMs', { label: `timeoutMs: ${scalar(60_000)}`, description: 'request timeout in milliseconds' });
    emit('profile', {
        label: `profile: ${scalar('dev')}`,
        description: 'environment tier: dev plain knobs, qa defaults execution/batchWrites/debugger off, prd hard-denies them',
    });
    renderDestPolicy(record.policy, lines, templates);
    const width = templateWidth(templates);
    for (const template of templates)
        lines.push(templateLine('    ', template, width));
}
/** Render a destination's `policy:` block — real, empty, or fully commented. */
function renderDestPolicy(policy, lines, templates) {
    if (policy === undefined) {
        // Whole-block template; the keys themselves are documented at file level.
        templates.push({
            label: 'policy:',
            description: 'per-destination permission overrides (keys as above, no env fallback)',
        });
        for (const key of POLICY_KEYS) {
            templates.push({ label: `  ${key}: ${scalar(POLICY_DEFAULTS[key])}`, description: '' });
        }
        return;
    }
    const policyRecord = policy;
    if (Object.keys(policyRecord).length === 0) {
        lines.push('    policy: {}');
        return;
    }
    lines.push('    policy:');
    const inner = [];
    for (const key of POLICY_KEYS) {
        if (policyRecord[key] !== undefined)
            lines.push(...yamlValueLines(key, policyRecord[key], '      '));
        else
            inner.push({ label: `${key}: ${scalar(POLICY_DEFAULTS[key])}`, description: POLICY_DESCRIPTIONS[key] });
    }
    const width = templateWidth(inner);
    for (const template of inner)
        lines.push(templateLine('      ', template, width));
}
/**
 * Parse workspace config text RAW — comments dropped, values exactly as
 * written, NO schemastery default minting (unlike `parseExternalConfigText`)
 * — so a managed rewrite never materializes defaults into the file. Returns
 * `{}` for an empty document; throws with the path on invalid YAML.
 */
function parseRawLayer(raw, path) {
    const parsed = parseYamlDocument(raw, path);
    if (parsed === null || parsed === undefined)
        return {};
    return parsed;
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
export class WorkspaceConfigStore {
    hostProfile;
    cache = new Map();
    constructor(hostProfile) {
        this.hostProfile = hostProfile;
    }
    /** First existing candidate path for a cwd (undefined when none exists). */
    existingPath(cwd) {
        return workspaceConfigCandidates(cwd, workspaceConfigDirOf(this.hostProfile)).find((candidate) => {
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
     * CURRENT raw layer (or `{}` for a fresh file — no schema defaults minted,
     * so unset options stay unset) and returns the next one; the write is
     * tmp+rename so a crash can never tear the file. The rendered body lists
     * every unset option as a commented template (see renderWorkspaceConfig),
     * and the file lands in the host-declared config directory under the
     * store's profile (constructor). Returns the written path and layer.
     */
    write(cwd, mutate) {
        // Preferred path: an existing file, else the primary (.yaml) candidate.
        const path = this.existingPath(cwd) ??
            workspaceConfigCandidates(cwd, workspaceConfigDirOf(this.hostProfile))[0];
        let current = {};
        let raw;
        try {
            raw = readFileSync(path, 'utf8');
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
        if (raw !== undefined)
            current = parseRawLayer(raw, path);
        const next = mutate(JSON.parse(JSON.stringify(current)));
        // Fail fast on an invalid result (same validator as every read path).
        const plain = toPlainConfig(next);
        const validated = validateExternalConfig(plain, path);
        const body = renderWorkspaceConfig(plain, this.hostProfile);
        mkdirSync(dirname(path), { recursive: true });
        const tmp = join(dirname(path), `.${Math.random().toString(36).slice(2)}.tmp`);
        writeFileSync(tmp, workspaceFileHeader(this.hostProfile) + body, 'utf8');
        renameSync(tmp, path);
        // Refresh the cache so the very next call sees the new state.
        const stats = statSync(path);
        this.cache.set(path, { mtimeMs: stats.mtimeMs, size: stats.size, layer: validated });
        return { path, layer: validated };
    }
}
/**
 * Strip `undefined` values and drop the self-referential `configFile` key so
 * the renderer emits a clean document (JSON round-trip also drops undefined —
 * belt and braces for schemastery-minted objects).
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