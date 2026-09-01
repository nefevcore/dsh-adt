/**
 * adt_read_object — read an object's source and metadata. `startLine` /
 * `endLine` (1-based, inclusive) window the source so huge objects can be
 * read in slices; the response always carries `totalLines` for paging.
 * Full reads (no window) up to a size cap replay as a line-numbered read
 * card; windowed reads render inline.
 *
 * By default the FULL source is also kept as a LOCAL SNAPSHOT
 * (`.adt-snapshots/<destination>/…`, sandbox-aware) with the server content
 * hash in a sidecar — the base of the conflict-checked edit/push flow
 * (adt_edit_object matches against this snapshot; adt_push_object uploads a
 * locally edited copy after verifying the server still matches).
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { sessionCwd, DESTINATION_PARAM, OBJECT_REF_PARAMS, destinationOf, resolveToolObject, text } from './common.js';
import { typeLabel } from '../resolve.js';
import { hashSource, saveSnapshot } from '../snapshots.js';
import { findMethodBlocks } from '../abap.js';
import { buildContextPrologue, CONTEXT_DEPS_MAX, CONTEXT_DEPS_MIN, DEFAULT_CONTEXT_DEPS } from '../contextprologue.js';
/** Upper bound for read-card metadata lines; larger sources fall back to the
 * generic card instead of persisting a second copy of a huge source. */
const READ_META_MAX_LINES = 2000;
/** Types whose content is structured XML metadata, not source text —
 *  adt_read_structure owns them (mirrors its AdtStructureKind set). */
