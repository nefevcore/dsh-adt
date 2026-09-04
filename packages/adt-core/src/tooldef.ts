/**
 * Host-neutral tool definition vocabulary.
 *
 * The whole `adt_*` tool layer is written against this module instead of a
 * host-specific toolkit, so the same factories can register on any agent
 * runtime:
 *
 *   - DeepSeek Harness: `ctx.tools.register` consumes the produced definition
 *     directly (plain-JSON-Schema `parameters`, `output.schema`,
 *     `output.render`, `timeoutMs`, `isConcurrencySafe`).
 *   - Other hosts (e.g. the AgentChat `./agent` entry): adapt the same
 *     definition onto their own tool contract — the fields are plain data.
 *
 * What this module provides:
 *
 *   1. `defineTool(options)` — the one factory wrapper every tool file uses.
 *      It converts the author-facing parameter dialect (schemastery-style
 *      `required: true` INSIDE property descriptors) into standard JSON
 *      Schema (`required` as a name array on the parent), compiles the
 *      output schema the same way, and validates arguments before every
 *      execute call (violations throw {@link ToolArgsError}).
 *   2. The author-facing schema TYPE vocabulary and its compile-time value
 *      inference (`InferValue` / `InferArgs`), so `render` / `execute`
 *      bodies type against the shapes the schemas declare. The type-level
 *     vocabulary is adapted from `@deepseek-ai/dsh-tools` (MIT) — the
 *     runtime compiler below is this package's own enforced-subset walk.
 *   3. Structural host seams — `ToolHost` (a `get(name)` service lookup) and
 *      `AdtFileSystem` (the subset of a workspace filesystem the tools use:
 *      snapshots, exports, local checks). The DSH host services satisfy
 *      these structurally; other hosts provide small adapters.
 *
 * The supported author dialect is deliberately an enforced JSON Schema
 * subset: `type`, `properties`, `items`, `additionalProperties`, `enum`,
 * `const`, plus the annotation keywords `description` / `title` / `default`
 * / `examples` (and the author-only `json` / `oneOf` nodes). Anything else
 * fails loudly at definition time (an unknown keyword accepted silently
 * would validate nothing while reading as if it did).
 */

/** Recursive JSON value vocabulary shared by outputs and presentation meta. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * A structured result view for host UIs (e.g. the DSH search/read cards).
 * Opaque to the tool layer beyond the `card` discriminator; hosts that have
 * no card system ignore `output.presentationMeta` / `presentResult`.
 */
export type ToolResultView = { card: string } & Record<string, unknown>;

/** Loose replay-result shape `presentResult` receives (host-defined). */
export interface AdtToolResult {
  ok?: boolean;
  error?: string;
  meta?: unknown;
  [key: string]: unknown;
}

/** Plain content blocks `output.render` returns. */
export type ToolContentView = Array<{ type: 'text'; text: string }>;

/**
 * Structural host seam: a service-capable context. The DSH `Context`
 * satisfies this structurally (tools only ever call `ctx.get('fs')`,
 * `ctx.get('credentials')` and — for environment detection — `ctx.get('host')`,
 * see src/hostprofile.ts); other hosts pass a facade with the same shape.
 */
export interface ToolHost {
  /** Resolve an optional service by name; `undefined` when not mounted. */
  get(name: string): unknown;
  /**
   * Optional logger seam: a function of the plugin/subsystem name returning
   * the usual level methods. Hosts without structured logging omit it and
   * the tools fall back to `console`.
   */
  logger?(name: string): {
    debug?(message: string, ...args: unknown[]): void;
    info?(message: string, ...args: unknown[]): void;
    warn?(message: string, ...args: unknown[]): void;
    error?(message: string, ...args: unknown[]): void;
  };
}

/** A path resolved by a filesystem backend into a stable identity. */
export interface AdtFsTarget {
  /** Opaque key for stale guards and target lookup. */
  targetKey: string;
  /** Model/UI-facing path (may be absolute, workspace-relative, or a URI). */
  displayPath: string;
}

