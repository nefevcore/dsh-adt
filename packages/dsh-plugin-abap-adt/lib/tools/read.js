/**
 * adt_read_object — read an object's source and metadata. `startLine` /
 * `endLine` (1-based, inclusive) window the source so huge objects can be
 * read in slices; the response always carries `totalLines` for paging.
 * Full reads (no window) up to a size cap replay as a line-numbered read
 * card; windowed reads render inline.
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { DESTINATION_PARAM, OBJECT_REF_PARAMS, destinationOf, resolveToolObject, text } from './common.js';
import { typeLabel } from '../resolve.js';
/** Upper bound for read-card metadata lines; larger sources fall back to the
 * generic card instead of persisting a second copy of a huge source. */
const READ_META_MAX_LINES = 2000;
function readPresentationMeta(value) {
    const source = value.source ?? '';
    const rawLines = source.split('\n');
    if (rawLines.length > READ_META_MAX_LINES)
        return null;
    // A trailing newline yields one phantom empty line — do not number it.
    const count = source.endsWith('\n') ? rawLines.length - 1 : rawLines.length;
    const shortType = value.type.split('/')[0]?.toLowerCase() ?? 'object';
    return {
        path: `${value.name.toLowerCase()}.${shortType}.abap`,
        offset: 1,
        lines: rawLines.slice(0, count).map((l, i) => ({ number: i + 1, text: l })),
        totalLines: count,
        lang: 'abap',
    };
}
export function readTools(deps) {
    const { registry } = deps;
    const readObject = defineTool({
        name: 'adt_read_object',
        description: 'Read the source code and metadata of an ABAP development object (class, interface, program, CDS view, ' +
            'table, domain, ...). Pass `objectUri` (from search results) or `name` + optional `type`. ' +
            'Optionally window the source with `startLine`/`endLine` (1-based, inclusive) — the response always ' +
            'carries `totalLines` so large objects can be read in slices.',
        parameters: {
            ...OBJECT_REF_PARAMS,
            startLine: {
                type: 'integer',
                description: 'First source line to return (1-based, inclusive). Default 1.',
            },
            endLine: {
                type: 'integer',
                description: 'Last source line to return (inclusive). Default: last line (totalLines).',
            },
            ...DESTINATION_PARAM,
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    uri: { type: 'string', required: true },
                    name: { type: 'string', required: true },
                    type: { type: 'string', required: true },
                    source: { type: 'string', required: true },
                    description: { type: 'string' },
                    properties: {
                        type: 'object',
                        additionalProperties: true,
                    },
                    startLine: { type: 'integer', required: true },
                    endLine: { type: 'integer', required: true },
                    totalLines: { type: 'integer', required: true },
                },
            },
            render: (_args, value) => {
                const windowed = value.startLine > 1 || value.endLine < value.totalLines;
                const header = `${value.name} (${typeLabel(value.type)}) — ${value.uri}` +
                    (windowed ? ` [lines ${value.startLine}..${value.endLine} of ${value.totalLines}]` : '');
                return text([
                    header,
                    value.description ? `Description: ${value.description}` : '',
                    '',
                    '```abap',
                    value.source,
                    '```',
                ]
                    .filter((l) => l !== '')
                    .join('\n'));
            },
            presentationMeta: (_args, value) => 
            // Only full reads replay as a read card; windowed slices render inline.
            value.startLine <= 1 && value.endLine >= value.totalLines
                ? readPresentationMeta(value)
                : null,
        },
        presentResult: (_args, result) => {
            const meta = result.meta;
            if (!meta || !Array.isArray(meta.lines))
                return undefined; // replay of an old/absent shape
            return {
                card: 'read',
                title: meta.path,
                path: meta.path,
                offset: meta.offset,
                lines: meta.lines,
                totalLines: meta.totalLines,
                lang: meta.lang,
            };
        },
        isConcurrencySafe: () => true,
        execute: async (args, exec) => {
            const entry = registry.require(destinationOf(args));
            const ref = await resolveToolObject(entry.client, args, exec.signal);
            const parsed = await entry.client.readSource(ref.uri, { signal: exec.signal });
            const properties = {};
            for (const p of parsed.properties)
                properties[p.key] = p.value;
            const description = properties['description'] ?? '';
            const rawLines = parsed.source.split('\n');
            const totalLines = parsed.source.endsWith('\n') ? rawLines.length - 1 : rawLines.length;
            const requestedStart = Number(args.startLine ?? 1);
            const requestedEnd = Number(args.endLine ?? totalLines);
            const startLine = Math.min(Math.max(Number.isFinite(requestedStart) ? requestedStart : 1, 1), Math.max(totalLines, 1));
            const endLine = Math.min(Math.max(Number.isFinite(requestedEnd) ? requestedEnd : totalLines, startLine), Math.max(totalLines, 1));
            const source = rawLines.slice(startLine - 1, endLine).join('\n');
            return {
                uri: ref.uri,
                name: ref.name,
                type: ref.type,
                source,
                description: description || undefined,
                properties,
                startLine,
                endLine,
                totalLines,
            };
        },
    });
    return [readObject];
}
//# sourceMappingURL=read.js.map