const STRUCTURED_KINDS = new Set(['MSAG', 'DOMA', 'DTEL', 'TTYP']);
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
export function readTools(deps, ctx) {
    const { registry } = deps;
    const readObject = defineTool({
        name: 'adt_read_object',
        description: 'Read the source code and metadata of an ABAP development object (class, interface, program, CDS view, ' +
            'table, domain, ...). Pass `objectUri` (from search results) or `name` + optional `type`. ' +
            'Optionally window the source with `startLine`/`endLine` (1-based, inclusive) — the response always ' +
            'carries `totalLines` so large objects can be read in slices. ' +
            'By default the full source is also kept as a local snapshot (see `localCopy` in the output): ' +
            'adt_edit_object matches against that snapshot and refuses with [CONFLICT] when the server copy changed ' +
            'since this read; adt_push_object uploads a locally edited copy after the same verification.',
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
            snapshot: {
                type: 'boolean',
                description: 'Keep/refresh a local snapshot of the FULL source for conflict-checked editing (default true). ' +
                    'The snapshot is what adt_edit_object matches against; disable only to save disk.',
            },
            method: {
                type: 'string',
                description: 'Method-level read (classes only): return just this METHOD … ENDMETHOD. block instead of the whole ' +
                    'source — the response still carries totalLines/startLine/endLine of the FULL source, so the block ' +
                    'addresses the same line numbers you would see in a full read. Cheaper than reading a 1000-line class ' +
                    'when you need one 30-line method. Not found → error listing closest method names; defined in several ' +
                    'local classes → error listing each occurrence (use startLine/endLine then).',
            },
            context: {
                type: 'boolean',
                description: 'Append a DEPENDENCY-CONTRACT PROLOGUE (default false): the public-section contracts of the classes/' +
                    'interfaces this source uses (superclass and interfaces first, then signature types, collaborators, ' +
                    'exceptions) — one read then carries source + what you need to understand it. Unresolved dependencies ' +
                    'are listed visibly rather than dropped. Incompatible huge-object reads still cap `source` as usual.',
            },
            contextDeps: {
                type: 'integer',
                description: `Contracts to resolve into the prologue (default ${DEFAULT_CONTEXT_DEPS}, clamped ${CONTEXT_DEPS_MIN}–${CONTEXT_DEPS_MAX}).`,
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
                    localCopy: {
                        type: 'string',
                        description: 'Workspace path of the local snapshot (full source, not the windowed slice).',
                    },
                    snapshotHash: {
                        type: 'string',
                        description: 'Content hash of the server source at read time — the conflict-check base.',
                    },
                    method: {
                        type: 'string',
                        description: 'Present when the read was method-level: the method name that selected the window.',
                    },
                    contextPrologue: {
                        type: 'string',
                        description: 'Dependency-contract prologue (context: true): ABAP-comment block listing resolved contracts, ' +
                            'unresolved dependencies (visible, with reasons) and called function modules.',
                    },
                    note: { type: 'string', description: 'Present when the returned source was truncated at the char cap.' },
                },
            },
            render: (_args, value) => {
                const windowed = value.startLine > 1 || value.endLine < value.totalLines;
                const header = `${value.name} (${typeLabel(value.type)}) — ${value.uri}` +
                    (value.method ? ` [method ${value.method} · lines ${value.startLine}..${value.endLine} of ${value.totalLines}]` : windowed ? ` [lines ${value.startLine}..${value.endLine} of ${value.totalLines}]` : '');
                return text([
                    header,
                    value.description ? `Description: ${value.description}` : '',
                    '',
                    value.contextPrologue ? '```abap\n' + value.contextPrologue + '\n```\n' : '',
                    '```abap',
                    value.source,
                    '```',
                    value.note ? `⚠ ${value.note}` : '',
                ]
                    .filter((l) => l !== '')
                    .join('\n'));
            },
            presentationMeta: (_args, value) => 
            // Only full reads replay as a read card; windowed slices (and
            // method-level reads, which are windows by definition) render inline.
            !value.method && value.startLine <= 1 && value.endLine >= value.totalLines
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
            const entry = await registry.require(destinationOf(args), sessionCwd(exec));
            const ref = await resolveToolObject(entry.client, args, exec.signal);
            // Routing guard — the symmetric half of adt_read_structure's own guard
            // (which rejects source objects with a pointer here): these types have
            // no plain /source/main on real backends (and only placeholder text on
            // the mock), so reading them "as source" is never what the caller
            // wanted. Refuse with the right destination instead of junk-or-404.
            const category = ref.type.split('/')[0]?.toUpperCase() ?? '';
            if (STRUCTURED_KINDS.has(category)) {
                throw new Error(`adt_read_object: ${ref.name} is a ${category} — its content is structured metadata, not source text. ` +
                    `Use adt_read_structure (name: ${ref.name}, kind: ${category}) instead.`);
            }
            if (category === 'DEVC') {
                throw new Error(`adt_read_object: ${ref.name} is a package — list its objects with adt_package_content (packageName: ${ref.name}).`);
            }
            const parsed = await entry.client.readSource(ref.uri, { signal: exec.signal });
            const properties = {};
            for (const p of parsed.properties)
                properties[p.key] = p.value;
            const description = properties['description'] ?? '';
            const rawLines = parsed.source.split('\n');
            const totalLines = parsed.source.endsWith('\n') ? rawLines.length - 1 : rawLines.length;
            // ---- Method-level window: `method` selects the METHOD … ENDMETHOD.
            // block; explicit startLine/endLine stay a separate addressing mode.
            const methodName = typeof args.method === 'string' ? args.method.trim() : undefined;
            if (methodName) {
                if (args.startLine !== undefined || args.endLine !== undefined) {
                    throw new Error('adt_read_object: `method` cannot be combined with `startLine`/`endLine` — the method picks the window');
                }
                const blocks = findMethodBlocks(parsed.source, methodName);
                if (blocks.length === 0) {
                    const known = [...new Set((parsed.source.match(/^\s*METHOD\s+([A-Za-z0-9_\/]+)/gim) ?? []).map((m) => m.trim().replace(/^METHOD\s+/i, '')))];
                    throw new Error(`adt_read_object: method "${methodName}" not found in ${ref.name} (${totalLines} lines)` +
                        (known.length ? `; methods defined here: ${known.join(', ')}` : '; no METHOD implementation found — is this a class?'));
                }
                if (blocks.length > 1) {
                    const occurrences = blocks.map((b, i) => `#${i + 1} lines ${b.startIdx + 1}..${b.endIdx + 1}`).join('; ');
                    throw new Error(`adt_read_object: method "${methodName}" is defined ${blocks.length} times (local classes?) — ${occurrences}. ` +
                        'Read the full source and use startLine/endLine to pick one.');
                }
                args = { ...args, startLine: blocks[0].startIdx + 1, endLine: blocks[0].endIdx + 1 };
            }
            const requestedStart = Number(args.startLine ?? 1);
            const requestedEnd = Number(args.endLine ?? totalLines);
            const startLine = Math.min(Math.max(Number.isFinite(requestedStart) ? requestedStart : 1, 1), Math.max(totalLines, 1));
            const endLine = Math.min(Math.max(Number.isFinite(requestedEnd) ? requestedEnd : totalLines, startLine), Math.max(totalLines, 1));
            const source = rawLines.slice(startLine - 1, endLine).join('\n');
            // Context cap (audit P3): a full read of a very large object used to
            // enter the context unchecked. The snapshot still holds the FULL
            // source — only the returned `source` is capped; read in
            // startLine/endLine windows for the rest.
            const MAX_SOURCE_CHARS = 200_000;
            let returned = source;
            let note;
            if (source.length > MAX_SOURCE_CHARS) {
                const kept = source.slice(0, MAX_SOURCE_CHARS);
                const keptLines = kept.split('\n').length - 1;
                returned = kept;
                note =
                    `source truncated at ${MAX_SOURCE_CHARS} chars (lines ${startLine}..${startLine + keptLines - 1} of ` +
                        `${totalLines}) — continue reading with startLine=${startLine + keptLines}`;
            }
            // Local snapshot (default on): the full source + its server-side hash.
            // This is what adt_edit_object matches against and what
            // adt_push_object verifies/uploads — the base of the OCC edit flow.
            // dsh-fs is OPTIONAL (audit D1): without it the read still succeeds
            // (edit later falls back to server-side matching).
            let localCopy;
            let snapshotHash;
            if (ctx?.get('fs') && args.snapshot !== false) {
                try {
                    localCopy = await saveSnapshot(ctx, entry.config.name, ref, parsed.source);
                    snapshotHash = hashSource(parsed.source);
                }
                catch {
                    // Snapshotting is an optimization of the edit flow, never a read
                    // failure — degrade silently (edit falls back to server matching).
                }
            }
            // Dependency-contract prologue (context: true): extracted from the
            // WINDOW text, so a method-level read scopes dependencies to the
            // method's own code (vsp ctxcomp behavior).
            let contextPrologue;
            if (args.context === true) {
                const built = await buildContextPrologue(entry.client, source, ref.name, {
                    maxDeps: args.contextDeps !== undefined ? Number(args.contextDeps) : undefined,
                    signal: exec.signal,
                });
                contextPrologue = built.prologue;
            }
            return {
                uri: ref.uri,
                name: ref.name,
                type: ref.type,
                source: returned,
                description: description || undefined,
                properties,
                startLine,
                endLine,
                totalLines,
                method: methodName || undefined,
                contextPrologue,
                localCopy,
                snapshotHash,
                note,
            };
        },
    });
    return [readObject];
}
//# sourceMappingURL=read.js.map