/** Outcome shape of {@link AdtFileSystem.writeText} (consumers await it). */
export interface AdtFsWriteOutcome {
  operation: 'create' | 'update';
  [key: string]: unknown;
}

/** One directory entry as {@link AdtFileSystem.listDir} / `readDir` report it. */
export interface AdtFsDirEntry {
  name: string;
  type: 'file' | 'directory' | 'other';
  [key: string]: unknown;
}

/**
 * Structural filesystem seam: the subset of a workspace filesystem service
 * the tool layer consumes (object snapshots, source export, abaplint local
 * check, push). The DSH `dsh-fs` service satisfies this structurally; hosts
 * without a sandbox FS provide an adapter over `node:fs`.
 */
export interface AdtFileSystem {
  /** Resolve a (possibly relative) path to a stable target for the ops below. */
  resolve(path: string, options?: { cwd?: string; signal?: AbortSignal }): Promise<AdtFsTarget>;
  /** Read a resolved target as UTF-8 text. */
  readText(target: AdtFsTarget, signal?: AbortSignal): Promise<string>;
  /**
   * Create or replace a resolved target with UTF-8 text. `expected` (a
   * guarded-write intent) and `policy` (a host sandbox policy token) are
   * pass-through seams; unconditional writes pass `undefined`.
   */
  writeText(
    target: AdtFsTarget,
    content: string,
    expected?: unknown,
    signal?: AbortSignal,
    policy?: unknown,
  ): Promise<AdtFsWriteOutcome>;
  /** List the direct children of a resolved directory (no content reads). */
  listDir(target: AdtFsTarget, signal?: AbortSignal): Promise<AdtFsDirEntry[]>;
  /** Read directory entries of an absolute path: `[{name, type}]`. */
  readDir(path: string): Promise<AdtFsDirEntry[]>;
  /** Read a file by absolute path as UTF-8 text. */
  readFile(path: string): Promise<string>;
}

/** A raw JSON Schema object (the enforced subset this module produces). */
export interface JsonSchema {
  /** Index signature: hosts treat compiled schemas as opaque JSON records. */
  [key: string]: unknown;
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  additionalProperties?: boolean;
  enum?: Array<string | number | boolean | null>;
  const?: string | number | boolean | null;
  oneOf?: JsonSchema[];
  description?: string;
  title?: string;
  default?: JsonValue;
  examples?: JsonValue;
}

// ---------------------------------------------------------------------------
// Author-facing schema vocabulary (type level; adapted from
// @deepseek-ai/dsh-tools — MIT — so tool sources typecheck unchanged)
// ---------------------------------------------------------------------------

/** Annotation keywords shared by every author-facing schema node. */
export interface ValueSchemaAnnotations {
  /** Human-readable description projected into JSON Schema. */
  description?: string;
  /** Human-readable title projected into JSON Schema. */
  title?: string;
  /** Non-validating default annotation; it must be lossless JSON data. */
  default?: JsonValue;
  /** Non-validating examples annotation; it must be lossless JSON data. */
  examples?: JsonValue;
}

/** String value schema with type-correct literal constraints. */
export interface StringValueSchemaSpec extends ValueSchemaAnnotations {
  type: 'string';
  enum?: readonly string[];
  const?: string;
}

/** Finite JSON-number schema with type-correct literal constraints. */
export interface NumberValueSchemaSpec extends ValueSchemaAnnotations {
  type: 'number';
  enum?: readonly number[];
  const?: number;
}

/** Integer schema with type-correct literal constraints. */
export interface IntegerValueSchemaSpec extends ValueSchemaAnnotations {
  type: 'integer';
  enum?: readonly number[];
  const?: number;
}

