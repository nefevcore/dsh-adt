# @nefevcore/abap-adt-dsh-plugin

[![npm](https://img.shields.io/npm/v/@nefevcore/abap-adt-dsh-plugin)](https://www.npmjs.com/package/@nefevcore/abap-adt-dsh-plugin)
[![license](https://img.shields.io/badge/license-MIT-green)](https://github.com/nefevcore/dsh-adt)
[![dsh plugin](https://img.shields.io/badge/dsh--plugin-listed-blue)](https://github.com/topics/dsh-plugin)

Agent-native SAP ABAP access for the [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness): a Cordis plugin that registers **32 `adt_*` tools** speaking the ADT REST protocol directly — no SAP libraries, no IDE required (headless). An AI agent gets the full development loop: **search → read → edit → activate → unit test → ATC → transport → execute → debug → error analysis**, plus agent-scale capabilities (protocol-level `$batch`, whole-package release gates, DDIC structured editors, one-step table creation from field lists, conflict-checked local snapshots, source export to local `.abap`, offline abaplint) and conversational destination management (create connections from the local SAP GUI list by just chatting). Releasing a transport is deliberately left to humans — the agent stages everything up to a releasable request.

Looking for more DSH plugins? Browse the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic on GitHub (this plugin is listed there).

| Highlights | |
|---|---|
| Agent-native | tools designed for autonomous multi-step orchestration |
| Error analysis | `adt_dumps`: ST22 short-dump analysis in-tool (list + detail) |
| Execution | `adt_execute`: run programs / `if_oo_adt_classrun` classes, capture console output |
| Structured editors | structured-object reads/edits: message classes, domains, data elements, table types |
| Protocol $batch | `adt_batch`: many ADT requests in ONE round-trip (read-only GET fan-out by default) |
| Release gate | `adt_release_gate`: syntax + unit + ATC verdict before a transport release |
| Local versioning | `adt_export_objects` → local `.abap` files (explicit object lists); `adt_local_check` runs abaplint offline |
| Old-BASIS support | legacy `/abapunit/testruns` fallback (BASIS < 7.5x) handled automatically |
| Zero-config demo | built-in mock ADT server (`demo` destination) — try everything without an SAP system |
| Permission policy | global defaults + per-destination overrides: transport allowlists, package globs, transportable-edit / execution / batch-write switches, dev/qa/prd profiles |

## Install & update (DSH ≥ 0.2.0)

**0.12.1 requires DSH ≥ 0.2.0-rc.2** (volatile entry config; older DSH: stay on 0.12.0). Installation goes through the **DSH Plugin Manager** (the Web UI Plugins panel or the `plugin_manager` tool; requires pnpm on PATH). DSH profiles are pnpm-managed (`~/.dsh/profiles/<name>/` has a `pnpm-workspace.yaml`) — **don't run `npm install` inside a profile**.

**Not loaded by default, by design.** The package declares no `dsh.bundle` of its own: nothing promotes it into the global layer, and per-session scoping is exactly what this plugin wants. Activation happens through the **ABAP Development preset bundle** ([`presets/abap-dev/`](../../presets/abap-dev/) in the repository): one `@deepseek-ai/dsh-agent-preset` declaration row (`preset-abap-adt`) based on the shipped `standard` preset, with the persona replaced by an ABAP-specific one (tool guidance, development loop, transport-request discipline) and this plugin appended as its `abap-adt` row — so ONLY sessions created on that preset load the `adt_*` tools.

From a repository checkout:

```bash
pnpm install && pnpm build       # builds packages/*/lib — the preset row points here
```

then install the preset bundle with the Plugin Manager (target = the absolute `presets/abap-dev` directory) and restart DSH once; pick "ABAP Development" from the preset chip on new sessions. When this package is installed from npm instead, point the preset row's `name` at `'@nefevcore/abap-adt-dsh-plugin'`.

The plugin row inside the preset (what scopes the tools):

```yaml
- id: abap-adt
  name: '@nefevcore/abap-adt-dsh-plugin'   # or a Loader-anchored relative path in a checkout
  config:
    demo: true              # built-in mock destination — no SAP system needed
    # destinations live in the session WORKSPACE file
    # <workspace>/.dsh-abap-adt/destinations.yaml (see below); global fallbacks
    # and permission policy in the volatile abap-adt entry config (below)
```

### Upgrading to 0.12.1 (DSH 0.1.x → 0.2.0)

DSH 0.2.0 removed both mechanisms 0.12.0 and earlier relied on: directory presets (`~/.dsh/.agent-presets/<id>/` is no longer read) and the settings namespace (`ctx.settings.installSection` is gone; DSH imported the old `settings.yaml` once and renamed it `.imported`). After upgrading DSH and this plugin:

1. Install the `presets/abap-dev` bundle (above), restart DSH, pick "ABAP Development" on new sessions.
2. Workspace `.dsh-abap-adt/destinations.yaml` and `~/.dsh/.credentials.yaml` keep working unchanged.
3. Global-layer config that used to live in `settings.yaml` `abap-adt:` moves into the preset row's `config:` (or a team-shared `configFile`).
4. Delete the dead `~/.dsh/.agent-presets/abap-adt/` directory.

## Config layering

The preset declaration defines the whole toolset and should stay stable; environment-specific settings live in separate files. The plugin's Config schema is `.volatile()`, so the entry's inline config is a LIVE reference: the abap-adt form on the DSH Settings Plugins page (or a profile-patch row override) persists into the active profile's Cordis patch, and the Loader commits the new values in place and notifies the plugin — destinations and policy hot-reload without a restart or remount. Effective values resolve nearest-wins:

```
1. inline config of the plugin row        (volatile; preset row / profile-patch override,
                                           written by the Settings form — hot-applies)
2. legacy file ${DSH_HOME:-~/.dsh}/abap-adt.yml (deprecated, warns)
3. explicit `configFile`                  (team-shared global override)
4. WORKSPACE file <session cwd>/.dsh-abap-adt/destinations.yaml — nearest layer,
   resolved per tool call (destinations / defaultDestination / policy keys)
5. SAP_* environment variables            (permission policy only, when unset above)
```

`destinations` merge by `name` (a same-name entry in a nearer layer replaces the lower one), so a shipped `destinations: []` never masks another layer. Typos and malformed YAML in any file fail loudly with the path; a missing explicitly-configured `configFile` logs a warning and falls back.

## Connecting real SAP systems

Preferred: per-workspace config, created conversationally. Just ask the agent — "create the impc connection" — and it will search the **local SAP GUI (SAP Logon) landscape** (`adt_list_gui_connections`), offer the matches for you to pick, then write the destination (`adt_create_destination`, importing client/language/username from the GUI entry). The port-convention URL derived from a GUI entry is only a guess, so it is **verified by probing** the common candidates (`443<nn>`, `443`, `80<nn>`, `80` — credential-less; 401 counts as "alive"): the first candidate that actually responds is used. When no candidate shows a working ADT endpoint the creation is **refused** with the per-candidate evidence — for saprouter-routed entries (HTTP cannot ride the GUI's saprouter) the guidance asks for a **web-dispatcher url**, the HTTP counterpart of a saprouter, to be passed as the explicit `url`. With `ping: true` the destination is pinged with credentials *before* saving: connect-level failures also refuse (`force: true` overrides), while an HTTP-level failure (e.g. 401) proves the url alive and only warns about credentials. No GUI installed? The agent asks for `url / client / username` and creates it from explicit fields. Pass the password in the conversation and it is stored in the **DSH credential store** (`~/.dsh/.credentials.yaml`, referenced via `passwordEnv` — never written to destinations.yaml); plaintext in the file only when no credential service is mounted or `passwordInFile: true`. Permission knobs can be passed along too (`enableTransports`, `allowedTransports`, `allowTransportableEdits`, `allowedPackages`, `allowExecution`, `allowBatchWrites`) — they land in the entry's `policy:` block and override the global defaults for that destination only.

Or hand-write `<workspace>/.dsh-abap-adt/destinations.yaml` — files written by `adt_create_destination` are self-documenting: every option left unset is listed as a commented line with its default and purpose, so hand-editing is just "uncomment and change" (managed writes keep your set values and regenerate the templates):

```yaml
defaultDestination: dev
destinations:
  - name: dev
    url: https://my-sap-host:44300/
    client: '100'
    language: EN
    username: DEVUSER
    passwordEnv: ADT_DEV_PASSWORD   # preferred over a hardcoded password
    strictSSL: false                # for self-signed certificates

# Optional permission policy — global defaults (config > SAP_* env vars > defaults);
# every destination can override any key via its own `policy:` block:
enableTransports: true
allowedTransports: 'D01K96*'        # glob allowlist of transport numbers
allowTransportableEdits: true
allowedPackages: 'Z*,$TMP'          # glob allowlist of editable packages
destinations:
  - name: qas
    url: https://my-qas-host:44300/
    # ...
    policy:                          # stricter on QAS, key by key
      enableTransports: false
```

Inspect the effective policy at runtime with the `adt_permissions` tool.

## Tool family (32 tools)

System & connections (`adt_list_destinations`, `adt_list_gui_connections`, `adt_create_destination`, `adt_system_info`, `adt_ping`, `adt_permissions`) · search & browse (`adt_search`, `adt_where_used`, `adt_cochange`) · object CRUD — four tools, one per verb (`adt_object_write` create-or-override, `adt_object_read` with local snapshot and capability matrix, `adt_object_edit` with OCC conflict checks, `adt_object_delete`) · lifecycle (`adt_activate`, `adt_check`, `adt_lock_info`, `adt_unlock_all`) · testing (`adt_run_unit_tests`, `adt_run_atc`, `adt_atc_runs`) · transports (`adt_transports` list+detail, `adt_object_versions`, `adt_version_diff` — release is intentionally not exposed) · data (`adt_data_preview` with offset/length window) · batch/local (`adt_batch`, `adt_release_gate`, `adt_export_objects`, `adt_local_check`) · execution & errors (`adt_execute`, `adt_dumps` ST22 list+detail) · debugger (`adt_debug`: one tool, nine actions) · sweep (`adt_selfcheck`).

Full documentation: [dsh-adt repository](https://github.com/nefevcore/dsh-adt).

Companion packages: [`@nefevcore/abap-adt-protocol`](https://www.npmjs.com/package/@nefevcore/abap-adt-protocol) (protocol client), [`@nefevcore/abap-adt-mock`](https://www.npmjs.com/package/@nefevcore/abap-adt-mock) (mock server).

License: MIT
