/**
 * `@nefevcore/abap-adt-core` — the host-neutral agent tool core for SAP
 * ABAP ADT.
 *
 * Everything an agent runtime needs to mount the `adt_*` tool family WITHOUT
 * any host-specific dependency: the tool factories, the destination registry,
 * the lock ledger, the debugger session manager, and the config layering
 * pipeline. Host adapters live in separate packages and consume this core:
 *
 *   - DeepSeek Harness: `@nefevcore/abap-adt-dsh-plugin` (settings namespace
 *     section + DSH tool registry + presentation),
 *   - AgentChat: the built-in `ac-sap-adt` row (capability-tagged tool
 *     registration + credentials/fs adapters).
 *
 * Adapter duties (all three seams are structural, defined in tooldef.ts):
 *
 *   - tool registration: iterate {@link assembleAdtTools} and map each
 *     {@link DefinedTool} onto the host tool contract (the `parameters`
 *     field is already standard JSON Schema; `execute` returns the raw
 *     output value — hosts wrap errors/results themselves, and should strip
 *     `undefined` via {@link deepCompact} where their boundary demands
 *     lossless JSON);
 *   - services: provide a {@link ToolHost} facade whose `get('fs')` returns
 *     an {@link AdtFileSystem} (snapshots/export/local check), whose
 *     `get('credentials')` returns the seam `src/credentials.ts` describes
 *     (password references like `ADT_DEV_PASSWORD`), and whose `get('host')`
 *     declares a {@link HostProfile} (see `src/hostprofile.ts`) so the
 *     credential-store wording names YOUR host's store instead of assuming
 *     DSH's — undeclared hosts get capability-inferred, host-neutral wording;
 *   - execution context: tools read `exec.signal` and the caller workspace
 *     directory from `exec.agent.session.header.cwd` (see
 *     `sessionCwd` in tools/common.ts) — hosts synthesize that shape;
 *   - config: compose layers with {@link composeLayers} /
 *     {@link resolveEffectiveConfig} and (re)load the registry with
 *     `registry.reload(effective)`.
 */
import { AdtRegistry } from './registry.js';
import { LockLedger } from './locks.js';
import { DebuggerManager } from './debugger.js';
import { systemTools } from './tools/system.js';
import { searchTools } from './tools/search.js';
import { readTools } from './tools/read.js';
import { writeTools } from './tools/write.js';
import { objectTools } from './tools/objects.js';
import { lifecycleTools } from './tools/lifecycle.js';
import { testingTools } from './tools/testing.js';
import { atcRunTools } from './tools/atc_runs.js';
import { transportTools } from './tools/transports.js';
import { packageTools } from './tools/packages.js';
import { batchTools } from './tools/batch.js';
import { localTools } from './tools/local.js';
import { whereUsedTools } from './tools/whereused.js';
import { dataPreviewTools } from './tools/datapreview.js';
import { lockTools } from './tools/lock.js';
import { versionTools } from './tools/versions.js';
import { gateTools } from './tools/gate.js';
import { policyTools } from './tools/policy.js';
import { dumpTools } from './tools/dumps.js';
import { executeTools } from './tools/execute.js';
import { structureTools } from './tools/structure.js';
import { destinationTools } from './tools/destinations.js';
import { selfcheckTools } from './tools/selfcheck.js';
import { debuggerTools } from './tools/debugger.js';
import { textElementTools } from './tools/textelements.js';
import { cochangeTools } from './tools/cochange.js';
import { crudTools } from './tools/crud.js';
import { fsOpsTools } from './tools/fsops.js';
void crudTools; // (A-group removal: the crud facade is no longer assembled; kept exported for its module's own tests)
/**
 * The REMOVED CRUD-era tool names (docs/ddic-fsops-matrix-plan.md §6.1,
 * group A) — their implementations live on as internal engines of the four
 * `adt_object_*` tools, but the names no longer register. The dead-reference
 * grep test pins this list: a caller asking for one of these gets the
 * migration pointer below.
 */