/** Boolean value schema with type-correct literal constraints. */
export interface BooleanValueSchemaSpec extends ValueSchemaAnnotations {
  type: 'boolean';
  enum?: readonly boolean[];
  const?: boolean;
}

/** Null value schema with type-correct literal constraints. */
export interface NullValueSchemaSpec extends ValueSchemaAnnotations {
  type: 'null';
  enum?: readonly null[];
  const?: null;
}

/** Array value schema; omitted `items` accepts any lossless JSON item. */
export interface ArrayValueSchemaSpec extends ValueSchemaAnnotations {
  type: 'array';
  items?: ValueSchemaSpec;
}

/**
 * Explicit object value schema. Openness is mandatory so a nested or output
 * object never acquires an accidental JSON Schema default.
 */
export interface ObjectValueSchemaSpec extends ValueSchemaAnnotations {
  type: 'object';
  properties?: ParameterSchemaSpec;
  additionalProperties: boolean;
}

/** Author-only unconstrained lossless JSON node (annotation-only schema). */
export interface JsonValueSchemaSpec extends ValueSchemaAnnotations {
  type: 'json';
}

/** Exact-one union schema; at least two branches are required. */
export interface OneOfValueSchemaSpec extends ValueSchemaAnnotations {
  oneOf: readonly [ValueSchemaSpec, ValueSchemaSpec, ...ValueSchemaSpec[]];
}

/** One author-facing schema for any lossless JSON value root. */
export type ValueSchemaSpec =
  | StringValueSchemaSpec
  | NumberValueSchemaSpec
  | IntegerValueSchemaSpec
  | BooleanValueSchemaSpec
  | NullValueSchemaSpec
  | ArrayValueSchemaSpec
  | ObjectValueSchemaSpec
  | JsonValueSchemaSpec
  | OneOfValueSchemaSpec;

/** One implicit parameter-root property, optionally required. */
export type ParameterPropertySpec = ValueSchemaSpec & {
  required?: true;
};

/**
 * Tool parameter schema. The map itself is an implicit open object root;
 * requiredness remains a per-property `required: true` annotation.
 */
export type ParameterSchemaSpec = {
  [key: string]: ParameterPropertySpec;
  [key: symbol]: never;
};

/** Raw JSON Schema projection of the implicit parameter object. */
export interface ParameterJsonSchema extends JsonSchema {
  type: 'object';
  properties: Record<string, JsonSchema>;
}

// --- Compile-time value inference ---

/** Flatten an intersection into one object type for readable hovers. */
type Simplify<T> = {
  [K in keyof T]: T[K];
} & {};

/** String keys of one property map; runtime compilation rejects symbol keys. */
type StringKeyOf<S> = Extract<keyof S, string>;

/** Keys of a property map marked `required: true`. */
type RequiredKeys<S> = {
  [K in StringKeyOf<S>]: S[K] extends {
    required: true;
  } ? K : never;
}[StringKeyOf<S>];

/** Infer the declared value of one parameter property without key optionality. */
type InferProperty<P, Depth extends unknown[]> = InferValueAt<P, Depth>;

/** Infer an implicit property map into required and optional object keys. */
type InferProperties<S, Depth extends unknown[]> = Simplify<
  {
    [K in RequiredKeys<S>]: InferProperty<S[K], Depth>;
  } & {
    [K in Exclude<StringKeyOf<S>, RequiredKeys<S>>]?: InferProperty<S[K], Depth>;
  }
>;

/** Infer an explicit object node, including its declared openness. */
type InferObject<
  S extends {
    additionalProperties: boolean;
  },
  Depth extends unknown[],
> = S extends {
  properties: infer P;
}
  ? S['additionalProperties'] extends true
    ? InferProperties<P, Depth> & Record<string, JsonValue>
    : InferProperties<P, Depth>
  : S['additionalProperties'] extends true
    ? Record<string, JsonValue>
    : Record<string, never>;

