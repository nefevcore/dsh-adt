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
 *     an {@link AdtFileSystem} (snapshots/export/local check) and whose
 *     `get('credentials')` returns the seam `src/credentials.ts` describes
 *     (password references like `ADT_DEV_PASSWORD`);
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
 * Build the FULL `adt_*` tool catalog (the 46 dedicated tools plus the
 * compact CRUD facade, which routes onto the former by name and therefore
 * comes last). `host` is the host facade the filesystem/credential seams
 * resolve through; `deps` carries the shared registry, lock ledger and
 * debugger session manager (one set per plugin instance, not per call).
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
export { deepCompact } from './tools/common.js';
export { CRUD_MATRIX, CRUD_VERBS, crudObjectTypes, crudCreatableTypes, renderCrudMatrixTable } from './crudmatrix.js';
export type { CrudVerb, CrudCell } from './crudmatrix.js';
export { TYPE_MAP, normalizeType, refFromName, resolveObject, resolveObjects, typeLabel, } from './resolve.js';
export { Config, builtinDefaults, composeLayers, resolveEffectiveConfig, loadExternalConfigFile, parseExternalConfigText, validateExternalConfig, workspaceConfigCandidates, workspaceConfigPath, passwordRefNames, expandHomePath, resolveConfigFilePath, dshHome, autoDiscoverConfigFile, } from './config.js';
export type { PluginConfig, EffectiveConfig, DestinationConfig } from './config.js';
export { defineTool, parameterSpecToJsonSchema, valueSpecToJsonSchema, ToolArgsError, } from './tooldef.js';
export type { AdtFileSystem, AdtFsDirEntry, AdtFsTarget, AdtFsWriteOutcome, AdtToolResult, DefineToolOptions, DefinedTool, InferArgs, InferValue, JsonSchema, JsonValue, ParameterJsonSchema, ParameterSchemaSpec, ToolContentView, ToolExec, ToolResultView, ValueSchemaSpec, } from './tooldef.js';
//# sourceMappingURL=index.d.ts.map