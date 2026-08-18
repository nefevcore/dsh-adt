# @nefevcore/abap-adt-dsh-plugin

Agent-native SAP ABAP access for the [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness): a Cordis plugin that registers **30 `adt_*` tools** speaking the ADT REST protocol directly — no SAP libraries, no VS Code / Eclipse required. An AI agent gets the full development loop: **search → read → edit → activate → unit test → ATC → transport**, plus batch capabilities beyond the VS Code ADT workflow (whole-package quality reports, package export to local `.abap`, offline abaplint, release gates).

| Highlights | |
|---|---|
| Agent-native | tools designed for autonomous multi-step orchestration, not interactive IDE |
| Batch checks | `adt_batch_checks`: ATC + ABAP Unit across an entire package in one call |
| Release gate | `adt_release_gate`: syntax + unit + ATC verdict before a transport release |
| Local versioning | `adt_export_objects` → local `.abap` files; `adt_local_check` runs abaplint offline |
| Old-BASIS support | legacy `/abapunit/testruns` fallback (BASIS < 7.5x) handled automatically |
| Zero-config demo | built-in mock ADT server (`demo` destination) — try everything without an SAP system |
| Permission policy | per-destination transport allowlists, package globs, transportable-edit switch |

## Install

```bash
# into your DSH profile's node_modules
cd ~/.dsh/profiles
npm install @nefevcore/abap-adt-dsh-plugin
```

### Enable per session (agent preset — recommended)

Create `~/.dsh/.agent-presets/abap-adt/agent.cordis.yml` (copy of your default preset) and append:

```yaml
- id: abap-adt
  name: '@nefevcore/abap-adt-dsh-plugin'
  config:
    demo: true              # built-in mock destination — no SAP system needed
    defaultDestination: demo
    destinations: []         # add real systems here (see below)
```

Pick the preset from the chip beside your workspace when creating a session.

### Enable globally

Add the same row to `~/.dsh/profiles/web/cordis.patch.yml` under `- insert:`.

## Connecting real SAP systems

```yaml
- id: abap-adt
  name: '@nefevcore/abap-adt-dsh-plugin'
  config:
    defaultDestination: dev
    destinations:
      - name: dev
        url: https://my-sap-host:44300/
        client: '100'
        language: EN
        username: DEVUSER
        passwordEnv: ADT_DEV_PASSWORD   # preferred over a hardcoded password
        strictSSL: false                # for self-signed certificates
    # Optional permission policy (config > SAP_* env vars > defaults):
    enableTransports: true
    allowedTransports: 'D01K96*'        # glob allowlist of transport numbers
    allowTransportableEdits: true
    allowedPackages: 'Z*,$TMP'          # glob allowlist of editable packages
```

Inspect the effective policy at runtime with the `adt_permissions` tool.

## Tool family (30 tools)

System & connections (`adt_list_destinations`, `adt_system_info`, `adt_ping`, `adt_permissions`) · search & browse (`adt_search`, `adt_package_content`) · source (`adt_read_object`, `adt_edit_object`, `adt_write_object`) · lifecycle (`adt_create_object`, `adt_delete_object`, `adt_activate`, `adt_check`, `adt_lock_info`, `adt_unlock_all`) · testing (`adt_run_unit_tests`, `adt_run_atc`, `adt_list_atc_runs`, `adt_get_atc_result`) · transports (`adt_list_transports`, `adt_get_transport`, `adt_release_transport`) · data (`adt_data_preview`) · analysis (`adt_where_used`, `adt_object_versions`, `adt_version_diff`) · batch/local (`adt_batch_checks`, `adt_release_gate`, `adt_export_objects`, `adt_local_check`).

Full documentation: [dsh-adt repository](https://github.com/nefevcore/dsh-adt).

Companion packages: [`@nefevcore/abap-adt-protocol`](https://www.npmjs.com/package/@nefevcore/abap-adt-protocol) (protocol client), [`@nefevcore/abap-adt-mock`](https://www.npmjs.com/package/@nefevcore/abap-adt-mock) (mock server).

License: MIT