/** Infer a scalar node's literal constraint before its broad primitive type. */
type InferScalar<S, Fallback> = S extends {
  const: infer C;
}
  ? C
  : S extends {
      enum: readonly (infer E)[];
    }
    ? E
    : Fallback;

/** Add one schema-container level to bounded compile-time inference. */
type NextInferenceDepth<Depth extends unknown[]> = [unknown, ...Depth];

/** Infer one node without recursively checking it against the full author union. */
type InferValueAt<S, Depth extends unknown[]> = Depth['length'] extends 16
  ? JsonValue
  : S extends {
        type: 'string';
      }
    ? InferScalar<S, string>
    : S extends {
        type: 'number' | 'integer';
      }
      ? InferScalar<S, number>
      : S extends {
          type: 'boolean';
        }
        ? InferScalar<S, boolean>
        : S extends {
            type: 'null';
          }
          ? null
          : S extends {
              type: 'array';
            }
            ? S extends {
                items: infer I;
              }
              ? InferValueAt<I, NextInferenceDepth<Depth>>[]
              : JsonValue[]
            : S extends {
                type: 'object';
                additionalProperties: boolean;
              }
              ? InferObject<S, NextInferenceDepth<Depth>>
              : S extends {
                  type: 'json';
                }
                ? JsonValue
                : S extends {
                    oneOf: readonly unknown[];
                  }
                    ? InferValueAt<S['oneOf'][number], NextInferenceDepth<Depth>>
                    : never;

/**
 * Infer the TypeScript value accepted by an author-facing value schema.
 * Exact inference is bounded to 16 container levels, then falls back to
 * `JsonValue`.
 */
export type InferValue<S> = InferValueAt<S, []>;

/** Infer the TypeScript argument object for an implicit parameter schema. */
export type InferArgs<S> = InferProperties<S, []>;

// ---------------------------------------------------------------------------
// Runtime schema compilation (the enforced subset)
// ---------------------------------------------------------------------------

/** Thrown by `execute` when model-generated arguments violate the schema. */
export class ToolArgsError extends Error {
  /** Individual violations in schema-walk order. */
  readonly violations: string[];
  constructor(violations: string[]) {
    super(`invalid arguments: ${violations.join('; ')}`);
    this.name = 'ToolArgsError';
    this.violations = violations;
  }
}

/** Author-facing descriptor error (definition time, not call time). */
function authorError(message: string): never {
  throw new Error(`unsupported schema: ${message}`);
}

/** Schema keywords accepted in the author dialect (enforced subset). */
const SCHEMA_CONSTRAINT_KEYS = new Set([
  'type',
  'properties',
  'items',
  'additionalProperties',
  'enum',
  'const',
  'oneOf',
]);
const SCHEMA_ANNOTATION_KEYS = new Set(['description', 'title', 'default', 'examples']);
const SCHEMA_TYPES = new Set([
  'object',
  'array',
  'string',
  'number',
  'integer',
  'boolean',
  'null',
  'json',
]);

/**
 * Compile one author-dialect node to a raw JSON Schema node, collecting the
 * parent-level `required` names implied by `required: true` descriptors.
 */
