/**
 * Destination-management tools (workspace config):
 *
 *   - `adt_list_gui_connections` — search the local SAP GUI (SAP Logon)
 *     landscape so the agent can offer the user matching systems to import.
 *   - `adt_create_destination` — create or update a destination in the
 *     session workspace file `<cwd>/<host config dir>/destinations.yaml`, either
 *     from explicit fields or by importing a discovered GUI connection.
 *
 * Together they cover the conversational flow: the user asks for a
 * connection ("create the impc config"), the agent searches the GUI
 * landscape, either offers the matches for a choice or — when no GUI is
 * installed — asks for url/client/username, then writes the file. The next
 * `adt_*` call in the same workspace sees the new destination (the registry
 * resolves the workspace layer per call).
 */
import { defineTool, type ToolHost } from '../tooldef.js';
import { cwd as nodeCwd } from 'node:process';
import type { DestinationConfig } from '../config.js';
import { passwordRefNames } from '../config.js';
import { credentialsOf, isCredentialRefName } from '../credentials.js';
import {
  credentialStoreNote,
  hostProfileOf,
  passwordReferenceHint,
  passwordResolutionSentence,
  plaintextFallbackNote,
  workspaceConfigLocationLabel,
} from '../hostprofile.js';
import {
  discoverSapGuiLandscape,
  searchSapGuiConnections,
  type SapGuiConnection,
} from '../sapgui.js';
import {
  DEFAULT_PROBE_TIMEOUT_MS,
  pickVerifiedProbe,
  probeCandidateUrls,
  summarizeProbes,
  unreachableGuidance,
} from '../probe.js';
import { destinationNameFromLabel } from '../workspace.js';
import type { PolicyInputs } from '../policy.js';
import { sessionCwd, trimmedArgStr, text, type ToolDeps } from './common.js';

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
    adtUrl: { type: 'string', description: 'Derived ADT base URL — an UNVERIFIED port-convention guess; trust `probe` instead.' },
    httpUrl: { type: 'string', description: 'Plain-HTTP alternative (also unverified).' },
    adtUrlNote: { type: 'string', description: 'Caveat about the URL, or why none could be derived.' },
    probe: {
      type: 'object',
      additionalProperties: false,
      description:
        'Reachability probe of the candidate URLs (credential-less; any HTTP response counts, 401 = live ADT). ' +
        'Absent when probing was disabled or no host exists to probe.',
      properties: {
        reachable: { type: 'boolean', required: true, description: 'Whether ANY candidate responded.' },
        verifiedUrl: { type: 'string', description: 'First candidate that responded AND looks like a live ADT endpoint; absent when none qualified.' },
        status: { type: 'integer', description: 'HTTP status of verifiedUrl.' },
        detail: { type: 'string', required: true, description: 'Confirmation, or why nothing worked + what to do.' },
        tried: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              url: { type: 'string', required: true },
              ok: { type: 'boolean', required: true },
              status: { type: 'integer' },
              detail: { type: 'string', required: true },
            },
          },
        },
      },
    },
  },
} as const;

/** Probe-timeout parameter spec shared by the GUI tools that probe. */
const PROBE_TIMEOUT_MS_PARAM = {
  probeTimeoutMs: {
    type: 'integer',
    description: 'Per-candidate probe timeout in ms (default 2500, clamped 250-10000).',
  },
} as const;

/** Model-facing probe report attached to a connection view. */
interface GuiProbeView {
  reachable: boolean;
  verifiedUrl?: string;
  status?: number;
  detail: string;
  tried: Array<{ url: string; ok: boolean; status?: number; detail: string }>;
}

/** Clamp a user-supplied probe timeout to a sane range. */
function probeTimeoutMsOf(value: unknown): number {
  return Math.min(Math.max(Number(value ?? DEFAULT_PROBE_TIMEOUT_MS) || DEFAULT_PROBE_TIMEOUT_MS, 250), 10_000);
}

/**
 * Probe one GUI connection's candidate URLs and build the honest report.
 * Three outcomes, structurally mirroring the create tool's probe branch
 * (the detail WORDING differs per tool on purpose):
 *   - an ADT-likely candidate responded  -> verifiedUrl (use THAT url)
 *   - something answered HTTP but no ADT service was seen -> no verifiedUrl
 *   - nothing responded                  -> reachable false + guidance
 */