export const REMOVED_A_GROUP_TOOLS = [
    'adt_crud',
    'adt_create_object',
    'adt_read_object',
    'adt_read_structure',
    'adt_write_object',
    'adt_edit_object',
    'adt_write_structure',
    'adt_delete_object',
    'adt_package_content',
];
/** Old verb → fs verb (migration note §6.5). */
export const CRUD_TO_FS_VERBS = {
    create: 'write',
    update: 'edit',
};
/**
 * Build the FULL `adt_*` tool catalog: 37 dedicated tools plus the four
 * fs_ops tools (write/read/edit/delete × type). The nine CRUD-era group-A
 * tools are BUILT (their full policy/OCC/lock chains are the engines the
 * four tools route to) but NOT registered — they exist only in the internal
 * routing map (docs/ddic-fsops-matrix-plan.md §6 removal batch).
 */
export function assembleAdtTools(deps, host) {
    const engines = [
        ...readTools(deps, host),
        ...writeTools(deps, host),
        ...objectTools(deps),
        ...structureTools(deps),
        ...packageTools(deps),
    ];
    const engineMap = new Map(engines.map((t) => [t.name, t]));
    const registered = [
        ...systemTools(deps),
        ...destinationTools(deps, host),
        ...searchTools(deps),
        ...lifecycleTools(deps),
        ...testingTools(deps),
        ...atcRunTools(deps),
        ...transportTools(deps),
        ...batchTools(deps, host),
        ...localTools(deps, host),
        ...whereUsedTools(deps),
        ...dataPreviewTools(deps, host),
        ...lockTools(deps),
        ...versionTools(deps),
        ...gateTools(deps),
        ...policyTools(deps),
        ...dumpTools(deps),
        ...executeTools(deps),
        ...selfcheckTools(deps),
        ...debuggerTools(deps),
        ...textElementTools(deps),
        ...cochangeTools(deps),
    ];
    const fs = fsOpsTools(deps, engineMap);
    return [...registered, ...fs];
}
// --- Engine building blocks hosts wire into their own composition ---
export { AdtRegistry } from './registry.js';
export { LockLedger } from './locks.js';
export { DebuggerManager } from './debugger.js';
export { AdtPolicy, AdtPolicyError, POLICY_KEYS } from './policy.js';
export { SnapshotConflictError } from './snapshots.js';
export { credentialResolverOf, credentialsOf, isCredentialRefName } from './credentials.js';
export { hostProfileOf, workspaceConfigDirOf } from './hostprofile.js';
export { deepCompact } from './tools/common.js';
export { CRUD_MATRIX, CRUD_VERBS, crudObjectTypes, crudCreatableTypes, renderCrudMatrixTable } from './crudmatrix.js';
// --- fs_ops: type registry + fs verb matrix (docs/ddic-fsops-matrix-plan.md) ---
export { typeRegistryRows, typeRegistryTypes, typeRegistryRow, typeRegistryRowsForPhase, typeRegistryCreatableTypes, typeRegistryDuplicateSpellings, verbSupport, } from './typeregistry.js';
export { FS_VERBS, FS_MATRIX, fsObjectTypes, fsCell, fsVerbsFor, fsUnsupportedMessage, renderFsMatrixTable, renderFsMatrixCard, } from './fsmatrix.js';
// --- Object-reference resolution helpers (ADT type codes ↔ URIs ↔ names) ---
export { TYPE_MAP, normalizeType, refFromName, resolveObject, resolveObjects, typeLabel, } from './resolve.js';
// --- Config layering (schema defaults < composition < files < workspace) ---
export { Config, builtinDefaults, composeLayers, resolveEffectiveConfig, loadExternalConfigFile, parseExternalConfigText, validateExternalConfig, workspaceConfigCandidates, workspaceConfigPath, DEFAULT_WORKSPACE_CONFIG_DIR, passwordRefNames, expandHomePath, resolveConfigFilePath, dshHome, autoDiscoverConfigFile, } from './config.js';
// --- Tool-definition vocabulary (see tooldef.ts) ---
export { defineTool, parameterSpecToJsonSchema, valueSpecToJsonSchema, ToolArgsError, } from './tooldef.js';
//# sourceMappingURL=index.js.map