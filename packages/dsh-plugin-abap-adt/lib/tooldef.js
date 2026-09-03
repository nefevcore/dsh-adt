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
// ---------------------------------------------------------------------------
// Runtime schema compilation (the enforced subset)
// ---------------------------------------------------------------------------
/** Thrown by `execute` when model-generated arguments violate the schema. */
export class ToolArgsError extends Error {
    /** Individual violations in schema-walk order. */
    violations;
    constructor(violations) {
        super(`invalid arguments: ${violations.join('; ')}`);
        this.name = 'ToolArgsError';
        this.violations = violations;
    }
}
/** Author-facing descriptor error (definition time, not call time). */
function authorError(message) {
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
function compileNode(spec, path) {
    if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
        authorError(`${path} must be a schema object, got ${Array.isArray(spec) ? 'an array' : typeof spec}`);
    }
    const input = spec;
    const schema = {};
    let required = false;
    for (const [key, value] of Object.entries(input)) {
        if (key === 'required') {
            if (value === true)
                required = true;
            else if (value === false || value === undefined)
                continue;
            else
                authorError(`${path}.required must be true (the array form belongs on the parent object in JSON Schema)`);
            continue;
        }
        if (key === 'properties') {
            if (value === null || typeof value !== 'object' || Array.isArray(value)) {
                authorError(`${path}.properties must be an object`);
            }
            const properties = {};
            const requiredNames = [];
            for (const [name, sub] of Object.entries(value)) {
                const compiled = compileNode(sub, `${path}.properties.${name}`);
                if (compiled.required)
                    requiredNames.push(name);
                properties[name] = compiled.schema;
            }
            schema.properties = properties;
            if (requiredNames.length > 0)
                schema.required = requiredNames;
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
                if (value === 'json')
                    continue;
            }
            else if (key === 'additionalProperties' && typeof value !== 'boolean') {
                authorError(`${path}.additionalProperties must be a boolean`);
            }
            else if (key === 'enum' &&
                (!Array.isArray(value) ||
                    value.some((v) => !['string', 'number', 'boolean'].includes(typeof v) && v !== null))) {
                authorError(`${path}.enum must be an array of primitives`);
            }
            else if (key === 'const' && !['string', 'number', 'boolean'].includes(typeof value) && value !== null) {
                authorError(`${path}.const must be a primitive`);
            }
            schema[key] = value;
            continue;
        }
        authorError(`unknown keyword "${key}" at ${path} (supported: ${[...SCHEMA_CONSTRAINT_KEYS, ...SCHEMA_ANNOTATION_KEYS].join(', ')})`);
    }
    return { schema, required };
}
/**
 * Compile the implicit open parameter object of a tool: the author dialect
 * names per-property descriptors, and the result is an object-rooted JSON
 * Schema with no implicit-root openness override.
 */
export function parameterSpecToJsonSchema(spec) {
    // The author dialect hands a PROPERTY MAP (param name → descriptor); wrap
    // it into an object node so compileNode's keyword walk sees the descriptors
    // as properties, not as schema keywords.
    const map = spec === null || typeof spec !== 'object' || Array.isArray(spec)
        ? authorError('parameters must be a property map (param name → descriptor)')
        : spec;
    const compiled = compileNode({ type: 'object', properties: map }, 'parameters');
    const schema = {
        type: 'object',
        properties: compiled.schema.properties ?? {},
    };
    if (compiled.schema.required !== undefined)
        schema.required = compiled.schema.required;
    return schema;
}
/** Compile an author-facing value schema (tool output shape). */
export function valueSpecToJsonSchema(spec) {
    return compileNode(spec, 'schema').schema;
}
// ---------------------------------------------------------------------------
// Argument validation (mirrors the dsh-tools violation wording exactly —
// tests and hosts pattern-match these strings; empty result means valid)
// ---------------------------------------------------------------------------
/** The human name of a path in violations ("" reads as "arguments"). */
function diagnosticPath(path) {
    return path === '' ? 'arguments' : path;
}
/** Append one object property without a leading dot at an implicit root. */
function propertyPath(path, key) {
    return path === '' ? key : `${path}.${key}`;
}
/** Enum/const scalar checks shared by the primitive types. */
function checkScalarValue(schema, value, path) {
    if (schema.enum !== undefined && !schema.enum.includes(value)) {
        return [`"${diagnosticPath(path)}" must be one of ${JSON.stringify(schema.enum)}`];
    }
    if (schema.const !== undefined && value !== schema.const) {
        return [`"${diagnosticPath(path)}" must be ${JSON.stringify(schema.const)}`];
    }
    return [];
}
/** Validate a value against a compiled schema node; returns violations. */
function validateNode(schema, value, path) {
    const type = schema.type;
    // A node without a `type` (annotation-only) accepts any lossless JSON.
    if (type === undefined)
        return [];
    switch (type) {
        case 'object': {
            if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                return [`"${diagnosticPath(path)}" must be an object`];
            }
            const record = value;
            const violations = [];
            for (const key of schema.required ?? []) {
                if (!Object.hasOwn(record, key) || record[key] === undefined) {
                    violations.push(`missing required property "${propertyPath(path, key)}"`);
                }
            }
            const properties = schema.properties ?? {};
            for (const [key, sub] of Object.entries(properties)) {
                if (!Object.hasOwn(record, key) || record[key] === undefined)
                    continue;
                violations.push(...validateNode(sub, record[key], propertyPath(path, key)));
            }
            if (schema.additionalProperties === false) {
                for (const key of Object.keys(record)) {
                    if (!Object.hasOwn(properties, key)) {
                        violations.push(`"${propertyPath(path, key)}" is not a declared property (additionalProperties: false)`);
                    }
                }
            }
            return violations;
        }
        case 'array': {
            if (!Array.isArray(value))
                return [`"${diagnosticPath(path)}" must be an array`];
            const items = schema.items;
            if (items === undefined)
                return [];
            const violations = [];
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
/**
 * Define one tool from the author dialect: compile parameter and output
 * schemas to the enforced JSON Schema subset and wrap `execute` with
 * argument validation.
 */
export function defineTool(options) {
    const userExecute = options.execute;
    const userRender = options.output.render;
    const userPresentationMeta = options.output.presentationMeta;
    const userPresentResult = options.presentResult;
    const userIsConcurrencySafe = options.isConcurrencySafe;
    if (options.timeoutMs !== void 0 && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)) {
        throw new Error(`defineTool(${options.name}): timeoutMs must be a positive finite number`);
    }
    const parameters = parameterSpecToJsonSchema(options.parameters);
    const outputSchema = valueSpecToJsonSchema(options.output.schema);
    const validate = (args) => validateNode(parameters, args, '');
    const tool = {
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
                    presentationMeta(args, value) {
                        return userPresentationMeta(args, value);
                    },
                }
                : {}),
        },
        ...(options.timeoutMs !== void 0 ? { timeoutMs: options.timeoutMs } : {}),
        async execute(args, exec) {
            const violations = validate(args);
            if (violations.length > 0)
                throw new ToolArgsError(violations);
            return userExecute(args, exec);
        },
    };
    if (userPresentResult) {
        tool.presentResult = (args, result) => {
            if (validate(args).length > 0)
                return void 0;
            return userPresentResult(args, result);
        };
    }
    if (userIsConcurrencySafe) {
        tool.isConcurrencySafe = (args) => {
            if (validate(args).length > 0)
                return false;
            return userIsConcurrencySafe(args);
        };
    }
    return tool;
}
//# sourceMappingURL=tooldef.js.map