async function probeGuiConnection(
  connection: SapGuiConnection,
  options: { timeoutMs: number; signal?: AbortSignal },
): Promise<GuiProbeView> {
  const probes = await probeCandidateUrls(connection.host!, connection.sysnr, options);
  const best = pickVerifiedProbe(probes);
  const tried = probes.map((p) => ({
    url: p.url,
    ok: p.reachable,
    status: p.status,
    detail: p.detail,
  }));
  if (best?.adtLikely) {
    const differs = best.url !== connection.adtUrl;
    return {
      reachable: true,
      verifiedUrl: best.url,
      status: best.status,
      detail: differs
        ? `derived ${connection.adtUrl} did not respond; ${best.url} did (${best.detail}) — use that url`
        : `verified: ${best.detail}`,
      tried,
    };
  }
  if (best) {
    return {
      reachable: true,
      detail: `${best.url} answers (${best.detail}) but no working ADT endpoint was seen on any candidate — verify the url (web dispatcher?)`,
      tried,
    };
  }
  return {
    reachable: false,
    detail: `${unreachableGuidance(connection.router)} — tried: ${summarizeProbes(probes)}`,
    tried,
  };
}

/** Model-facing connection view (probe attached by the list tool when enabled). */
interface GuiConnectionView {
  uuid: string;
  name: string;
  kind: string;
  systemId?: string;
  folder?: string;
  client?: string;
  user?: string;
  language?: string;
  host?: string;
  sysnr?: string;
  router?: string;
  groupName?: string;
  msHost?: string;
  adtUrl?: string;
  httpUrl?: string;
  adtUrlNote?: string;
  probe?: GuiProbeView;
}

