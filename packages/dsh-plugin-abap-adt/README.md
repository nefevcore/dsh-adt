# @nefevcore/abap-adt-dsh-plugin

[![npm](https://img.shields.io/npm/v/@nefevcore/abap-adt-dsh-plugin)](https://www.npmjs.com/package/@nefevcore/abap-adt-dsh-plugin)
[![license](https://img.shields.io/badge/license-MIT-green)](https://github.com/nefevcore/dsh-adt)
[![dsh plugin](https://img.shields.io/badge/dsh--plugin-listed-blue)](https://github.com/topics/dsh-plugin)

Agent-native SAP ABAP access for the [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness): a Cordis plugin that registers **34 `adt_*` tools** speaking the ADT REST protocol directly — no SAP libraries, no IDE required (headless). An AI agent gets the full development loop: **search → read → edit → activate → unit test → ATC → transport → execute → error analysis**, plus agent-scale capabilities (protocol-level `$batch`, DDIC structured editors, source export to local `.abap`, offline abaplint, release gates). Releasing a transport is deliberately left to humans — the agent stages everything up to a releasable request.

Looking for more DSH plugins? Browse the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic on GitHub (this plugin is listed there).

| Highlights | |
|---|---|
| Agent-native | tools designed for autonomous multi-step orchestration |
| Error analysis | `adt_list_dumps` / `adt_get_dump`: ST22 short-dump analysis in-tool |
| Execution | `adt_execute`: run programs / `if_oo_adt_classrun` classes, capture console output |
| Structured editors | `adt_read/write_structure`: message classes, domains, data elements, table types |
| Protocol $batch | `adt_batch`: many ADT requests in ONE round-trip (read-only GET fan-out by default) |
| Release gate | `adt_release_gate`: syntax + unit + ATC verdict before a transport release |
| Local versioning | `adt_export_objects` → local `.abap` files (explicit object lists); `adt_local_check` runs abaplint offline |
| Old-BASIS support | legacy `/abapunit/testruns` fallback (BASIS < 7.5x) handled automatically |
| Zero-config demo | built-in mock ADT server (`demo` destination) — try everything without an SAP system |
| Permission policy | global defaults + per-destination overrides: transport allowlists, package globs, transportable-edit / execution / batch-write switches |

## Install & update

Install and update go through the **dsh CLI only** (requires pnpm on PATH). DSH profiles are pnpm-managed (`~/.dsh/profiles/<name>/` has a `pnpm-workspace.yaml`) — **don't run `npm install` inside a profile** (it creates a `package-lock.json` and breaks the pnpm layout):

```bash
# install (into the web profile)
dsh plugin --profile web add @nefevcore/abap-adt-dsh-plugin

# update to the latest release
dsh plugin --profile web update @nefevcore/abap-adt-dsh-plugin

# or pin an exact version
dsh plugin --profile web add @nefevcore/abap-adt-dsh-plugin@0.2.0
```

**Restart DSH after install/update** — HMR only re-runs config, not cached library modules.

**Not loaded by default, by design.** The package declares no `dsh.bundle`, so `dsh plugin add` installs it as a plain profile dependency and nothing activates: `dsh plugin`'s reconcile only promotes bundle-declaring packages into the global layer, and per-session scoping is exactly what this plugin wants (dsh prints `declares no dsh.bundle — installed as a plain dependency`; that is expected). Activate it through a preset row — or, if you really want it globally, add a row with the same id to your own `~/.dsh/profiles/web/cordis.patch.yml`.

System/permission settings live in the `abap-adt:` section of `${DSH_HOME:-~/.dsh}/settings.yaml` (the DSH settings user layer): edits hot-apply without restarting DSH.

### Upgrading from 0.1.0

0.2.0 activates nothing by default (the global bundle layer auto-drops via reconcile) and moved config into settings, so two one-time steps after updating:

```bash
dsh plugin --profile web update @nefevcore/abap-adt-dsh-plugin
dsh plugin --profile web exec abap-adt-preset --force   # rebuild the preset (add --force over a 0.1.0-era manual one)
```

Then merge `~/.dsh/abap-adt.yml` (the deprecated 0.1.0 config file) into the `abap-adt:` section of `~/.dsh/settings.yaml` — indent every key two spaces — and delete the old file (it warns until removed). Restart DSH once and pick the preset on new sessions.

### Enable per session (agent preset — the intended way)

After installing, generate the preset with the bundled CLI:

```bash
dsh plugin --profile web exec abap-adt-preset
```

That copies your deployment default preset (usually `cordis`) to `~/.dsh/.agent-presets/abap-adt/`, appends the plugin row below, and writes a `preset.yml` (`--id/--from/--name/--force/--dry-run` supported). Restart DSH once, then pick the preset from the chip beside your workspace when creating a session.

The appended row (for a manual setup):

```yaml
- id: abap-adt
  name: '@nefevcore/abap-adt-dsh-plugin'
  config:
    demo: true              # built-in mock destination — no SAP system needed
    # destinations / permission policy belong in settings.yaml `abap-adt:` (see below)
```

A ready-to-share manual template lives at [`presets/abap-adt.example/`](../presets/abap-adt.example/README.md) in the repository.

## Config layering

The composition file (`agent.cordis.yml` / `cordis.patch.yml`) defines the whole toolset and should stay stable; environment-specific settings live in a separate file. Effective values resolve nearest-wins:

```
1. inline config of the plugin row   (agent preset / cordis.patch.yml)
2. external file — `configFile`, auto-discovered at ${DSH_HOME:-~/.dsh}/abap-adt.yml
3. SAP_* environment variables       (permission policy only)
4. built-in defaults                 (demo on, port 8123, no destinations)
```

`destinations` merge by `name` (a same-name inline entry replaces the file entry), so a shipped `destinations: []` never masks the file. Typos and malformed YAML in the external file fail loudly with the path; a missing explicitly-configured `configFile` logs a warning and falls back to inline config.

## Connecting real SAP systems

Put destinations and the optional permission policy in `~/.dsh/abap-adt.yml`:

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

## Tool family (34 tools)

System & connections (`adt_list_destinations`, `adt_system_info`, `adt_ping`, `adt_permissions`) · search & browse (`adt_search`, `adt_package_content`, `adt_where_used`) · source (`adt_read_object`, `adt_write_object`, `adt_edit_object`, `adt_create_object`, `adt_delete_object`) · structured editors (`adt_read_structure`, `adt_write_structure` — MSAG/DOMA/DTEL/TTYP) · lifecycle (`adt_activate`, `adt_check`, `adt_lock_info`, `adt_unlock_all`) · testing (`adt_run_unit_tests`, `adt_run_atc`, `adt_list_atc_runs`, `adt_get_atc_result`) · transports (`adt_object_versions`, `adt_list_transports`, `adt_get_transport` — release is intentionally not exposed) · data (`adt_data_preview` with offset/length window) · versions (`adt_version_diff`) · batch/local (`adt_batch`, `adt_release_gate`, `adt_export_objects`, `adt_local_check`) · execution & errors (`adt_execute`, `adt_list_dumps`, `adt_get_dump`).

Full documentation: [dsh-adt repository](https://github.com/nefevcore/dsh-adt).

Companion packages: [`@nefevcore/abap-adt-protocol`](https://www.npmjs.com/package/@nefevcore/abap-adt-protocol) (protocol client), [`@nefevcore/abap-adt-mock`](https://www.npmjs.com/package/@nefevcore/abap-adt-mock) (mock server).

License: MIT
