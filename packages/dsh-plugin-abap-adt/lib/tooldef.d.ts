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
export type JsonValue = string | number | boolean | null | JsonValue[] | {
    [key: string]: JsonValue;
};
/**
 * A structured result view for host UIs (e.g. the DSH search/read cards).
 * Opaque to the tool layer beyond the `card` discriminator; hosts that have
 * no card system ignore `output.presentationMeta` / `presentResult`.
 */
export type ToolResultView = {
    card: string;
} & Record<string, unknown>;
/** Loose replay-result shape `presentResult` receives (host-defined). */
export interface AdtToolResult {
    ok?: boolean;
    error?: string;
    meta?: unknown;
    [key: string]: unknown;
}
/** Plain content blocks `output.render` returns. */
export type ToolContentView = Array<{
    type: 'text';
    text: string;
}>;
/**
 * Structural host seam: a service-capable context. The DSH `Context`
 * satisfies this structurally (tools only ever call `ctx.get('fs')` and
 * `ctx.get('credentials')`); other hosts pass a facade with the same shape.
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
    resolve(path: string, options?: {
        cwd?: string;
        signal?: AbortSignal;
    }): Promise<AdtFsTarget>;
    /** Read a resolved target as UTF-8 text. */
    readText(target: AdtFsTarget, signal?: AbortSignal): Promise<string>;
    /**
     * Create or replace a resolved target with UTF-8 text. `expected` (a
     * guarded-write intent) and `policy` (a host sandbox policy token) are
     * pass-through seams; unconditional writes pass `undefined`.
     */
    writeText(target: AdtFsTarget, content: string, expected?: unknown, signal?: AbortSignal, policy?: unknown): Promise<AdtFsWriteOutcome>;
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
export type ValueSchemaSpec = StringValueSchemaSpec | NumberValueSchemaSpec | IntegerValueSchemaSpec | BooleanValueSchemaSpec | NullValueSchemaSpec | ArrayValueSchemaSpec | ObjectValueSchemaSpec | JsonValueSchemaSpec | OneOfValueSchemaSpec;
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
type InferProperties<S, Depth extends unknown[]> = Simplify<{
    [K in RequiredKeys<S>]: InferProperty<S[K], Depth>;
} & {
    [K in Exclude<StringKeyOf<S>, RequiredKeys<S>>]?: InferProperty<S[K], Depth>;
}>;
/** Infer an explicit object node, including its declared openness. */
type InferObject<S extends {
    additionalProperties: boolean;
}, Depth extends unknown[]> = S extends {
    properties: infer P;
} ? S['additionalProperties'] extends true ? InferProperties<P, Depth> & Record<string, JsonValue> : InferProperties<P, Depth> : S['additionalProperties'] extends true ? Record<string, JsonValue> : Record<string, never>;
/** Infer a scalar node's literal constraint before its broad primitive type. */
type InferScalar<S, Fallback> = S extends {
    const: infer C;
} ? C : S extends {
    enum: readonly (infer E)[];
} ? E : Fallback;
/** Add one schema-container level to bounded compile-time inference. */
type NextInferenceDepth<Depth extends unknown[]> = [unknown, ...Depth];
/** Infer one node without recursively checking it against the full author union. */
type InferValueAt<S, Depth extends unknown[]> = Depth['length'] extends 16 ? JsonValue : S extends {
    type: 'string';
} ? InferScalar<S, string> : S extends {
    type: 'number' | 'integer';
} ? InferScalar<S, number> : S extends {
    type: 'boolean';
} ? InferScalar<S, boolean> : S extends {
    type: 'null';
} ? null : S extends {
    type: 'array';
} ? S extends {
    items: infer I;
} ? InferValueAt<I, NextInferenceDepth<Depth>>[] : JsonValue[] : S extends {
    type: 'object';
    additionalProperties: boolean;
} ? InferObject<S, NextInferenceDepth<Depth>> : S extends {
    type: 'json';
} ? JsonValue : S extends {
    oneOf: readonly unknown[];
} ? InferValueAt<S['oneOf'][number], NextInferenceDepth<Depth>> : never;
/**
 * Infer the TypeScript value accepted by an author-facing value schema.
 * Exact inference is bounded to 16 container levels, then falls back to
 * `JsonValue`.
 */
export type InferValue<S> = InferValueAt<S, []>;
/** Infer the TypeScript argument object for an implicit parameter schema. */
export type InferArgs<S> = InferProperties<S, []>;
/** Thrown by `execute` when model-generated arguments violate the schema. */
export declare class ToolArgsError extends Error {
    /** Individual violations in schema-walk order. */
    readonly violations: string[];
    constructor(violations: string[]);
}
/**
 * Compile the implicit open parameter object of a tool: the author dialect
 * names per-property descriptors, and the result is an object-rooted JSON
 * Schema with no implicit-root openness override.
 */
export declare function parameterSpecToJsonSchema(spec: unknown): ParameterJsonSchema;
/** Compile an author-facing value schema (tool output shape). */
export declare function valueSpecToJsonSchema(spec: unknown): JsonSchema;
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
export declare function defineTool<const S extends ParameterSchemaSpec, const O extends ValueSchemaSpec>(options: DefineToolOptions<S, O>): DefinedTool;
export {};
//# sourceMappingURL=tooldef.d.ts.map