function connectionView(c: SapGuiConnection): GuiConnectionView {
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

export function destinationTools(deps: ToolDeps, ctx: ToolHost) {
  const { registry } = deps;

  // Host environment (declared via `ctx.get('host')`, else inferred — see
  // src/hostprofile.ts): every password-related string below is templated
  // from it, so each host names ITS credential store instead of the core
  // presuming DSH's. Descriptions bake the assembly-time snapshot; the
  // execute path re-detects per call.
  const profile = hostProfileOf(ctx);
  const store = profile.credentialStore;
  const passwordsDoc = store
    ? 'Passwords: pass `password` and it is stored in the ' +
      store.label +
      (store.locationHint !== undefined
        ? ` (${store.locationHint}, referenced from the file via \`passwordEnv\` — never written to destinations.yaml)`
        : ' (referenced from the file via `passwordEnv` — never written to destinations.yaml)') +
      '; when no credential service is available, or `passwordInFile: true`, the password ' +
      'is written plaintext into destinations.yaml (avoid committing that file). Without `password`, maintain ' +
      'the credential yourself under the ADT_<NAME>_PASSWORD reference. After creating, verify with adt_ping.'
    : 'Passwords: no credential store exists on ' +
      `${profile.label} — pass \`password\` and it is written plaintext ` +
      'into destinations.yaml (avoid committing that file), or maintain the credential yourself under the ' +
      'ADT_<NAME>_PASSWORD reference (a process environment variable). After creating, verify with adt_ping.';

  return [
    defineTool({
      name: 'adt_list_gui_connections',
      description:
        'Search the LOCAL SAP GUI (SAP Logon) connection list — SAPUILandscape.xml / saplogon.ini of this ' +
        'machine — for systems to reuse as ADT destinations. Use it when the user wants a connection ' +
        'configured and may already have it in SAP GUI: search by name/system id/client (e.g. query "impc"), ' +
        'present the matches, and after the user picks one call adt_create_destination with its uuid. ' +
        'The port-convention adtUrl in each match is an UNVERIFIED guess (the GUI only proves the DIAG port; ' +
        'saprouter entries usually cannot be reached directly), so every match with a host is PROBED: the ' +
        'common candidates (443<nn>, 443, 80<nn>, 80) get a credential-less request and the report says which ' +
        'url actually responded (probe.verifiedUrl — use THAT for importing) or why none did (VPN/firewall/' +
        'saprouter/web dispatcher — then ask the user for an explicit url). "group" entries cannot yield a URL ' +
        'and need an explicit one.',
      parameters: {
        query: {
          type: 'string',
          description:
            'Case-insensitive filter over name, system id, folder, client and stored user. Multiple ' +
            'terms (space-separated) must ALL match — e.g. "impc qas". Omit to list everything (up to the limit).',
        },
        limit: { type: 'integer', description: 'Max matches to return (default 25, max 100).' },
        probe: {
          type: 'boolean',
          description:
            'Probe the candidate ADT urls of every match and report reachability (default true). ' +
            'Adds up to one timeout round when hosts are unreachable.',
        },
        ...PROBE_TIMEOUT_MS_PARAM,
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
            return text(
              (value.message ?? 'No SAP GUI connection list found on this machine.') +
                '\nAsk the user for url, client, username (and a passwordEnv or ADT_*_PASSWORD ' +
                'convention), then call adt_create_destination with explicit fields.',
            );
          }
          const lines = value.connections.map((c) => {
            // URL bit: probe verdict first (verifiedUrl, or the honest
            // inconclusive/failed outcome), falling back to the plain
            // derivation when probing was skipped.
            let urlBit: string;
            if (c.probe) {
              if (c.probe.verifiedUrl) urlBit = `url=${c.probe.verifiedUrl} [probe OK: ${c.probe.detail}]`;
              else if (c.probe.reachable)
                urlBit = `url=${c.adtUrl ?? '(none)'} [probe INCONCLUSIVE: ${c.probe.detail}]`;
              else urlBit = `url=${c.adtUrl ?? '(none)'} [probe FAILED: ${c.probe.detail}]`;
            } else {
              urlBit = c.adtUrl
                ? `url=${c.adtUrl} (unverified ${c.router ? '— saprouter entry' : 'port-convention guess'})`
                : `NO URL (${c.adtUrlNote ?? 'not derivable'})`;
            }
            const bits = [
              `- [${c.kind}] ${c.name}`,
              c.systemId ? `sid=${c.systemId}` : undefined,
              c.folder ? `in "${c.folder}"` : undefined,
              c.client ? `client=${c.client}` : undefined,
              c.user ? `user=${c.user}` : undefined,
              urlBit,
            ].filter((part): part is string => part !== undefined);
            return `${bits.join(' · ')}${c.uuid ? ` · uuid=${c.uuid}` : ''}`;
          });
          return text(
            [
              `SAP GUI landscape: ${value.sources.join(', ')}`,
              ...lines,
              value.truncated ? '(truncated — raise the limit or use a query)' : '',
            ]
              .filter((line) => line !== '')
              .join('\n'),
          );
        },
      },
      isConcurrencySafe: () => true,
      execute: async (args, exec) => {
        const landscape = discoverSapGuiLandscape();
        if (landscape.sources.length === 0) {
          return {
            available: false,
            sources: [],
            connections: [],
            message:
              'No SAP GUI (SAP Logon) landscape found on this machine ' +
              '(looked for SAPUILandscape.xml / saplogon.ini under the SAP Common directory; ' +
              'set ADT_SAPGUI_LANDSCAPE to point at a landscape file if it lives elsewhere). ' +
              'Ask the user for the connection details instead.',
          };
        }
        const limit = Math.min(Math.max(Number(args.limit ?? 25) || 25, 1), 100);
        const matches = searchSapGuiConnections(landscape.connections, trimmedArgStr(args.query));
        const shown = matches.slice(0, limit).map((connection) => ({
          connection,
          view: connectionView(connection),
        }));
        // Probe every match that carries a host (default on): the honest
        // answer about which URL actually works, instead of silently trusting
        // the port-convention guess.
        if (args.probe !== false) {
          const timeoutMs = probeTimeoutMsOf(args.probeTimeoutMs);
          await Promise.all(
            shown.map(async ({ connection, view }) => {
              if (!connection.host) return; // group entries have nothing to probe
              view.probe = await probeGuiConnection(connection, {
                timeoutMs,
                signal: exec.signal,
              });
            }),
          );
        }
        return {
          available: true,
          sources: landscape.sources,
          connections: shown.map(({ view }) => view),
          truncated: matches.length > limit,
        };
      },
    }),

    defineTool({
      name: 'adt_create_destination',
      description:
        'Create (or update) an ADT destination in the session WORKSPACE file ' +
        `${workspaceConfigLocationLabel(registry.workspaceConfigDir)} — ` +
        'hot-applies to every following adt_* call in this workspace. Every option left unset is written into ' +
        'the file as a commented line with its default, so the user can hand-edit the file later. Two modes: ' +
        '(1) import a SAP GUI connection — pass `guiUuid` from adt_list_gui_connections (url/client/language/' +
        'username default from the GUI entry; override any of them explicitly). When the url is DERIVED this way, ' +
        'the common candidates (443<nn>, 443, 80<nn>, 80) are probed credential-lessly and the first responding ' +
        'one is used; when NO candidate shows a working ADT endpoint, the creation is REFUSED with concrete ' +
        'guidance (VPN/firewall; saprouter-only systems need a web-dispatcher url — HTTP cannot ride the ' +
        'GUI\'s saprouter). force: true saves an unverified destination anyway. ' +
        'With `ping: true` the destination is pinged WITH ' +
        'credentials BEFORE saving: a connect-level failure also refuses (force overrides), while an HTTP-level ' +
        'failure (e.g. 401) proves the url alive and only warns. ' +
        '(2) manual — pass at least `name` and `url`. Permission policy can be set per destination via ' +
        'enableTransports / allowedTransports / allowTransportableEdits / allowedPackages / allowExecution / ' +
        'allowBatchWrites / allowDebugger / allowDebugVariables / blockedTablesProfile / blockedTables / ' +
        'allowedTables (written into the entry `policy:` block; keys not passed fall back to the global ' +
        'config / SAP_* env vars / built-in defaults). The environment tier travels as `profile` ' +
        '(dev default; qa defaults execution/batchWrites/debugger to off; prd hard-denies them). ' +
        passwordsDoc + ',',
      parameters: {
        name: {
          type: 'string',
          description:
            'Destination name (required in manual mode; defaults to a slug of the GUI entry name in import mode).',
        },
        url: {
          type: 'string',
          description:
            'Base URL of the ABAP frontend, e.g. https://sap.example.com:44301. Required in manual mode; ' +
            'in import mode overrides the URL derived from the GUI entry (use when a web dispatcher serves /sap/bc/adt).',
        },
        client: { type: 'string', description: 'SAP client (mandant). Defaults: GUI entry, else 000.' },
        language: { type: 'string', description: 'Logon language (GUI entry, else EN).' },
        username: { type: 'string', description: 'ABAP user (GUI shortcut entry when present).' },
        password: {
          type: 'string',
          description: store
            ? 'Password for `username`. Stored in the ' +
              store.label +
              (store.locationHint !== undefined ? ` (${store.locationHint})` : '') +
              ' and referenced via passwordEnv — not written to destinations.yaml (unless passwordInFile).'
            : `Password for \`username\`. No credential store on ${profile.label}: written PLAINTEXT into ` +
              'destinations.yaml — prefer maintaining ADT_<NAME>_PASSWORD as a process environment variable instead.',
        },
        passwordEnv: {
          type: 'string',
          description:
            'Reference name for the password (environment-variable style, e.g. ADT_DEV_PASSWORD). Default: ' +
            `ADT_<NAME>_PASSWORD. ${passwordResolutionSentence(profile)}.`,
        },
        passwordInFile: {
          type: 'boolean',
          description:
            'Write the password PLAINTEXT into destinations.yaml instead of the credential store (not recommended; ' +
            'defaults to false and falls back to it automatically when no credential service is mounted).',
        },
        strictSSL: {
          type: 'boolean',
          description:
            'Verify TLS certificates. GUI imports default to false (intranet self-signed is common); manual mode defaults to true.',
        },
        timeoutMs: { type: 'integer', description: 'Request timeout in ms (default 60000).' },
        // --- per-destination permission policy (entry `policy:` block) ---
        enableTransports: {
          type: 'boolean',
          description:
            'Policy for THIS destination: allow the transport tool family and transport usage ' +
            '(unset falls back to the global config / SAP_ENABLE_TRANSPORTS / default true).',
        },
        allowedTransports: {
          type: 'string',
          description:
            'Policy for THIS destination: comma-separated glob allowlist of transport request numbers the agent ' +
            'may reference or the backend may auto-assign, e.g. "D01K96*" (unset: SAP_ALLOWED_TRANSPORTS / "*").',
        },
        allowTransportableEdits: {
          type: 'boolean',
          description:
            'Policy for THIS destination: allow edits (write/create/delete/activate) in transportable ' +
            'non-$TMP packages (unset: SAP_ALLOW_TRANSPORTABLE_EDITS / default true).',
        },
        allowedPackages: {
          type: 'string',
          description:
            'Policy for THIS destination: comma-separated glob allowlist of packages that may be edited, ' +
            'e.g. "Z*,$TMP" (unset: SAP_ALLOWED_PACKAGES / "*").',
        },
        allowExecution: {
          type: 'boolean',
          description:
            'Policy for THIS destination: allow running programs/classes via adt_execute — set false for ' +
            'read-only destinations (unset: SAP_ALLOW_EXECUTION / default true).',
        },
        allowBatchWrites: {
          type: 'boolean',
          description:
            'Policy for THIS destination: allow write parts inside adt_batch (unset: ' +
            'SAP_ALLOW_BATCH_WRITES / default false).',
        },
        allowDebugger: {
          type: 'boolean',
          description:
            'Policy for THIS destination: allow the ABAP debugger family adt_debug_* — holds a stateful session ' +
            'and stops live processes (unset: SAP_ALLOW_DEBUGGER / default false).',
        },
        allowDebugVariables: {
          type: 'boolean',
          description:
            'Policy for THIS destination: allow changing debuggee variable values — double opt-in next to ' +
            'allowDebugger (unset: SAP_ALLOW_DEBUG_VARIABLES / default false).',
        },
        blockedTablesProfile: {
          type: 'string',
          enum: ['off', 'minimal', 'standard', 'strict'],
          description:
            'Policy for THIS destination: read-side governance of adt_data_preview row reads (unset: ' +
            'SAP_BLOCKED_TABLES_PROFILE / default off).',
        },
        blockedTables: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Policy for THIS destination: extra blocked table names/patterns on top of the catalog ' +
            "(unset: SAP_BLOCKED_TABLES / none).",
        },
        allowedTables: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Policy for THIS destination: exemptions from the blocked-table catalog — audited on every use ' +
            '(unset: SAP_ALLOWED_TABLES / none).',
        },
        profile: {
          type: 'string',
          enum: ['dev', 'qa', 'prd'],
          description:
            'Environment tier of THIS destination: dev (default) keeps plain knob semantics; qa defaults ' +
            'execution/batchWrites/debugger to off (explicit values still open them); prd HARD-DENIES them.',
        },
        guiUuid: { type: 'string', description: 'uuid of a connection from adt_list_gui_connections to import.' },
        probe: {
          type: 'boolean',
          description:
            'When the url is DERIVED from the GUI entry: probe the common port candidates and use the first ' +
            'that responds (default true). Explicitly passed urls are never probed — use `ping` for those.',
        },
        ...PROBE_TIMEOUT_MS_PARAM,
        setDefault: { type: 'boolean', description: 'Also make this the workspace default destination.' },
        overwrite: { type: 'boolean', description: 'Allow replacing an existing destination of the same name.' },
        ping: {
          type: 'boolean',
          description:
            'Verify the destination with credentials BEFORE saving (default false). A connect-level failure ' +
            '(no HTTP response) refuses the creation unless force; an HTTP-level failure (401 etc.) keeps it.',
        },
        force: {
          type: 'boolean',
          description:
            'Save even when reachability verification fails (probe found no working endpoint, or ping cannot ' +
            'connect — e.g. the system is only reachable via saprouter, or the VPN is down). The destination ' +
            'is then marked unverified; fix it later with overwrite: true.',
        },
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
                profile: { type: 'string', description: 'Environment tier (dev|qa|prd) when set.' },
                policy: {
                  type: 'object',
                  additionalProperties: false,
                  description: 'Per-destination permission-policy overrides that were set (unset keys inherit).',
                  properties: {
                    enableTransports: { type: 'boolean' },
                    allowedTransports: { type: 'string' },
                    allowTransportableEdits: { type: 'boolean' },
                    allowedPackages: { type: 'string' },
                    allowExecution: { type: 'boolean' },
                    allowBatchWrites: { type: 'boolean' },
                    allowDebugger: { type: 'boolean' },
                    allowDebugVariables: { type: 'boolean' },
                    blockedTablesProfile: { type: 'string' },
                    blockedTables: { type: 'array', items: { type: 'string' } },
                    allowedTables: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
            setAsDefault: { type: 'boolean', required: true },
            urlVerified: {
              type: 'object',
              additionalProperties: false,
              description:
                'Present when the url came from GUI derivation: outcome of the credential-less reachability ' +
                'probe. ok=false means no candidate showed a working ADT endpoint — such a destination is only ' +
                'saved with force: true and its url is an unverified guess; follow the guidance in detail.',
              properties: {
                ok: { type: 'boolean', required: true },
                url: { type: 'string', description: 'The responding candidate that was used (when ok).' },
                status: { type: 'integer', description: 'HTTP status of the responding candidate.' },
                detail: { type: 'string', required: true },
              },
            },
            passwordStoredIn: {
              type: 'string',
              description:
                'Where a supplied password went: credential-store' +
                (store ? ` (${store.locationHint ?? store.label})` : '') +
                ' | file (plaintext).',
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
        render: (_args, value) =>
          text(
            [
              `${value.action === 'created' ? 'Created' : 'Updated'} destination "${value.destination.name}" ` +
                `-> ${value.destination.url} (client ${value.destination.client ?? '000'}) in`,
              `  ${value.file}`,
              value.setAsDefault ? '  (set as the workspace default destination)' : '',
              value.importedFromGui
                ? `  imported from SAP GUI: ${value.importedFromGui.name} (${value.importedFromGui.uuid})`
                : '',
              value.passwordStoredIn === 'credential-store'
                ? `  password stored in the ${store?.label ?? 'host credential store'}`
                : value.passwordStoredIn === 'file'
                  ? '  password written PLAINTEXT into the file — do not commit it'
                  : '',
              value.urlVerified
                ? value.urlVerified.ok
                  ? `  url verified by probe: ${value.urlVerified.url} (${value.urlVerified.detail})`
                  : `  url UNVERIFIED — ${value.urlVerified.detail}`
                : '',
              value.ping ? `  ping: ${value.ping.ok ? 'OK' : 'FAILED'} — ${value.ping.detail}` : '',
              value.destination.policy && Object.keys(value.destination.policy).length > 0
                ? `  policy: ${Object.entries(value.destination.policy)
                    .map(([key, val]) => `${key}=${String(val)}`)
                    .join(', ')}`
                : '',
              ...value.notes.map((note) => `  note: ${note}`),
              `  next: ${value.hint}`,
            ]
              .filter((line) => line !== '')
              .join('\n'),
          ),
      },
      isConcurrencySafe: () => false,
      execute: async (args, exec) => {
        const password = trimmedArgStr(args.password);
        const passwordInFile = args.passwordInFile === true;
        const cwd = sessionCwd(exec) ?? nodeCwd();
        const guiUuid = trimmedArgStr(args.guiUuid);
        const notes: string[] = [];
        let importedFromGui: { uuid: string; name: string; kind: string; systemId?: string } | undefined;

        let name = trimmedArgStr(args.name);
        let url = trimmedArgStr(args.url);
        let client = trimmedArgStr(args.client);
        let language = trimmedArgStr(args.language);
        let username = trimmedArgStr(args.username);
        let strictSSL = typeof args.strictSSL === 'boolean' ? args.strictSSL : undefined;
        // Outcome of probing a DERIVED url (set in the guiUuid branch below);
        // surfaced as `urlVerified` so an unusable import is never silent.
        let urlVerified: { ok: boolean; url?: string; status?: number; detail: string } | undefined;
        const urlExplicit = url !== undefined;
        let guiRouter: string | undefined;

        if (guiUuid !== undefined) {
          const landscape = discoverSapGuiLandscape();
          const entry = landscape.connections.find(
            (c) => c.uuid.toLowerCase() === guiUuid.toLowerCase(),
          );
          if (!entry) {
            throw new Error(
              `guiUuid "${guiUuid}" not found in the SAP GUI landscape${landscape.sources.length ? ` (${landscape.sources.join(', ')})` : ' (no landscape file found)'}. ` +
                'Call adt_list_gui_connections to see the available entries and their uuids.',
            );
          }
          if (entry.adtUrl === undefined && url === undefined) {
            throw new Error(
              `"${entry.name}" cannot be imported directly: ${entry.adtUrlNote ?? 'no ADT URL derivable'}. ` +
              'Pass an explicit `url` (application server or web dispatcher) to create the destination anyway.',
            );
          }
          name ??= destinationNameFromLabel(entry.name);
          url ??= entry.adtUrl!;
          client ??= entry.client ?? '000';
          language ??= entry.language ?? 'EN';
          username ??= entry.user;
          if (strictSSL === undefined) {
            strictSSL = false; // GUI entries carry no certificate information; intranet self-signed is common
            notes.push('strictSSL defaulted to false (GUI import — intranet self-signed certificates are common); set strictSSL: true when the server has a trusted certificate');
          }
          if (entry.router) {
            guiRouter = entry.router;
            notes.push(`SAP GUI reaches this system through a saprouter (${entry.router}); HTTP cannot ride it — when direct access fails, ask for a web-dispatcher url and pass it as the explicit \`url\``);
          }
          importedFromGui = { uuid: entry.uuid, name: entry.name, kind: entry.kind, systemId: entry.systemId };

          // The port-convention derivation is only a GUESS (the instance
          // number need not match the ICM port; routers/firewalls/web
          // dispatchers break it): probe the common candidates and use the
          // first one that actually responds. Never probed for explicitly
          // passed urls.
          if (!urlExplicit && entry.host && args.probe !== false) {
            const probes = await probeCandidateUrls(entry.host, entry.sysnr, {
              timeoutMs: probeTimeoutMsOf(args.probeTimeoutMs),
              signal: exec.signal,
            });
            const best = pickVerifiedProbe(probes);
            if (best?.adtLikely) {
              const corrected = best.url !== entry.adtUrl;
              url = best.url;
              urlVerified = { ok: true, url: best.url, status: best.status, detail: best.detail };
              notes.push(
                corrected
                  ? `port-convention url ${entry.adtUrl} did not respond; using probed ${best.url} instead (${best.detail})`
                  : `url verified by probe: ${best.detail}`,
              );
            } else if (best) {
              // Something answered HTTP, but no ADT service was seen there.
              urlVerified = {
                ok: false,
                detail: `${best.url} responds (${best.detail}) but no working ADT endpoint was seen on any candidate (${summarizeProbes(probes)}) — verify the correct url (web dispatcher?) before use`,
              };
              notes.push('url UNVERIFIED — a candidate answers HTTP but none shows a working ADT endpoint (causes in urlVerified)');
            } else {
              urlVerified = {
                ok: false,
                detail: `${unreachableGuidance(entry.router)} — tried: ${summarizeProbes(probes)}`,
              };
              notes.push(`url UNVERIFIED — no probed candidate responded; keeping the unverified port-convention url ${entry.adtUrl} (causes in urlVerified)`);
            }
          }
        }

        if (!name) throw new Error('adt_create_destination: `name` is required (manual mode) or pass `guiUuid` to import a GUI connection.');
        if (!url) throw new Error('adt_create_destination: `url` is required (manual mode) or pass `guiUuid` to import a GUI connection.');
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(url);
        } catch {
          throw new Error(`adt_create_destination: \`url\` is not a valid absolute URL: ${url}`);
        }
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          throw new Error(`adt_create_destination: \`url\` must be http(s), got ${parsedUrl.protocol}`);
        }
        if (/\s/.test(name) || /[\/\\]/.test(name)) {
          const slug = destinationNameFromLabel(name);
          throw new Error(
            `adt_create_destination: destination name must not contain spaces or path separators (got "${name}"); ` +
            `suggested name: "${slug}"`,
          );
        }

        // Verification says the url cannot work: do NOT write a broken entry
        // by default (the pre-save ping below adds the same guard for
        // explicitly pinged destinations). force: true is the escape hatch
        // for "configure now, connect later" setups.
        if (urlVerified !== undefined && !urlVerified.ok && args.force !== true) {
          const fixHint = guiRouter !== undefined
            ? 'the GUI entry uses a saprouter, which HTTP cannot ride — ask for a web-dispatcher url'
            : 'VPN/network/firewall, or ask for a web-dispatcher url';
          throw new Error(
            `adt_create_destination: NOT saved — the url is unusable: ${urlVerified.detail}. ` +
              `Fix the cause (${fixHint}), ` +
              'pass an explicit reachable url, or re-run with force: true to save it anyway.',
          );
        }

        const destOut: {
          name: string;
          url: string;
          client?: string;
          language?: string;
          username?: string;
          passwordEnv?: string;
          password?: string;
          strictSSL?: boolean;
          timeoutMs?: number;
          profile?: string;
          policy?: PolicyInputs;
        } = { name, url: parsedUrl.toString().replace(/\/+$/, '') };
        if (client !== undefined) destOut.client = client;
        if (language !== undefined) destOut.language = language;
        if (username !== undefined) destOut.username = username;
        const passwordEnv = trimmedArgStr(args.passwordEnv);
        if (passwordEnv !== undefined) destOut.passwordEnv = passwordEnv;
        if (strictSSL !== undefined) destOut.strictSSL = strictSSL;
        if (typeof args.timeoutMs === 'number') destOut.timeoutMs = args.timeoutMs;

        // --- Per-destination permission policy -----------------------------
        // Only the keys explicitly passed land in the entry `policy:` block;
        // the rest stay commented templates in the file and inherit the
        // global config / SAP_* env / built-in defaults (policy.ts).
        const policy: PolicyInputs = {};
        if (typeof args.enableTransports === 'boolean') policy.enableTransports = args.enableTransports;
        if (typeof args.allowTransportableEdits === 'boolean') policy.allowTransportableEdits = args.allowTransportableEdits;
        if (typeof args.allowExecution === 'boolean') policy.allowExecution = args.allowExecution;
        if (typeof args.allowBatchWrites === 'boolean') policy.allowBatchWrites = args.allowBatchWrites;
        if (typeof args.allowDebugger === 'boolean') policy.allowDebugger = args.allowDebugger;
        if (typeof args.allowDebugVariables === 'boolean') policy.allowDebugVariables = args.allowDebugVariables;
        const blockedTablesProfile = trimmedArgStr(args.blockedTablesProfile);
        if (blockedTablesProfile !== undefined) policy.blockedTablesProfile = blockedTablesProfile;
        if (Array.isArray(args.blockedTables) && args.blockedTables.length > 0) {
          policy.blockedTables = args.blockedTables.map(String).filter(Boolean);
        }
        if (Array.isArray(args.allowedTables) && args.allowedTables.length > 0) {
          policy.allowedTables = args.allowedTables.map(String).filter(Boolean);
        }
        const allowedTransports = trimmedArgStr(args.allowedTransports);
        if (allowedTransports !== undefined) policy.allowedTransports = allowedTransports;
        const allowedPackages = trimmedArgStr(args.allowedPackages);
        if (allowedPackages !== undefined) policy.allowedPackages = allowedPackages;
        if (Object.keys(policy).length > 0) destOut.policy = policy;
        // Environment tier (destination-level key, sibling of the policy block).
        const profile = trimmedArgStr(args.profile)?.toLowerCase();
        if (profile !== undefined) {
          if (profile !== 'dev' && profile !== 'qa' && profile !== 'prd') {
            throw new Error(`adt_create_destination: invalid profile '${profile}' (expected dev, qa or prd)`);
          }
          destOut.profile = profile;
        }

        // --- Pre-save ping (explicit verification) ----------------------------
        // Pings the NOT-yet-saved config with the same password resolution a
        // live destination would use. A connect-level failure (no HTTP
        // status: network/VPN/saprouter) means the destination cannot work —
        // refuse, so nothing is written. An HTTP-level failure (401 etc.)
        // PROVES the url is alive: keep the destination and point the note
        // at credentials/service instead.
        let ping: { ok: boolean; detail: string } | undefined;
        if (args.ping === true) {
          const status = await registry.pingUnsaved(
            { ...destOut, password: password ?? destOut.password } as unknown as DestinationConfig,
            exec.signal,
          );
          ping = { ok: status.ok, detail: status.detail ?? '' };
          if (!ping.ok && status.status === undefined && args.force !== true) {
            throw new Error(
              `adt_create_destination: NOT saved — ping cannot reach ${destOut.url}: ${ping.detail}. ` +
                'The system may be unreachable without VPN, or only reachable via the GUI saprouter (HTTP cannot ride it — ask for a web-dispatcher url). ' +
                'Fix the url/network, or re-run with force: true to save anyway.',
            );
          }
          if (!ping.ok) {
            notes.push(
              `ping FAILED before saving (HTTP ${status.status} — url reachable, ADT rejected the request): ${ping.detail}; fix credentials/service, then verify with adt_ping`,
            );
          }
        }

        // --- Password handling -------------------------------------------------
        // With a password supplied: prefer the host credential store (the
        // value lives wherever THIS host keeps secrets and is referenced from
        // the file by name); write plaintext into destinations.yaml only when
        // explicitly asked for or when no writable credential service is
        // mounted. All wording names the host's own store (hostprofile.ts).
        const passwordRef = destOut.passwordEnv ?? passwordRefNames({ name })[0]!;
        const profileNow = hostProfileOf(ctx);
        let passwordStoredIn: 'credential-store' | 'file' | undefined;
        if (password !== undefined) {
          if (!isCredentialRefName(passwordRef)) {
            throw new Error(
              `adt_create_destination: passwordEnv "${passwordRef}" is not a valid credential reference ` +
                '(POSIX environment-variable name, e.g. ADT_DEV_PASSWORD)',
            );
          }
          destOut.passwordEnv = passwordRef;
          const service = credentialsOf(ctx);
          if (!passwordInFile && service?.set !== undefined) {
            try {
              await service.set(passwordRef, password);
              passwordStoredIn = 'credential-store';
              notes.push(credentialStoreNote(profileNow, passwordRef));
            } catch (error) {
              // e.g. a read-only source (machine env var of the same name)
              // shadows the store; fall back to the file so the destination
              // still works, and say why.
              destOut.password = password;
              passwordStoredIn = 'file';
              notes.push(
                `credential store refused the write (${(error as Error).message}); password written PLAINTEXT into destinations.yaml — prefer fixing the ${passwordRef} source`,
              );
            }
          } else {
            destOut.password = password;
            passwordStoredIn = 'file';
            notes.push(
              plaintextFallbackNote(
                profileNow,
                passwordRef,
                passwordInFile ? 'explicit' : service ? 'not-writable' : 'none',
              ),
            );
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
        const saved = registry.saveWorkspaceDestination(cwd, destOut as unknown as DestinationConfig, {
          setDefault,
          overwrite: args.overwrite === true,
        });

        const hint =
          urlVerified && !urlVerified.ok
            ? 'the url is UNVERIFIED (probe failed) — fix the cause above (VPN/network, firewall, saprouter, or a web-dispatcher url), then re-run adt_create_destination with an explicit `url` and overwrite: true; adt_ping will confirm'
            : username && passwordStoredIn === undefined
              ? passwordReferenceHint(profileNow, passwordRef)
              : `verify with adt_ping (destination: ${name})`;

        return {
          file: saved.path,
          action: saved.created ? 'created' : 'updated',
          destination: destinationView,
          setAsDefault: setDefault,
          importedFromGui,
          shadowsGlobal,
          urlVerified,
          passwordStoredIn,
          notes,
          ping,
          hint,
        };
      },
    }),
  ];
}