function compileNode(spec: unknown, path: string): { schema: JsonSchema; required: boolean } {
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
    authorError(`${path} must be a schema object, got ${Array.isArray(spec) ? 'an array' : typeof spec}`);
  }
  const input = spec as Record<string, unknown>;
  const schema: JsonSchema = {};
  let required = false;

  for (const [key, value] of Object.entries(input)) {
    if (key === 'required') {
      if (value === true) required = true;
      else if (value === false || value === undefined) continue;
      else authorError(`${path}.required must be true (the array form belongs on the parent object in JSON Schema)`);
      continue;
    }
    if (key === 'properties') {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        authorError(`${path}.properties must be an object`);
      }
      const properties: Record<string, JsonSchema> = {};
      const requiredNames: string[] = [];
      for (const [name, sub] of Object.entries(value as Record<string, unknown>)) {
        const compiled = compileNode(sub, `${path}.properties.${name}`);
        if (compiled.required) requiredNames.push(name);
        properties[name] = compiled.schema;
      }
      schema.properties = properties;
      if (requiredNames.length > 0) schema.required = requiredNames;
      continue;
    }
    if (key === 'items') {
      schema.items = compileNode(value, `${path}.items`).schema;
      continue;
    }
    if (key === 'oneOf') {
      if (!Array.isArray(value) || value.length < 2) {
        authorError(`${path}.oneOf must list at least two branch schemas`);
      }
      schema.oneOf = value.map((branch, i) => compileNode(branch, `${path}.oneOf[${i}]`).schema);
      continue;
    }
    if (SCHEMA_CONSTRAINT_KEYS.has(key) || SCHEMA_ANNOTATION_KEYS.has(key)) {
      if (key === 'type') {
        if (typeof value !== 'string' || !SCHEMA_TYPES.has(value)) {
          authorError(`${path}.type must be one of ${[...SCHEMA_TYPES].join(' | ')}`);
        }
        // The author-only `json` node compiles to an annotation-only schema.
        if (value === 'json') continue;
      } else if (key === 'additionalProperties' && typeof value !== 'boolean') {
        authorError(`${path}.additionalProperties must be a boolean`);
      } else if (
        key === 'enum' &&
        (!Array.isArray(value) ||
          value.some((v) => !['string', 'number', 'boolean'].includes(typeof v) && v !== null))
      ) {
        authorError(`${path}.enum must be an array of primitives`);
      } else if (key === 'const' && !['string', 'number', 'boolean'].includes(typeof value) && value !== null) {
        authorError(`${path}.const must be a primitive`);
      }
      (schema as Record<string, unknown>)[key] = value;
      continue;
    }
    authorError(
      `unknown keyword "${key}" at ${path} (supported: ${[...SCHEMA_CONSTRAINT_KEYS, ...SCHEMA_ANNOTATION_KEYS].join(', ')})`,
    );
  }
  return { schema, required };
}

/**
 * Compile the implicit open parameter object of a tool: the author dialect
 * names per-property descriptors, and the result is an object-rooted JSON
 * Schema with no implicit-root openness override.
 */
export function parameterSpecToJsonSchema(spec: unknown): ParameterJsonSchema {
  // The author dialect hands a PROPERTY MAP (param name → descriptor); wrap
  // it into an object node so compileNode's keyword walk sees the descriptors
  // as properties, not as schema keywords.
  const map =
    spec === null || typeof spec !== 'object' || Array.isArray(spec)
      ? authorError('parameters must be a property map (param name → descriptor)')
      : (spec as Record<string, unknown>);
  const compiled = compileNode({ type: 'object', properties: map }, 'parameters');
  const schema: ParameterJsonSchema = {
    type: 'object',
    properties: compiled.schema.properties ?? {},
  };
  if (compiled.schema.required !== undefined) schema.required = compiled.schema.required;
  return schema;
}

/** Compile an author-facing value schema (tool output shape). */
export function valueSpecToJsonSchema(spec: unknown): JsonSchema {
  return compileNode(spec, 'schema').schema;
}

// ---------------------------------------------------------------------------
// Argument validation (mirrors the dsh-tools violation wording exactly —
// tests and hosts pattern-match these strings; empty result means valid)
// ---------------------------------------------------------------------------

/** The human name of a path in violations ("" reads as "arguments"). */
function diagnosticPath(path: string): string {
  return path === '' ? 'arguments' : path;
}

