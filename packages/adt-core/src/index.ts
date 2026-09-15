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

import type { ToolHost } from './tooldef.js';
import { AdtRegistry } from './registry.js';
import { LockLedger } from './locks.js';
import { DebuggerManager } from './debugger.js';
import type { ToolDeps } from './tools/common.js';
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
import { crudTools, type RoutableTool } from './tools/crud.js';
import { fsOpsTools } from './tools/fsops.js';
void crudTools; // (A-group removal: the crud facade is no longer assembled; kept exported for its module's own tests)

export type { ToolHost } from './tooldef.js';

/**
 * The REMOVED CRUD-era tool names (docs/ddic-fsops-matrix-plan.md §6.1,
 * group A) — their implementations live on as internal engines of the four
 * `adt_object_*` tools, but the names no longer register. The dead-reference
 * grep test pins this list: a caller asking for one of these gets the
 * migration pointer below.
 */
export const REMOVED_A_GROUP_TOOLS: readonly string[] = [
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
export const CRUD_TO_FS_VERBS: Readonly<Record<string, string>> = {
  create: 'write',
  update: 'edit',
};

/**
 * The SECOND consolidation batch (docs/tool-consolidation-plan.md, 0.9.0):
 * group C (textelements → adt_object_read {part}), group D (list/get pairs →
 * one tool each) and group E (debugger five → adt_debug). Implementations
 * survive as internal engines / branches; the names no longer register.
 */
export const REMOVED_C_GROUP_TOOLS: readonly string[] = ['adt_read_textelements'];

export const REMOVED_D_GROUP_TOOLS: readonly string[] = [
  'adt_list_atc_runs',
  'adt_get_atc_result',
  'adt_list_dumps',
  'adt_get_dump',
  'adt_list_transports',
  'adt_get_transport',
];

export const REMOVED_E_GROUP_TOOLS: readonly string[] = [
  'adt_debug_session',
  'adt_debug_breakpoint',
  'adt_debug_step',
  'adt_debug_inspect',
  'adt_debug_set_variable',
];

/** Every name removed by the consolidation batch (C + D + E). */
export const REMOVED_CONSOLIDATED_TOOLS: readonly string[] = [
  ...REMOVED_C_GROUP_TOOLS,
  ...REMOVED_D_GROUP_TOOLS,
  ...REMOVED_E_GROUP_TOOLS,
];

/** Old surface → new surface pointers for the consolidation batch. */
export const CONSOLIDATION_MIGRATION: Readonly<Record<string, string>> = {
  adt_read_textelements: "adt_object_read {type:'PROG', name, part:'textelements'}",
  adt_list_atc_runs: 'adt_atc_runs {createdBy?, ageMin?, …}',
  adt_get_atc_result: 'adt_atc_runs {displayId}',
  adt_list_dumps: 'adt_dumps {user?, from?, to?, top?, skip?}',
  adt_get_dump: 'adt_dumps {dumpId, view?}',
  adt_list_transports: 'adt_transports {allUsers?, status?}',
  adt_get_transport: 'adt_transports {number}',
  adt_debug_session: "adt_debug {action:'listen'|'status'|'detach'}",
  adt_debug_breakpoint: "adt_debug {action:'setBreakpoint'|'deleteBreakpoint'}",
  adt_debug_step: "adt_debug {action:'step', step}",
  adt_debug_inspect: "adt_debug {action:'variables'|'stack'}",
  adt_debug_set_variable: "adt_debug {action:'setVariable', name, value}",
};

/**
 * Build the FULL `adt_*` tool catalog: 28 dedicated tools plus the four
 * fs_ops tools (write/read/edit/delete × type) — 32 registered. The nine
 * CRUD-era group-A tools and the textelements tool (group C) are BUILT as
 * internal engines (their full policy/OCC/lock chains feed the four fs_ops
 * tools) but NOT registered; the D/E consolidations happen inside their own
 * tool modules (docs/tool-consolidation-plan.md).
 */
export function assembleAdtTools(deps: ToolDeps, host: ToolHost): import('./tooldef.js').DefinedTool[] {
  const engines = [
    ...readTools(deps, host),
    ...writeTools(deps, host),
    ...objectTools(deps),
    ...structureTools(deps),
    ...packageTools(deps),
    // C-group: the textelements owner is an engine of adt_object_read
    // {part:'textelements'} now (docs/tool-consolidation-plan.md §4).
    ...textElementTools(deps),
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
    ...cochangeTools(deps),
  ];
  const fs = fsOpsTools(deps, engineMap as unknown as Map<string, RoutableTool>);
  return [...registered, ...fs];
}

// --- Engine building blocks hosts wire into their own composition ---

export { AdtRegistry } from './registry.js';
export type { RegistryDestination } from './registry.js';
export { LockLedger } from './locks.js';
export { DebuggerManager } from './debugger.js';
export { AdtPolicy, AdtPolicyError, POLICY_KEYS } from './policy.js';
export { SnapshotConflictError } from './snapshots.js';
export { credentialResolverOf, credentialsOf, isCredentialRefName } from './credentials.js';
export type { CredentialsService } from './credentials.js';
export { hostProfileOf, workspaceConfigDirOf } from './hostprofile.js';
export type { HostProfile } from './hostprofile.js';
export { deepCompact } from './tools/common.js';
export { CRUD_MATRIX, CRUD_VERBS, crudObjectTypes, crudCreatableTypes, renderCrudMatrixTable } from './crudmatrix.js';
export type { CrudVerb, CrudCell } from './crudmatrix.js';

// --- fs_ops: type registry + fs verb matrix (docs/ddic-fsops-matrix-plan.md) ---

export {
  typeRegistryRows,
  typeRegistryTypes,
  typeRegistryRow,
  typeRegistryRowsForPhase,
  typeRegistryCreatableTypes,
  typeRegistryDuplicateSpellings,
  verbSupport,
} from './typeregistry.js';
export type { TypeRegistryRow, EditMode, Activates, VerbSupport } from './typeregistry.js';

export {
  FS_VERBS,
  FS_MATRIX,
  fsObjectTypes,
  fsCell,
  fsVerbsFor,
  fsUnsupportedMessage,
  renderFsMatrixTable,
  renderFsMatrixCard,
} from './fsmatrix.js';
export type { FsVerb, FsCell } from './fsmatrix.js';

// --- Object-reference resolution helpers (ADT type codes ↔ URIs ↔ names) ---

export {
  TYPE_MAP,
  normalizeType,
  refFromName,
  resolveObject,
  resolveObjects,
  typeLabel,
} from './resolve.js';

// --- Config layering (schema defaults < composition < files < workspace) ---

export {
  Config,
  builtinDefaults,
  composeLayers,
  resolveEffectiveConfig,
  loadExternalConfigFile,
  parseExternalConfigText,
  validateExternalConfig,
  workspaceConfigCandidates,
  workspaceConfigPath,
  DEFAULT_WORKSPACE_CONFIG_DIR,
  passwordRefNames,
  expandHomePath,
  resolveConfigFilePath,
  dshHome,
  autoDiscoverConfigFile,
} from './config.js';
export type { PluginConfig, EffectiveConfig, DestinationConfig } from './config.js';

// --- Tool-definition vocabulary (see tooldef.ts) ---

export {
  defineTool,
  parameterSpecToJsonSchema,
  valueSpecToJsonSchema,
  ToolArgsError,
} from './tooldef.js';
export type {
  AdtFileSystem,
  AdtFsDirEntry,
  AdtFsTarget,
  AdtFsWriteOutcome,
  AdtToolResult,
  DefineToolOptions,
  DefinedTool,
  InferArgs,
  InferValue,
  JsonSchema,
  JsonValue,
  ParameterJsonSchema,
  ParameterSchemaSpec,
  ToolContentView,
  ToolExec,
  ToolResultView,
  ValueSchemaSpec,
} from './tooldef.js';
