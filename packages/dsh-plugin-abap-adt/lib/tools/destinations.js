/**
 * Destination-management tools (workspace config):
 *
 *   - `adt_list_gui_connections` — search the local SAP GUI (SAP Logon)
 *     landscape so the agent can offer the user matching systems to import.
 *   - `adt_create_destination` — create or update a destination in the
 *     session workspace file `<cwd>/.dsh-abap-adt/destinations.yaml`, either
 *     from explicit fields or by importing a discovered GUI connection.
 *
 * Together they cover the conversational flow: the user asks for a
 * connection ("create the impc config"), the agent searches the GUI
 * landscape, either offers the matches for a choice or — when no GUI is
 * installed — asks for url/client/username, then writes the file. The next
 * `adt_*` call in the same workspace sees the new destination (the registry
 * resolves the workspace layer per call).
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { cwd as nodeCwd } from 'node:process';
import { passwordRefNames } from '../config.js';
import { credentialsOf, isCredentialRefName } from '../credentials.js';
import { discoverSapGuiLandscape, searchSapGuiConnections, } from '../sapgui.js';
import { destinationNameFromLabel } from '../workspace.js';
import { sessionCwd, text } from './common.js';
/** Connection schema shared by both tools (as returned to the model). */
const GUI_CONNECTION_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        uuid: { type: 'string', required: true },
        name: { type: 'string', required: true },
        kind: { type: 'string', required: true, description: 'direct | group | reference' },
        systemId: { type: 'string' },
        folder: { type: 'string', description: 'Folder path inside SAP Logon, when discoverable.' },
        client: { type: 'string' },
        user: { type: 'string' },
        language: { type: 'string' },
        host: { type: 'string' },
        sysnr: { type: 'string' },
        router: { type: 'string' },
        groupName: { type: 'string' },
        msHost: { type: 'string' },
        adtUrl: { type: 'string', description: 'Derived ADT base URL (HTTPS port convention).' },
        httpUrl: { type: 'string', description: 'Plain-HTTP alternative.' },
        adtUrlNote: { type: 'string', description: 'Caveat about the URL, or why none could be derived.' },
    },
};
function connectionView(c) {
    return {
        uuid: c.uuid,
        name: c.name,
        kind: c.kind,
        systemId: c.systemId,
        folder: c.folder,
        client: c.client,
        user: c.user,
        language: c.language,
        host: c.host,
        sysnr: c.sysnr,
        router: c.router,
        groupName: c.groupName,
        msHost: c.msHost,
        adtUrl: c.adtUrl,
        httpUrl: c.httpUrl,
        adtUrlNote: c.adtUrlNote,
    };
}
/** String arg TRIMMED to a non-empty value, else `undefined` (unlike common
 *  `optStr`, which does not trim — destinations are user-typed free text). */
