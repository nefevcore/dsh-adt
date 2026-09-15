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
import type { ToolDeps } from './tools/common.js';
export type { ToolHost } from './tooldef.js';
/**
 * The REMOVED CRUD-era tool names (docs/ddic-fsops-matrix-plan.md §6.1,
 * group A) — their implementations live on as internal engines of the four
 * `adt_object_*` tools, but the names no longer register. The dead-reference
 * grep test pins this list: a caller asking for one of these gets the
 * migration pointer below.
 */
export declare const REMOVED_A_GROUP_TOOLS: readonly string[];
/** Old verb → fs verb (migration note §6.5). */
export declare const CRUD_TO_FS_VERBS: Readonly<Record<string, string>>;
/**
 * The SECOND consolidation batch (docs/tool-consolidation-plan.md, 0.9.0):
 * group C (textelements → adt_object_read {part}), group D (list/get pairs →
 * one tool each) and group E (debugger five → adt_debug). Implementations
 * survive as internal engines / branches; the names no longer register.
 */
export declare const REMOVED_C_GROUP_TOOLS: readonly string[];
export declare const REMOVED_D_GROUP_TOOLS: readonly string[];
export declare const REMOVED_E_GROUP_TOOLS: readonly string[];
/** Every name removed by the consolidation batch (C + D + E). */
export declare const REMOVED_CONSOLIDATED_TOOLS: readonly string[];
/** Old surface → new surface pointers for the consolidation batch. */
export declare const CONSOLIDATION_MIGRATION: Readonly<Record<string, string>>;
/**
 * Build the FULL `adt_*` tool catalog: 28 dedicated tools plus the four
 * fs_ops tools (write/read/edit/delete × type) — 32 registered. The nine
 * CRUD-era group-A tools and the textelements tool (group C) are BUILT as
 * internal engines (their full policy/OCC/lock chains feed the four fs_ops
 * tools) but NOT registered; the D/E consolidations happen inside their own
 * tool modules (docs/tool-consolidation-plan.md).
 */
export declare function assembleAdtTools(deps: ToolDeps, host: ToolHost): import('./tooldef.js').DefinedTool[];
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
export { typeRegistryRows, typeRegistryTypes, typeRegistryRow, typeRegistryRowsForPhase, typeRegistryCreatableTypes, typeRegistryDuplicateSpellings, verbSupport, } from './typeregistry.js';
export type { TypeRegistryRow, EditMode, Activates, VerbSupport } from './typeregistry.js';
export { FS_VERBS, FS_MATRIX, fsObjectTypes, fsCell, fsVerbsFor, fsUnsupportedMessage, renderFsMatrixTable, renderFsMatrixCard, } from './fsmatrix.js';
export type { FsVerb, FsCell } from './fsmatrix.js';
export { TYPE_MAP, normalizeType, refFromName, resolveObject, resolveObjects, typeLabel, } from './resolve.js';
export { Config, builtinDefaults, composeLayers, resolveEffectiveConfig, loadExternalConfigFile, parseExternalConfigText, validateExternalConfig, workspaceConfigCandidates, workspaceConfigPath, DEFAULT_WORKSPACE_CONFIG_DIR, passwordRefNames, expandHomePath, resolveConfigFilePath, dshHome, autoDiscoverConfigFile, } from './config.js';
export type { PluginConfig, EffectiveConfig, DestinationConfig } from './config.js';
export { defineTool, parameterSpecToJsonSchema, valueSpecToJsonSchema, ToolArgsError, } from './tooldef.js';
export type { AdtFileSystem, AdtFsDirEntry, AdtFsTarget, AdtFsWriteOutcome, AdtToolResult, DefineToolOptions, DefinedTool, InferArgs, InferValue, JsonSchema, JsonValue, ParameterJsonSchema, ParameterSchemaSpec, ToolContentView, ToolExec, ToolResultView, ValueSchemaSpec, } from './tooldef.js';
//# sourceMappingURL=index.d.ts.map