/** Append one object property without a leading dot at an implicit root. */
function propertyPath(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`;
}

/** Enum/const scalar checks shared by the primitive types. */
function checkScalarValue(schema: JsonSchema, value: unknown, path: string): string[] {
  if (schema.enum !== undefined && !schema.enum.includes(value as never)) {
    return [`"${diagnosticPath(path)}" must be one of ${JSON.stringify(schema.enum)}`];
  }
  if (schema.const !== undefined && value !== schema.const) {
    return [`"${diagnosticPath(path)}" must be ${JSON.stringify(schema.const)}`];
  }
  return [];
}

/** Validate a value against a compiled schema node; returns violations. */
function validateNode(schema: JsonSchema, value: unknown, path: string): string[] {
  const type = schema.type;
  // A node without a `type` (annotation-only) accepts any lossless JSON.
  if (type === undefined) return [];

  switch (type) {
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return [`"${diagnosticPath(path)}" must be an object`];
      }
      const record = value as Record<string, unknown>;
      const violations: string[] = [];
      for (const key of schema.required ?? []) {
        if (!Object.hasOwn(record, key) || record[key] === undefined) {
          violations.push(`missing required property "${propertyPath(path, key)}"`);
        }
      }
      const properties = schema.properties ?? {};
      for (const [key, sub] of Object.entries(properties)) {
        if (!Object.hasOwn(record, key) || record[key] === undefined) continue;
        violations.push(...validateNode(sub, record[key], propertyPath(path, key)));
      }
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(record)) {
          if (!Object.hasOwn(properties, key)) {
            violations.push(
              `"${propertyPath(path, key)}" is not a declared property (additionalProperties: false)`,
            );
          }
        }
      }
      return violations;
    }
    case 'array': {
      if (!Array.isArray(value)) return [`"${diagnosticPath(path)}" must be an array`];
      const items = schema.items;
      if (items === undefined) return [];
      const violations: string[] = [];
      value.forEach((entry, index) => {
        violations.push(...validateNode(items, entry, `${path}[${index}]`));
      });
      return violations;
    }
    case 'string':
      return typeof value === 'string'
        ? checkScalarValue(schema, value, path)
        : [`"${diagnosticPath(path)}" must be a string`];
    case 'number':
      return typeof value !== 'number'
        ? [`"${diagnosticPath(path)}" must be a number`]
        : !Number.isFinite(value)
          ? [`"${diagnosticPath(path)}" must be a finite JSON number`]
          : checkScalarValue(schema, value, path);
    case 'integer':
      return typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)
        ? [`"${diagnosticPath(path)}" must be an integer`]
        : checkScalarValue(schema, value, path);
    case 'boolean':
      return typeof value === 'boolean'
        ? checkScalarValue(schema, value, path)
        : [`"${diagnosticPath(path)}" must be a boolean`];
    case 'null':
      return value === null
        ? checkScalarValue(schema, value, path)
        : [`"${diagnosticPath(path)}" must be null`];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// defineTool
// ---------------------------------------------------------------------------

/** Author-facing execution context: an abort seam plus caller identity. */
export interface ToolExec {
  /** Abort signal of the calling run (bash-style cancellation). */
  signal?: AbortSignal;
  [key: string]: unknown;
}

/** Options for {@link defineTool} (typed against the declared schemas). */
export interface DefineToolOptions<S extends ParameterSchemaSpec, O extends ValueSchemaSpec> {
  /** Tool name (must be unique). */
  readonly name: string;
  /** Human-readable description sent to the model. */
  readonly description: string;
  /** Per-property parameter schema compiled to an implicit open object root. */
  readonly parameters: S;
  /** Canonical output schema plus pure rendering / presentation projections. */
  readonly output: {
    /** Schema enforced against every successful body value. */
    readonly schema: O;
    /** Render one validated value to content blocks (host display). */
    render(args: InferArgs<S>, value: InferValue<NoInfer<O>>): ToolContentView;
    /** Optional structured view metadata for card-capable hosts. */
    presentationMeta?(args: InferArgs<S>, value: InferValue<NoInfer<O>>): JsonValue;
  };
  /** Optional positive cooperative timeout budget in milliseconds. */
  readonly timeoutMs?: number;
  /** Pure classifier for sibling overlap (host scheduler hint). */
  isConcurrencySafe?(args: InferArgs<S>): boolean;
  /** Replay presenter for logged results (a ready view or `undefined`). */
  presentResult?(args: InferArgs<S>, result: AdtToolResult): ToolResultView | undefined;
  /** Execute the tool after argument validation. */
  execute(args: InferArgs<S>, exec: ToolExec): Promise<InferValue<NoInfer<O>>>;
}

/**
 * A compiled, registry-ready tool definition. Plain data plus the wrapped
 * `execute` (arguments are schema-validated first; violations throw
 * {@link ToolArgsError}). Hosts register the definition as-is or adapt it
 * onto their own tool contract.
 */
export interface DefinedTool {
  name: string;
  description: string;
  /** Standard JSON Schema (object root, open unless closed explicitly). */
  parameters: ParameterJsonSchema;
  output: {
    schema: JsonSchema;
    render(args: Record<string, unknown>, value: unknown): ToolContentView;
    presentationMeta?(args: Record<string, unknown>, value: unknown): JsonValue;
  };
  timeoutMs?: number;
  isConcurrencySafe?(args: Record<string, unknown>): boolean;
  presentResult?(args: Record<string, unknown>, result: unknown): ToolResultView | undefined;
  execute(args: Record<string, unknown>, exec: ToolExec): Promise<unknown>;
}

/**
 * Define one tool from the author dialect: compile parameter and output
 * schemas to the enforced JSON Schema subset and wrap `execute` with
 * argument validation.
 */
export function defineTool<const S extends ParameterSchemaSpec, const O extends ValueSchemaSpec>(
  options: DefineToolOptions<S, O>,
): DefinedTool {
  const userExecute = options.execute as (
    args: Record<string, unknown>,
    exec: ToolExec,
  ) => Promise<unknown> | unknown;
  const userRender = options.output.render as (
    args: Record<string, unknown>,
    value: unknown,
  ) => ToolContentView;
  const userPresentationMeta = options.output.presentationMeta as
    | ((args: Record<string, unknown>, value: unknown) => JsonValue)
    | undefined;
  const userPresentResult = options.presentResult as
    | ((args: Record<string, unknown>, result: AdtToolResult) => ToolResultView | undefined)
    | undefined;
  const userIsConcurrencySafe = options.isConcurrencySafe as
    | ((args: Record<string, unknown>) => boolean)
    | undefined;
  if (options.timeoutMs !== void 0 && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)) {
    throw new Error(`defineTool(${options.name}): timeoutMs must be a positive finite number`);
  }
  const parameters = parameterSpecToJsonSchema(options.parameters);
  const outputSchema = valueSpecToJsonSchema(options.output.schema);
  const validate = (args: Record<string, unknown>): string[] => validateNode(parameters, args, '');

  const tool: DefinedTool = {
    name: options.name,
    description: options.description,
    parameters,
    output: {
      schema: outputSchema,
      render(args, value) {
        return userRender(args, value);
      },
      ...(userPresentationMeta !== void 0
        ? {
            presentationMeta(args: Record<string, unknown>, value: unknown): JsonValue {
              return userPresentationMeta(args, value);
            },
          }
        : {}),
    },
    ...(options.timeoutMs !== void 0 ? { timeoutMs: options.timeoutMs } : {}),
    async execute(args, exec) {
      const violations = validate(args);
      if (violations.length > 0) throw new ToolArgsError(violations);
      return userExecute(args, exec);
    },
  };
  if (userPresentResult) {
    tool.presentResult = (args, result) => {
      if (validate(args).length > 0) return void 0;
      return userPresentResult(args, result as AdtToolResult);
    };
  }
  if (userIsConcurrencySafe) {
    tool.isConcurrencySafe = (args) => {
      if (validate(args).length > 0) return false;
      return userIsConcurrencySafe(args);
    };
  }
  return tool;
}
