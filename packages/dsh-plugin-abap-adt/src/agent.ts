/**
 * Host-neutral agent entry (`@nefevcore/abap-adt-dsh-plugin/agent`).
 *
 * Everything an agent runtime needs to mount the `adt_*` tool family WITHOUT
 * any DeepSeek Harness dependency: the tool factories, the destination
 * registry, the lock ledger, the debugger session manager, and the config
 * layering pipeline. The DSH-specific wiring (settings namespace, host tool
 * registry, presentation) lives in the package root entry (`.`); this module
 * and its entire import graph import no DSH package at runtime — hosts like
 * AgentChat consume it through small adapters:
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

export type { ToolHost } from './tooldef.js';

/**
 * Build the FULL `adt_*` tool catalog (the 46 dedicated tools plus the
 * compact CRUD facade, which routes onto the former by name and therefore
 * comes last). `host` is the host facade the filesystem/credential seams
 * resolve through; `deps` carries the shared registry, lock ledger and
 * debugger session manager (one set per plugin instance, not per call).
 */
export function assembleAdtTools(deps: ToolDeps, host: ToolHost): import('./tooldef.js').DefinedTool[] {
  const tools = [
    ...systemTools(deps),
    ...destinationTools(deps, host),
    ...searchTools(deps),
    ...readTools(deps, host),
    ...writeTools(deps, host),
    ...objectTools(deps),
    ...lifecycleTools(deps),
    ...testingTools(deps),
    ...atcRunTools(deps),
    ...transportTools(deps),
    ...packageTools(deps),
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
    ...structureTools(deps),
    ...selfcheckTools(deps),
    ...debuggerTools(deps),
    ...textElementTools(deps),
    ...cochangeTools(deps),
  ];
  // The compact CRUD facade routes to the registered tools by name — appended
  // AFTER the full catalog exists (every matrix owner must be present).
  const routable = new Map<string, RoutableTool>(
    tools.map((t) => [t.name, t as unknown as RoutableTool]),
  );
  tools.push(...crudTools(deps, routable));
  return tools;
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
export { deepCompact } from './tools/common.js';
export { CRUD_MATRIX, CRUD_VERBS, crudObjectTypes, crudCreatableTypes, renderCrudMatrixTable } from './crudmatrix.js';
export type { CrudVerb, CrudCell } from './crudmatrix.js';

// --- Config layering (schema defaults < composition < files < workspace) ---

export {
  builtinDefaults,
  composeLayers,
  resolveEffectiveConfig,
  loadExternalConfigFile,
  parseExternalConfigText,
  validateExternalConfig,
  workspaceConfigCandidates,
  workspaceConfigPath,
  passwordRefNames,
  expandHomePath,
  resolveConfigFilePath,
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
