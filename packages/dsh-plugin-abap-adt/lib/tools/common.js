import { resolveObject, resolvePackageName } from '../resolve.js';
import { AdtPolicyError } from '../policy.js';
/** Parameter spec for the destination selector used by every tool. */
export const DESTINATION_PARAM = {
    destination: {
        type: 'string',
        description: 'Destination name (configured in the plugin config). Omit to use the default destination.',
    },
};
/**
 * Shared `objectUri` / `name` / `type` parameter specs. Every tool that takes
 * an existing object by reference spreads these into its `parameters`.
 */
export const OBJECT_REF_PARAMS = {
    objectUri: {
        type: 'string',
        description: 'Exact ADT object URI (from search/read results), e.g. /sap/bc/adt/oo/classes/zcl_demo.',
    },
    name: { type: 'string', description: 'Object name, e.g. ZCL_DEMO.' },
    type: { type: 'string', description: 'Object type (short or ADT form), e.g. CLAS, INTF, PROG, DDLS.' },
};
/** Optional package hint used by the permission check of mutating tools. */
export const PACKAGE_HINT_PARAM = {
    packageName: {
        type: 'string',
        description: 'Package of the object; used for the permission check when the backend does not expose it.',
    },
};
/**
 * Shared `objects` array parameter for tools that process an object list
 * (activate, check, unit tests, ATC). Each entry is `{objectUri}` or
 * `{name, type}` — `name` is optional so a bare `objectUri` validates too.
 * Entries may carry `packageName` as a permission-check hint.
 */
export const OBJECTS_PARAM = {
    objects: {
        type: 'array',
        required: true,
        description: 'Objects to process. Each entry: {objectUri} or {name, type}. Pass ALL related objects in ONE call — ' +
            'e.g. a PROG main program AND its includes (activation does not cascade to includes on most backends).',
        items: {
            type: 'object',
            additionalProperties: false,
            properties: {
                objectUri: { type: 'string', description: 'Exact ADT object URI.' },
                name: { type: 'string', description: 'Object name (required unless objectUri is given).' },
                type: { type: 'string', description: 'Object type, e.g. CLAS, PROG, DDLS.' },
                packageName: {
                    type: 'string',
                    description: 'Optional package hint for the permission check (mutating tools only).',
                },
            },
        },
    },
};
/**
 * Shared `objects` array parameter for tools that accept an explicit object
 * set as the alternative to `packageName` (export, release gate).
 */
export const NAME_TYPE_OBJECTS_PARAM = {
    objects: {
        type: 'array',
        description: 'Alternative: explicit objects to process. Each: {name, type}.',
        items: {
            type: 'object',
            additionalProperties: false,
            properties: {
                name: { type: 'string', required: true },
                type: { type: 'string' },
            },
        },
    },
};
/** Pull the destination param value out of raw args. */
export function destinationOf(args) {
    return optStr(args['destination']);
}
/** A raw arg as a non-empty string, else `undefined`. */
export function optStr(value) {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}
/** Extract the `objectUri`/`name`/`type` reference args of a tool call. */
export function objectRefArgs(args) {
    return {
        objectUri: optStr(args.objectUri),
        name: optStr(args.name),
        type: optStr(args.type),
    };
}
/**
 * Resolve the object a tool call refers to: `objectUri` wins, otherwise
 * `name` (+ optional `type`) via search with exact-match preference.
 */
export async function resolveToolObject(client, args, signal) {
    return resolveObject(client, objectRefArgs(args), 10, signal);
}
/**
 * Fail-closed permission gate for tools that modify an existing object
 * (write / edit / delete / activate): resolve the object's package (explicit
 * hint first, then an exact-name search hit) and assert the edit policy of
 * the DESTINATION the call targets. An undeterminable package is DENIED with
 * an AdtPolicyError naming the rule. Returns the resolved package name.
 */
export async function assertObjectEditable(destination, ref, options) {
    const packageName = await resolvePackageName(destination.client, ref, options.packageHint, options.signal);
    if (!packageName) {
        throw new AdtPolicyError('allowedPackages', `${options.toolName}: cannot determine the package of ${ref.name} for the permission check; ` +
            'pass `packageName` explicitly or read the object first');
    }
    destination.policy.assertEditAllowed(packageName, options.toolName);
    return packageName;
}
/**
 * Clamp helper that never goes silent: returns the clamped value plus a note
 * describing the adjustment (empty when the request was within bounds), so
 * tools can surface the clamping in their output.
 */
export function clampWithNote(requested, min, max, label) {
    const value = Math.min(Math.max(Math.floor(requested), min), max);
    if (value === requested)
        return { value };
    return { value, note: `${label} clamped from ${requested} to ${value} (allowed ${min}..${max})` };
}
/** Render a simple text block. */
export function text(content) {
    return [{ type: 'text', text: content }];
}
/**
 * Deep-strip `undefined` values so tool outputs pass the DSH lossless-JSON
 * boundary (the registry rejects any object property whose value is
 * `undefined`, because JSON has no representation for it). `null` is kept.
 */
export function deepCompact(value) {
    if (Array.isArray(value)) {
        const out = [];
        for (const item of value) {
            const cleaned = deepCompact(item);
            if (cleaned !== undefined)
                out.push(cleaned);
        }
        return out;
    }
    if (value !== null && typeof value === 'object') {
        const out = {};
        for (const [key, item] of Object.entries(value)) {
            const cleaned = deepCompact(item);
            if (cleaned !== undefined)
                out[key] = cleaned;
        }
        return out;
    }
    return value;
}
/** Render an object list as a compact table. */
export function renderObjectRefs(refs) {
    if (refs.length === 0)
        return '(no objects)';
    const rows = refs.map((r) => `- ${r.name} (${r.type}) — ${r.uri}`);
    return rows.join('\n');
}
/** A terse success renderer shared by lifecycle tools. */
export function renderMessages(title, lines) {
    const body = lines.length ? lines.join('\n') : '(no messages)';
    return `${title}\n${body}`;
}
//# sourceMappingURL=common.js.map