function trimmedArgStr(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
export function destinationTools(deps, ctx) {
    const { registry } = deps;
    return [
        defineTool({
            name: 'adt_list_gui_connections',
            description: 'Search the LOCAL SAP GUI (SAP Logon) connection list — SAPUILandscape.xml / saplogon.ini of this ' +
                'machine — for systems to reuse as ADT destinations. Use it when the user wants a connection ' +
                'configured and may already have it in SAP GUI: search by name/system id/client (e.g. query "impc"), ' +
                'present the matches, and after the user picks one call adt_create_destination with its uuid. ' +
                'Each match carries a derived adtUrl (from the GUI app server via the SAP port convention); ' +
                '"group" entries cannot yield a URL and need an explicit one.',
            parameters: {
                query: {
                    type: 'string',
                    description: 'Case-insensitive filter over name, system id, folder, client and stored user. Multiple ' +
                        'terms (space-separated) must ALL match — e.g. "impc qas". Omit to list everything (up to the limit).',
                },
                limit: { type: 'integer', description: 'Max matches to return (default 25, max 100).' },
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        available: { type: 'boolean', required: true },
                        sources: { type: 'array', required: true, items: { type: 'string' } },
                        connections: { type: 'array', required: true, items: GUI_CONNECTION_SCHEMA },
                        truncated: { type: 'boolean' },
                        message: { type: 'string', description: 'Present when no SAP GUI landscape was found.' },
                    },
                },
                render: (_args, value) => {
                    if (!value.available) {
                        return text((value.message ?? 'No SAP GUI connection list found on this machine.') +
                            '\nAsk the user for url, client, username (and a passwordEnv or ADT_*_PASSWORD ' +
                            'convention), then call adt_create_destination with explicit fields.');
                    }
                    const lines = value.connections.map((c) => {
                        const bits = [
                            `- [${c.kind}] ${c.name}`,
                            c.systemId ? `sid=${c.systemId}` : undefined,
                            c.folder ? `in "${c.folder}"` : undefined,
                            c.client ? `client=${c.client}` : undefined,
                            c.user ? `user=${c.user}` : undefined,
                            c.adtUrl ? `url=${c.adtUrl}` : `NO URL (${c.adtUrlNote ?? 'not derivable'})`,
                        ].filter((part) => part !== undefined);
                        return `${bits.join(' · ')}${c.uuid ? ` · uuid=${c.uuid}` : ''}`;
                    });
                    return text([
                        `SAP GUI landscape: ${value.sources.join(', ')}`,
                        ...lines,
                        value.truncated ? '(truncated — raise the limit or use a query)' : '',
                    ]
                        .filter((line) => line !== '')
                        .join('\n'));
                },
            },
            isConcurrencySafe: () => true,
            execute: async (args) => {
                const landscape = discoverSapGuiLandscape();
                if (landscape.sources.length === 0) {
                    return {
                        available: false,
                        sources: [],
                        connections: [],
                        message: 'No SAP GUI (SAP Logon) landscape found on this machine ' +
                            '(looked for SAPUILandscape.xml / saplogon.ini under the SAP Common directory; ' +
                            'set ADT_SAPGUI_LANDSCAPE to point at a landscape file if it lives elsewhere). ' +
                            'Ask the user for the connection details instead.',
                    };
                }
                const limit = Math.min(Math.max(Number(args.limit ?? 25) || 25, 1), 100);
                const matches = searchSapGuiConnections(landscape.connections, trimmedArgStr(args.query));
                return {
                    available: true,
                    sources: landscape.sources,
                    connections: matches.slice(0, limit).map(connectionView),
                    truncated: matches.length > limit,
                };
            },
        }),
        defineTool({
            name: 'adt_create_destination',
            description: 'Create (or update) an ADT destination in the session WORKSPACE file .dsh-abap-adt/destinations.yaml — ' +
                'hot-applies to every following adt_* call in this workspace. Two modes: ' +
                '(1) import a SAP GUI connection — pass `guiUuid` from adt_list_gui_connections (url/client/language/' +
                'username default from the GUI entry; override any of them explicitly); ' +
                '(2) manual — pass at least `name` and `url`. Passwords: pass `password` and it is stored in the DSH ' +
                'credential store (~/.dsh/.credentials.yaml, referenced from the file via `passwordEnv` — never written ' +
                'to destinations.yaml); when no credential service is available, or `passwordInFile: true`, the password ' +
                'is written plaintext into destinations.yaml (avoid committing that file). Without `password`, maintain ' +
                'the credential yourself under the ADT_<NAME>_PASSWORD reference. After creating, verify with adt_ping.',
            parameters: {
                name: {
                    type: 'string',
                    description: 'Destination name (required in manual mode; defaults to a slug of the GUI entry name in import mode).',
                },
                url: {
                    type: 'string',
                    description: 'Base URL of the ABAP frontend, e.g. https://sap.example.com:44301. Required in manual mode; ' +
                        'in import mode overrides the URL derived from the GUI entry (use when a web dispatcher serves /sap/bc/adt).',
                },
                client: { type: 'string', description: 'SAP client (mandant). Defaults: GUI entry, else 000.' },
                language: { type: 'string', description: 'Logon language (GUI entry, else EN).' },
                username: { type: 'string', description: 'ABAP user (GUI shortcut entry when present).' },
                password: {
                    type: 'string',
                    description: 'Password for `username`. Stored in the DSH credential store (~/.dsh/.credentials.yaml) and ' +
                        'referenced via passwordEnv — not written to destinations.yaml (unless passwordInFile).',
                },
                passwordEnv: {
                    type: 'string',
                    description: 'Reference name for the password (environment-variable style, e.g. ADT_DEV_PASSWORD). Default: ' +
                        'ADT_<NAME>_PASSWORD. DSH resolves it layer-wise: process env > ~/.dsh/.credentials.yaml > .env files.',
                },
                passwordInFile: {
                    type: 'boolean',
                    description: 'Write the password PLAINTEXT into destinations.yaml instead of the credential store (not recommended; ' +
                        'defaults to false and falls back to it automatically when no credential service is mounted).',
                },
                strictSSL: {
                    type: 'boolean',
                    description: 'Verify TLS certificates. GUI imports default to false (intranet self-signed is common); manual mode defaults to true.',
                },
                timeoutMs: { type: 'integer', description: 'Request timeout in ms (default 60000).' },
                guiUuid: { type: 'string', description: 'uuid of a connection from adt_list_gui_connections to import.' },
                setDefault: { type: 'boolean', description: 'Also make this the workspace default destination.' },
                overwrite: { type: 'boolean', description: 'Allow replacing an existing destination of the same name.' },
                ping: { type: 'boolean', description: 'Probe the destination right after saving (default false).' },
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        file: { type: 'string', required: true },
                        action: { type: 'string', required: true, description: 'created | updated' },
                        destination: {
                            type: 'object',
                            required: true,
                            additionalProperties: false,
                            properties: {
                                name: { type: 'string', required: true },
                                url: { type: 'string', required: true },
                                client: { type: 'string' },
                                language: { type: 'string' },
                                username: { type: 'string' },
                                passwordEnv: { type: 'string' },
                                strictSSL: { type: 'boolean' },
                                timeoutMs: { type: 'integer' },
                            },
                        },
                        setAsDefault: { type: 'boolean', required: true },
                        passwordStoredIn: {
                            type: 'string',
                            description: 'Where a supplied password went: credential-store (~/.dsh/.credentials.yaml) | file (plaintext).',
                        },
                        importedFromGui: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                uuid: { type: 'string', required: true },
                                name: { type: 'string', required: true },
                                kind: { type: 'string', required: true },
                                systemId: { type: 'string' },
                            },
                        },
                        shadowsGlobal: { type: 'boolean', required: true },
                        notes: { type: 'array', required: true, items: { type: 'string' } },
                        ping: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                ok: { type: 'boolean', required: true },
                                detail: { type: 'string', required: true },
                            },
                        },
                        hint: { type: 'string', required: true },
                    },
                },
                render: (_args, value) => text([
                    `${value.action === 'created' ? 'Created' : 'Updated'} destination "${value.destination.name}" ` +
                        `-> ${value.destination.url} (client ${value.destination.client ?? '000'}) in`,
                    `  ${value.file}`,
                    value.setAsDefault ? '  (set as the workspace default destination)' : '',
                    value.importedFromGui
                        ? `  imported from SAP GUI: ${value.importedFromGui.name} (${value.importedFromGui.uuid})`
                        : '',
                    value.passwordStoredIn === 'credential-store'
                        ? '  password stored in the DSH credential store (~/.dsh/.credentials.yaml)'
                        : value.passwordStoredIn === 'file'
                            ? '  password written PLAINTEXT into the file — do not commit it'
                            : '',
                    value.ping ? `  ping: ${value.ping.ok ? 'OK' : 'FAILED'} — ${value.ping.detail}` : '',
                    ...value.notes.map((note) => `  note: ${note}`),
                    `  next: ${value.hint}`,
                ]
                    .filter((line) => line !== '')
                    .join('\n')),
            },
            isConcurrencySafe: () => false,
            execute: async (args, exec) => {
                const password = trimmedArgStr(args.password);
                const passwordInFile = args.passwordInFile === true;
                const cwd = sessionCwd(exec) ?? nodeCwd();
                const guiUuid = trimmedArgStr(args.guiUuid);
                const notes = [];
                let importedFromGui;
                let name = trimmedArgStr(args.name);
                let url = trimmedArgStr(args.url);
                let client = trimmedArgStr(args.client);
                let language = trimmedArgStr(args.language);
                let username = trimmedArgStr(args.username);
                let strictSSL = typeof args.strictSSL === 'boolean' ? args.strictSSL : undefined;
                if (guiUuid !== undefined) {
                    const landscape = discoverSapGuiLandscape();
                    const entry = landscape.connections.find((c) => c.uuid.toLowerCase() === guiUuid.toLowerCase());
                    if (!entry) {
                        throw new Error(`guiUuid "${guiUuid}" not found in the SAP GUI landscape${landscape.sources.length ? ` (${landscape.sources.join(', ')})` : ' (no landscape file found)'}. ` +
                            'Call adt_list_gui_connections to see the available entries and their uuids.');
                    }
                    if (entry.adtUrl === undefined && url === undefined) {
                        throw new Error(`"${entry.name}" cannot be imported directly: ${entry.adtUrlNote ?? 'no ADT URL derivable'}. ` +
                            'Pass an explicit `url` (application server or web dispatcher) to create the destination anyway.');
                    }
                    name ??= destinationNameFromLabel(entry.name);
                    url ??= entry.adtUrl;
                    client ??= entry.client ?? '000';
                    language ??= entry.language ?? 'EN';
                    username ??= entry.user;
                    if (strictSSL === undefined) {
                        strictSSL = false; // GUI entries carry no certificate information; intranet self-signed is common
                        notes.push('strictSSL defaulted to false (GUI import — intranet self-signed certificates are common); set strictSSL: true when the server has a trusted certificate');
                    }
                    if (entry.router) {
                        notes.push(`SAP GUI reaches this system through a saprouter (${entry.router}); ADT requires direct HTTP(S) access to the url — verify reachability with adt_ping`);
                    }
                    importedFromGui = { uuid: entry.uuid, name: entry.name, kind: entry.kind, systemId: entry.systemId };
                }
                if (!name)
                    throw new Error('adt_create_destination: `name` is required (manual mode) or pass `guiUuid` to import a GUI connection.');
                if (!url)
                    throw new Error('adt_create_destination: `url` is required (manual mode) or pass `guiUuid` to import a GUI connection.');
                let parsedUrl;
                try {
                    parsedUrl = new URL(url);
                }
                catch {
                    throw new Error(`adt_create_destination: \`url\` is not a valid absolute URL: ${url}`);
                }
                if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                    throw new Error(`adt_create_destination: \`url\` must be http(s), got ${parsedUrl.protocol}`);
                }
                if (/\s/.test(name) || /[\/\\]/.test(name)) {
                    const slug = destinationNameFromLabel(name);
                    throw new Error(`adt_create_destination: destination name must not contain spaces or path separators (got "${name}"); ` +
                        `suggested name: "${slug}"`);
                }
                const destOut = { name, url: parsedUrl.toString().replace(/\/+$/, '') };
                if (client !== undefined)
                    destOut.client = client;
                if (language !== undefined)
                    destOut.language = language;
                if (username !== undefined)
                    destOut.username = username;
                const passwordEnv = trimmedArgStr(args.passwordEnv);
                if (passwordEnv !== undefined)
                    destOut.passwordEnv = passwordEnv;
                if (strictSSL !== undefined)
                    destOut.strictSSL = strictSSL;
                if (typeof args.timeoutMs === 'number')
                    destOut.timeoutMs = args.timeoutMs;
                // --- Password handling -------------------------------------------------
                // With a password supplied: prefer the DSH credential store (the value
                // lives in ~/.dsh/.credentials.yaml and is referenced from the file by
                // name); write plaintext into destinations.yaml only when explicitly
                // asked for or when no credential service is mounted.
                const passwordRef = destOut.passwordEnv ?? passwordRefNames({ name })[0];
                let passwordStoredIn;
                if (password !== undefined) {
                    if (!isCredentialRefName(passwordRef)) {
                        throw new Error(`adt_create_destination: passwordEnv "${passwordRef}" is not a valid credential reference ` +
                            '(POSIX environment-variable name, e.g. ADT_DEV_PASSWORD)');
                    }
                    destOut.passwordEnv = passwordRef;
                    const service = credentialsOf(ctx);
                    if (!passwordInFile && service?.set !== undefined) {
                        try {
                            await service.set(passwordRef, password);
                            passwordStoredIn = 'credential-store';
                            notes.push(`password stored in the DSH credential store (reference ${passwordRef}; backing file ~/.dsh/.credentials.yaml) — destinations.yaml keeps only the reference`);
                        }
                        catch (error) {
                            // e.g. a read-only source (machine env var of the same name)
                            // shadows the store; fall back to the file so the destination
                            // still works, and say why.
                            destOut.password = password;
                            passwordStoredIn = 'file';
                            notes.push(`credential store refused the write (${error.message}); password written PLAINTEXT into destinations.yaml — prefer fixing the ${passwordRef} source`);
                        }
                    }
                    else {
                        destOut.password = password;
                        passwordStoredIn = 'file';
                        notes.push(passwordInFile
                            ? 'password written PLAINTEXT into destinations.yaml as requested (passwordInFile) — do not commit this file, prefer the credential store'
                            : 'no DSH credential service mounted: password written PLAINTEXT into destinations.yaml — do not commit this file');
                    }
                }
                // Never echo the password back in the tool result — the output schema
                // does not carry it; the notes say where it was stored.
                const destinationView = { ...destOut };
                delete destinationView.password;
                // Shadowing check against the shared global table (the workspace file
                // is the nearer layer, so this entry wins for same-name globals).
                const shadowsGlobal = registry.destinations.has(name);
                const setDefault = args.setDefault === true;
                const saved = registry.saveWorkspaceDestination(cwd, destOut, {
                    setDefault,
                    overwrite: args.overwrite === true,
                });
                const hint = username && passwordStoredIn === undefined
                    ? `set the password under reference ${passwordRef} (DSH credential store ~/.dsh/.credentials.yaml or an env var of that name), then verify with adt_ping`
                    : `verify with adt_ping (destination: ${name})`;
                let ping;
                if (args.ping === true) {
                    const entry = (await registry.viewFor(cwd)).destinations.get(name);
                    if (entry) {
                        const status = await entry.client.ping({ signal: exec.signal });
                        ping = { ok: status.ok, detail: status.detail ?? '' };
                    }
                }
                return {
                    file: saved.path,
                    action: saved.created ? 'created' : 'updated',
                    destination: destinationView,
                    setAsDefault: setDefault,
                    importedFromGui,
                    shadowsGlobal,
                    passwordStoredIn,
                    notes,
                    ping,
                    hint,
                };
            },
        }),
    ];
}
//# sourceMappingURL=destinations.js.map