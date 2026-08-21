/**
 * adt_write_object — replace an object's whole source (lock → write → unlock,
 * with policy enforcement and lock-ledger tracking); optional `activate`
 * fires the activation in the same call so the common write-then-activate
 * loop is one round-trip.
 *
 * adt_edit_object — replace exactly ONE block of an existing source (class
 * method, FORM, FUNCTION, MODULE, or any marker-delimited block) without
 * uploading the whole object. Block matching mirrors the semantics of the
 * DSH `edit` tool: markers are matched against comment-stripped lines, and
 * an AMBIGUOUS marker (multiple candidate lines) is an error listing the
 * candidates — never a silent first-match.
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { DESTINATION_PARAM, OBJECT_REF_PARAMS, PACKAGE_HINT_PARAM, assertObjectEditable, destinationOf, optStr, resolveToolObject, text, } from './common.js';
/** Read a UTF-8 text file through the sandbox-aware DSH filesystem service. */
async function readSourceFile(ctx, filePath) {
    const fs = ctx.fs;
    if (!fs)
        throw new Error('adt: the dsh filesystem service (ctx.fs) is required to read `sourceFile`');
    const target = await fs.resolve(filePath);
    return fs.readText(target);
}
/** Resolve the replacement source from args: `sourceFile` (local file, takes
 * precedence) or `source` (inline) — exactly one must be given. */
async function resolveSourceInput(ctx, args) {
    const inline = typeof args.source === 'string' ? args.source : undefined;
    const file = optStr(args.sourceFile);
    if (inline !== undefined && file !== undefined) {
        throw new Error('adt: provide exactly one of `source` and `sourceFile`');
    }
    if (file !== undefined)
        return readSourceFile(ctx, file);
    if (inline !== undefined)
        return inline;
    throw new Error('adt: `source` or `sourceFile` is required');
}
/** Auto-derive the closing statement for common ABAP block openers. */
function defaultEndFor(startText) {
    const s = startText.trim().toUpperCase();
    if (/^(?:METHOD|CLASS-METHOD)\b/.test(s))
        return 'ENDMETHOD.';
    if (/^FORM\b/.test(s))
        return 'ENDFORM.';
    if (/^FUNCTION\b/.test(s))
        return 'ENDFUNCTION.';
    if (/^MODULE\b/.test(s))
        return 'ENDMODULE.';
    return undefined;
}
/**
 * Strip ABAP comments from a line for marker matching: `*` at line start is a
 * full-line comment; `"` starts a tail comment unless it sits inside a
 * single-quoted string literal ('' is an escaped quote inside literals).
 */
export function stripAbapComment(line) {
    if (line.trimStart().startsWith('*'))
        return '';
    let inString = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === "'")
            inString = !inString;
        else if (ch === '"' && !inString)
            return line.slice(0, i);
    }
    return line;
}
const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');
/** Aggressive normalization: all whitespace removed — tolerates spacing
 * differences INSIDE string literals (`'BUKRS  '` vs `'BUKRS'`) and any
 * indentation. A later match tier than `norm`. */
const nospace = (s) => s.toLowerCase().replace(/\s+/g, '');
/** Token-set similarity for not-found suggestions (code + CJK runs). */
function suggestLines(lines, marker, limit = 3) {
    const tokens = new Set((stripAbapComment(marker).toLowerCase().match(/[a-z0-9_\u4e00-\u9fff]+/g) ?? []).filter((t) => t.length > 1));
    if (tokens.size === 0)
        return [];
    const scored = [];
    for (let i = 0; i < lines.length; i++) {
        const lineTokens = new Set((stripAbapComment(lines[i] ?? '').toLowerCase().match(/[a-z0-9_\u4e00-\u9fff]+/g) ?? []).filter((t) => t.length > 1));
        if (lineTokens.size === 0)
            continue;
        let hit = 0;
        for (const t of tokens)
            if (lineTokens.has(t))
                hit++;
        const score = hit / tokens.size;
        if (score >= 0.6)
            scored.push({ i, score });
    }
    return scored
        .sort((a, b) => b.score - a.score || a.i - b.i)
        .slice(0, limit)
        .map((s) => `line ${s.i + 1}: ${(lines[s.i] ?? '').trim()}`);
}
/** Find the lines a marker matches, tier by tier (first tier with hits wins). */
function findMarkerHits(lines, marker) {
    // Tier 1: comment-stripped on both sides, whitespace collapsed. Comment
    // lines never match; a marker copied verbatim INCLUDING a tail comment
    // still matches (both sides stripped).
    const strippedKey = norm(stripAbapComment(marker));
    if (strippedKey) {
        const hits = [];
        for (let i = 0; i < lines.length; i++) {
            if (norm(stripAbapComment(lines[i] ?? '')).includes(strippedKey))
                hits.push(i);
        }
        if (hits.length > 0)
            return { hits, mode: 'text' };
    }
    // Tier 2: whitespace-free on stripped sides — spacing variance inside
    // quotes (`'BUKRS  '` vs `'BUKRS'`) and arbitrary indentation.
    const looseKey = nospace(stripAbapComment(marker));
    if (looseKey) {
        const hits = [];
        for (let i = 0; i < lines.length; i++) {
            if (nospace(stripAbapComment(lines[i] ?? '')).includes(looseKey))
                hits.push(i);
        }
        if (hits.length > 0)
            return { hits, mode: 'text-loose' };
    }
    // Tier 3: raw lines (comments kept) — the only way to address commented-out
    // code (`* some_code.`) or to match on comment text.
    const rawKey = norm(marker);
    if (rawKey) {
        const hits = [];
        for (let i = 0; i < lines.length; i++) {
            if (norm(lines[i] ?? '').includes(rawKey))
                hits.push(i);
        }
        if (hits.length > 0)
            return { hits, mode: 'text-raw' };
    }
    return { hits: [], mode: 'text' };
}
function pair(openerSource, closer) {
    return {
        opener: new RegExp(`\\b(?:${openerSource})\\b`, 'gi'),
        closer,
        closerRe: new RegExp(`\\b${closer.replace(/[-]/g, '\\-')}\\b`, 'gi'),
    };
}
/**
 * ABAP block pairs. Only unambiguous, non-nesting-conflicting constructs are
 * listed — anything riskier (AT/ENDAT vs event AT, BEGIN OF/END OF inline
 * declarations) keeps the text-tier fallback instead of a wrong structural
 * answer. `ELSE/ELSEIF/WHEN/CATCH/...` middle segments never affect depth.
 */
const BLOCK_PAIRS = [
    pair('FORM', 'ENDFORM'),
    pair('FUNCTION', 'ENDFUNCTION'),
    pair('MODULE', 'ENDMODULE'),
    pair('METHOD', 'ENDMETHOD'),
    pair('IF', 'ENDIF'),
    pair('CASE', 'ENDCASE'),
    pair('DO', 'ENDDO'),
    pair('LOOP', 'ENDLOOP'),
    pair('WHILE', 'ENDWHILE'),
    pair('TRY', 'ENDTRY'),
    pair('DEFINE', 'END-OF-DEFINITION'),
];
const CLOSER_TO_PAIR = new Map(BLOCK_PAIRS.map((p) => [p.closer, p]));
/**
 * Prepare a line for structural token counting: comments stripped, string
 * literals blanked (so 'xxx ENDFORM .' inside a literal never counts), and
 * same-word false openers guarded (CALL FUNCTION, CALL METHOD, CLASS-METHOD,
 * FUNCTION-POOL, TO UPPER/LOWER CASE).
 */
function prepareStructuralLine(line) {
    return stripAbapComment(line)
        .replace(/'(?:[^']|'')*'/g, "''")
        .replace(/\|(?:[^|\\]|\\.)*\|/g, '')
        .replace(/\bCALL\s+FUNCTION\b/gi, '')
        .replace(/\bCALL\s+METHOD\b/gi, '')
        .replace(/\bCLASS-METHOD\b/gi, '')
        .replace(/\bFUNCTION-POOL\b/gi, '')
        .replace(/\b(?:UPPER|LOWER)\s+CASE\b/gi, '');
}
const countMatches = (text, re) => (text.match(re) ?? []).length;
/**
 * Resolve the block end by NESTING DEPTH from the start line: count opener
 * vs closer tokens of the SAME pair family; the line where the depth returns
 * to zero is the block's own closer. Immune to duplicate closers (31×
 * ENDFORM), nested blocks, keyword text inside strings/comments and CALL
 * FUNCTION false openers. Returns undefined when the start line has no known
 * opener or the depth never closes (→ caller falls back to text matching).
 */
function findStructuredEnd(lines, startIdx) {
    const startLine = prepareStructuralLine(lines[startIdx] ?? '');
    const active = BLOCK_PAIRS.filter((p) => p.opener.test(startLine));
    if (active.length === 0)
        return undefined;
    // A start line can only open ONE family in practice; the first match wins.
    const p = active[0];
    let depth = 0;
    for (let i = startIdx; i < lines.length; i++) {
        const text = prepareStructuralLine(lines[i] ?? '');
        depth += countMatches(text, p.opener);
        depth -= countMatches(text, p.closerRe);
        if (depth <= 0)
            return { endIdx: i, closer: p.closer };
    }
    return undefined;
}
/** Is this end marker a NAKED closer (ENDFORM. / ENDIF / END-OF-DEFINITION.)? */
function nakedCloser(endText) {
    const token = stripAbapComment(endText).trim().replace(/\.$/, '').toUpperCase().replace(/\s+/g, '');
    return CLOSER_TO_PAIR.has(token) ? token : undefined;
}
/** Assemble the replaced source from resolved line indices. */
function spliceBlock(lines, startIdx, endIdx, replacement, nl, matchMode, occurrence) {
    const block = replacement.replace(/\r\n/g, '\n').replace(/\n/g, nl);
    const before = lines.slice(0, startIdx);
    const after = lines.slice(endIdx + 1);
    const prefix = before.length ? before.join(nl) + nl : '';
    const suffix = after.length ? nl + after.join(nl) : '';
    return {
        full: prefix + block + suffix,
        oldLines: endIdx - startIdx + 1,
        newLines: block.split(/\r\n|\n/).length,
        startLineNumber: startIdx + 1,
        endLineNumber: endIdx + 1,
        matchMode,
        occurrence: occurrence && occurrence > 1 ? occurrence : undefined,
    };
}
/**
 * Locate a block by start/end line markers in the source and replace it
 * wholesale; bytes outside the block are preserved. Line-ending style follows
 * the source file (CRLF/LF).
 *
 * Marker matching runs in TIERS (see findMarkerHits): comment-stripped →
 * whitespace-free → raw. Disambiguation and fallbacks:
 *  - a start marker matching MULTIPLE lines errors with the numbered
 *    candidates unless `occurrence` (1-based, file order) picks one — the only
 *    way to edit exact-duplicate lines;
 *  - the END search starts AT the start line (start == end = single line) and
 *    takes the FIRST match — closers repeat massively in real code
 *    (ENDFORM./ENDIF./…) and the first one at/after the block start is the
 *    block's own;
 *  - `startLine`/`endLine` switch to line-number mode (verify the `start`
 *    marker against that line when both are given — stale-number guard);
 *  - zero-hit markers report the closest lines (token similarity) so the
 *    caller can self-correct in one round trip.
 */
export function replaceSourceBlock(source, startText, endText, replacement, options = {}) {
    const nl = source.includes('\r\n') ? '\r\n' : '\n';
    const lines = source.split(/\r\n|\n/);
    if (!norm(startText) && !norm(endText) && options.startLine === undefined) {
        throw new Error('adt_edit_object: start/end must not be empty');
    }
    // ---- Line-number mode: position-driven, immune to duplicate text. ----
    if (options.startLine !== undefined) {
        const startIdx = Math.floor(options.startLine) - 1;
        const endIdx = Math.floor(options.endLine ?? options.startLine) - 1;
        if (startIdx < 0 || endIdx < startIdx || endIdx >= lines.length) {
            throw new Error(`adt_edit_object: startLine/endLine out of range (source has ${lines.length} lines, got ` +
                `${options.startLine}..${options.endLine ?? options.startLine})`);
        }
        if (norm(startText)) {
            const line = lines[startIdx] ?? '';
            const markerStripped = stripAbapComment(startText);
            const ok = norm(stripAbapComment(line)).includes(norm(markerStripped)) ||
                nospace(stripAbapComment(line)).includes(nospace(markerStripped));
            if (!ok) {
                throw new Error(`adt_edit_object: startLine ${options.startLine} does not contain the given start marker — ` +
                    `that line is: ${line.trim()} (line numbers moved? re-read with adt_read_object)`);
            }
        }
        return spliceBlock(lines, startIdx, endIdx, replacement, nl, 'line-number', options.occurrence);
    }
    // ---- Marker mode. ----
    const notFoundHint = ' — the line may differ from what you expect (comments, spacing inside quotes, changed content): ' +
        'read the CURRENT source (adt_read_object with startLine/endLine) and copy the exact text, ' +
        'or edit by position (startLine/endLine)';
    const start = findMarkerHits(lines, startText);
    if (start.hits.length === 0) {
        const closest = suggestLines(lines, startText);
        throw new Error(`adt_edit_object: start line "${startText}" not found in the ${lines.length}-line source` +
            (closest.length ? `; closest lines: ${closest.join(' | ')}` : '') +
            notFoundHint);
    }
    let startIdx = start.hits[0];
    const occurrence = options.occurrence;
    if (start.hits.length > 1) {
        if (occurrence === undefined) {
            const candidates = start.hits
                .map((i, n) => `#${n + 1} line ${i + 1}: ${(lines[i] ?? '').trim()}`)
                .join('; ');
            throw new Error(`adt_edit_object: start marker matches ${start.hits.length} lines (${candidates}); ` +
                'pass `occurrence` (1-based in file order) to pick one, make the marker more specific, ' +
                'or use startLine/endLine');
        }
        if (occurrence < 1 || occurrence > start.hits.length) {
            throw new Error(`adt_edit_object: occurrence ${occurrence} is out of range — the marker matches ` +
                `${start.hits.length} lines (1..${start.hits.length})`);
        }
        startIdx = start.hits[occurrence - 1];
    }
    else if (occurrence !== undefined && occurrence !== 1) {
        throw new Error(`adt_edit_object: occurrence ${occurrence} is out of range — the marker matches exactly 1 line`);
    }
    // End resolution. A NAKED closer (ENDFORM. / ENDIF. / END-OF-DEFINITION.)
    // resolves STRUCTURALLY by nesting depth — immune to duplicate closers,
    // nested blocks, keyword text inside strings/comments and CALL FUNCTION
    // false openers. Anything else falls back to text matching (first hit
    // at/after the start line).
    let endIdx;
    let endMode = start.mode;
    if (nakedCloser(endText)) {
        const structured = findStructuredEnd(lines, startIdx);
        if (structured) {
            endIdx = structured.endIdx;
            endMode = 'structured';
        }
    }
    if (endIdx === undefined) {
        const end = findMarkerHits(lines.slice(startIdx), endText);
        if (end.hits.length === 0) {
            const closest = suggestLines(lines, endText);
            throw new Error(`adt_edit_object: end line "${endText}" not found at/after the start line ` +
                `(start matched at line ${startIdx + 1}: ${(lines[startIdx] ?? '').trim()})` +
                (closest.length ? `; closest lines: ${closest.join(' | ')}` : '') +
                notFoundHint);
        }
        endIdx = startIdx + end.hits[0];
    }
    return spliceBlock(lines, startIdx, endIdx, replacement, nl, endMode, occurrence);
}
/**
 * DSH-`edit` semantics for remote objects: replace an EXACT quoted text with
 * new text. The agent quotes `oldText` verbatim from a recent
 * adt_read_object (multi-line OK, tail comments tolerated) and the match runs
 * against the CURRENT server-side source — if the remote changed meanwhile,
 * the match simply fails (safe). Ambiguity is resolved the DSH way: include
 * neighboring lines in the quote (or `occurrence`); not-found lists the
 * closest lines so one re-read + retry converges.
 *
 * Matching: a single-line oldText goes through the tiered marker path
 * (substring-friendly). A multi-line oldText requires per-line equality
 * (comment-stripped, case-insensitive, whitespace collapsed; tier 2 tolerates
 * spacing inside quotes) — i.e. quote exactly what you read.
 */
export function replaceSourceText(source, oldText, newText, options = {}) {
    const oldLines = oldText.replace(/\r\n/g, '\n').split('\n');
    if (oldLines.length <= 1) {
        // Single line: route through the tiered marker path, but report
        // ambiguity in DSH-edit terms (extend the quote, not tool parameters).
        const probe = findMarkerHits(source.split(/\r\n|\n/), oldText);
        if (probe.hits.length > 1 && options.occurrence === undefined) {
            const candidates = probe.hits.map((i, n) => `#${n + 1} line ${i + 1}`).join('; ');
            throw new Error(`adt_edit_object: oldText matches ${probe.hits.length} locations (${candidates}); ` +
                'include neighboring lines in oldText to make it unique, pass `occurrence`, or use startLine/endLine');
        }
        return replaceSourceBlock(source, oldText, oldText, newText, { occurrence: options.occurrence });
    }
    const nl = source.includes('\r\n') ? '\r\n' : '\n';
    const lines = source.split(/\r\n|\n/);
    const k = oldLines.length;
    /** Per-line tier: 1 = stripped+collapsed equality, 2 = whitespace-free. */
    const lineTier = (candidate, quoted) => {
        const a = stripAbapComment(candidate);
        const b = stripAbapComment(quoted);
        if (norm(a) === norm(b))
            return 1;
        if (nospace(a) === nospace(b))
            return 2;
        return 0;
    };
    const matches = [];
    for (let i = 0; i + k <= lines.length; i++) {
        let tier = 1;
        for (let j = 0; j < k; j++) {
            const t = lineTier(lines[i + j] ?? '', oldLines[j] ?? '');
            if (t === 0) {
                tier = 0;
                break;
            }
            if (t === 2)
                tier = 2; // window degrades to tier 2 if ANY line needs it
        }
        if (tier !== 0)
            matches.push({ i, tier });
    }
    // Prefer exact-tier windows when any exist.
    const exact = matches.filter((m) => m.tier === 1);
    const chosen = exact.length > 0 ? exact : matches;
    const notFoundHint = ' — quote the text verbatim from a FRESH adt_read_object (the remote source may have changed), ' +
        'and include neighboring lines to disambiguate';
    if (chosen.length === 0) {
        const closest = suggestLines(lines, oldLines[0] ?? oldText);
        throw new Error(`adt_edit_object: oldText (${k} lines) not found in the ${lines.length}-line source` +
            (closest.length ? `; closest lines to its first line: ${closest.join(' | ')}` : '') +
            notFoundHint);
    }
    const pick = (offset) => spliceBlock(lines, chosen[offset].i, chosen[offset].i + k - 1, newText, nl, exact.length > 0 ? 'text' : 'text-loose', options.occurrence);
    if (chosen.length > 1) {
        const occurrence = options.occurrence;
        if (occurrence === undefined) {
            const candidates = chosen
                .map((m, n) => `#${n + 1} line ${m.i + 1}`)
                .join('; ');
            throw new Error(`adt_edit_object: oldText matches ${chosen.length} locations (${candidates}); ` +
                'include more surrounding lines in oldText to make it unique, pass `occurrence`, or use startLine/endLine');
        }
        if (occurrence < 1 || occurrence > chosen.length) {
            throw new Error(`adt_edit_object: occurrence ${occurrence} is out of range — oldText matches ` +
                `${chosen.length} locations (1..${chosen.length})`);
        }
        return pick(occurrence - 1);
    }
    return pick(0);
}
export function writeTools(deps, ctx) {
    const { registry, ledger } = deps;
    const writeObject = defineTool({
        name: 'adt_write_object',
        description: 'Replace the source code of an existing ABAP development object. Locks, updates and unlocks automatically; ' +
            'set `activate: true` to activate in the same call. Subject to the permission policy ' +
            '(allowedPackages / allowTransportableEdits / allowedTransports).',
        parameters: {
            ...OBJECT_REF_PARAMS,
            ...PACKAGE_HINT_PARAM,
            source: { type: 'string', description: 'Complete new source text of the object.' },
            sourceFile: {
                type: 'string',
                description: 'Alternative to `source`: absolute path of a local UTF-8 file uploaded verbatim ' +
                    '(sandbox-aware). Provide exactly one of source / sourceFile.',
            },
            unlock: { type: 'boolean', description: 'Unlock after writing (default true).' },
            activate: {
                type: 'boolean',
                description: 'Also activate the object after writing (default false). Activates ONLY the written object — a PROG main ' +
                    "program's includes (TOP/SCR/...) are NOT cascaded on most backends; call adt_activate with the main " +
                    'object AND its includes in one list for a full activation.',
            },
            transport: {
                type: 'string',
                description: 'Transport request number the change is recorded into, e.g. S4HK900001 (see adt_list_transports, ' +
                    'status=modifiable). When omitted the backend decides on lock — an object already in an open request ' +
                    'stays in it, otherwise the backend creates a NEW task/request. Pass `transport` to control that.',
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
                    updated: { type: 'boolean', required: true },
                    unlocked: { type: 'boolean' },
                    activated: { type: 'boolean' },
                    transport: {
                        type: 'string',
                        description: 'Transport request the change was recorded into (when transportable).',
                    },
                    transportSource: {
                        type: 'string',
                        enum: ['user', 'auto'],
                        description: 'user = the transport you passed; auto = backend-assigned on lock (it may be a NEW request).',
                    },
                    activation: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            success: { type: 'boolean' },
                            message: { type: 'string' },
                        },
                    },
                },
            },
            render: (_args, value) => text(`${value.name} (${value.uri}): source ${value.updated ? 'updated' : 'NOT updated'}` +
                `${value.unlocked === false ? ' (still locked)' : ''}` +
                `${value.activated ? ' · activated' : ''}` +
                (value.transport
                    ? ` · change recorded in transport ${value.transport}${value.transportSource === 'auto' ? ' (backend-assigned — pass transport to choose)' : ''}`
                    : '') +
                `${value.activation?.success === false ? ` · activation failed: ${value.activation.message ?? ''}` : ''}`),
        },
        execute: async (args, exec) => {
            const entry = registry.require(destinationOf(args));
            const ref = await resolveToolObject(entry.client, args, exec.signal);
            // Permission check: package whitelist + transportable-edit rule.
            await assertObjectEditable(entry, ref, {
                toolName: 'adt_write_object',
                packageHint: optStr(args.packageName),
                signal: exec.signal,
            });
            // An explicitly-passed transport must be policy-allowed up front; the
            // write (PUT ?corrNr=…) records the change into EXACTLY this request.
            const transport = optStr(args.transport);
            if (transport) {
                entry.policy.assertTransportsEnabled('adt_write_object');
                entry.policy.assertTransportAllowed(transport, `adt_write_object (${ref.name})`);
            }
            const unlock = args.unlock !== false;
            let unlocked = false;
            let activated = false;
            let activationResult;
            const { handle, transport: assignedTransport } = await entry.client.lock(ref.uri, { signal: exec.signal });
            // User-specified transport wins; otherwise the backend's lock-assigned
            // CORRNR applies (an object already in an open request stays there, a
            // fresh object gets a NEW auto-created task).
            const effectiveTransport = transport ?? assignedTransport;
            ledger.register({ destination: entry.config.name, uri: ref.uri, name: ref.name, handle, transport: effectiveTransport });
            try {
                // Whatever transport is finally used — user's or auto-assigned — must
                // be within allowedTransports, or the edit is rolled back.
                entry.policy.assertTransportUsage(effectiveTransport, `adt_write_object (${ref.name})`);
                const src = await resolveSourceInput(ctx, args);
                await entry.client.writeSource(ref.uri, src, { lockHandle: handle, transport: effectiveTransport ?? undefined, signal: exec.signal });
                if (args.activate === true) {
                    const act = await entry.client.activate([ref], { transport: effectiveTransport ?? undefined, signal: exec.signal });
                    activated = act.success;
                    activationResult = {
                        success: act.success,
                        message: act.items.map((i) => `${i.name}: ${i.status}${i.message ? ' ' + i.message : ''}`).join('; ') || undefined,
                    };
                }
                if (unlock) {
                    const released = await entry.client
                        .unlock(ref.uri, handle)
                        .then(() => true)
                        .catch(() => false);
                    if (released) {
                        // Only forget the ledger entry when the unlock actually happened;
                        // otherwise adt_unlock_all must still be able to retry.
                        ledger.deregister(entry.config.name, ref.uri);
                        unlocked = true;
                    }
                }
            }
            catch (error) {
                // Policy denial or write failure → always roll back the lock. Keep the
                // ledger entry when the rollback unlock fails so it stays retryable.
                await entry.client.unlock(ref.uri, handle).then(() => ledger.deregister(entry.config.name, ref.uri), () => undefined);
                unlocked = true;
                throw error;
            }
            const transportSource = effectiveTransport
                ? transport
                    ? 'user'
                    : 'auto'
                : undefined;
            return {
                uri: ref.uri,
                name: ref.name,
                updated: true,
                unlocked,
                activated: activated || undefined,
                transport: effectiveTransport,
                transportSource,
                activation: activationResult,
            };
        },
    });
    const editSource = defineTool({
        name: 'adt_edit_object',
        description: 'Replace part of an existing source object — DSH-`edit` style, without uploading the whole object: ' +
            'locks, patches the current server-side source, writes back, unlocks; optionally activates. ' +
            'TWO MODES — prefer (1) for precise edits, (2) for whole blocks: ' +
            '(1) oldText + newText (recommended): quote the exact text to replace VERBATIM from a recent ' +
            'adt_read_object (multi-line OK, tail comments tolerated) and give its replacement. Match runs ' +
            'against the CURRENT remote source — if someone changed it meanwhile, the match fails safely. ' +
            'Not unique → include neighboring lines in the quote (or `occurrence`); not found → the error ' +
            'lists the closest lines; one re-read + retry converges. ' +
            '(2) start/end block markers (whole METHOD/FORM/etc. without quoting it): bare closers ' +
            '(ENDFORM./ENDIF./…) resolve structurally by nesting depth; DUPLICATE lines take `occurrence`; ' +
            'by position use startLine/endLine. ' +
            'Provide the replacement via `newText` (mode 1) or `source`/`sourceFile` (mode 2). ' +
            'Subject to the permission policy.',
        parameters: {
            ...OBJECT_REF_PARAMS,
            ...PACKAGE_HINT_PARAM,
            oldText: {
                type: 'string',
                description: 'Mode 1 (DSH-edit style): the exact text to replace, quoted verbatim from a recent adt_read_object. ' +
                    'Multi-line quotes are matched per line (comment/case/indent tolerant); make it unique by including ' +
                    'neighboring lines.',
            },
            newText: {
                type: 'string',
                description: 'Mode 1: the replacement text (full replacement of oldText; empty string deletes it).',
            },
            start: {
                type: 'string',
                description: 'Mode 2: first line of the block to replace (e.g. "METHOD chat_audit." / "FORM frm_xxx.") — ' +
                    'copied verbatim from the current source works (tail comments tolerated).',
            },
            end: {
                type: 'string',
                description: 'Mode 2: last line of the block. A BARE closer (ENDFORM. / ENDIF. / ENDMETHOD. / END-OF-DEFINITION. …) ' +
                    'resolves structurally by nesting depth — recommended. Custom line text matches by tiers. Optional: ' +
                    'auto-derived for METHOD/FORM/FUNCTION/MODULE; defaults to the `start` line.',
            },
            occurrence: {
                type: 'integer',
                description: '1-based index among the matches (start marker or oldText), when the same text appears multiple ' +
                    'times (the ambiguity error lists them as #1, #2, … in file order).',
            },
            startLine: {
                type: 'integer',
                description: 'Position mode: 1-based line number of the block start (from adt_read_object output). Replaces ' +
                    'startLine..endLine directly; when `start` is also given it is verified against that line.',
            },
            endLine: {
                type: 'integer',
                description: 'Position mode: 1-based line number of the block end (defaults to startLine — single line).',
            },
            source: { type: 'string', description: 'Mode 2: replacement block text (the full new block, including its start/end lines).' },
            sourceFile: {
                type: 'string',
                description: 'Mode 2 alternative to `source`: absolute path of a local UTF-8 file holding the replacement block.',
            },
            activate: {
                type: 'boolean',
                description: 'Also activate the object after writing (default false). Activates ONLY the written object — a PROG main ' +
                    "program's includes (TOP/SCR/...) are NOT cascaded on most backends; call adt_activate with the main " +
                    'object AND its includes in one list for a full activation.',
            },
            transport: {
                type: 'string',
                description: 'Transport request number the change is recorded into, e.g. S4HK900001. When omitted the backend ' +
                    'decides on lock (an object already in an open request stays in it, otherwise a NEW task/request is ' +
                    'auto-created). Pass `transport` to control that.',
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
                    start: { type: 'string', required: true },
                    end: { type: 'string', required: true },
                    replaced: { type: 'boolean', required: true },
                    startLineNumber: { type: 'integer', required: true },
                    endLineNumber: { type: 'integer', required: true },
                    oldLines: { type: 'integer', required: true },
                    newLines: { type: 'integer', required: true },
                    matchMode: {
                        type: 'string',
                        required: true,
                        enum: ['structured', 'text', 'text-loose', 'text-raw', 'line-number'],
                        description: 'structured = ENDxxx resolved by nesting depth (safest); text = comment-stripped match; text-loose = spacing-tolerant; text-raw = matched comment text; line-number = position mode.',
                    },
                    occurrence: { type: 'integer', description: 'Which duplicate match was edited (when occurrence was used).' },
                    unlocked: { type: 'boolean' },
                    activated: { type: 'boolean' },
                    transport: {
                        type: 'string',
                        description: 'Transport request the change was recorded into (when transportable).',
                    },
                    transportSource: {
                        type: 'string',
                        enum: ['user', 'auto'],
                        description: 'user = the transport you passed; auto = backend-assigned on lock (it may be a NEW request).',
                    },
                    activation: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            success: { type: 'boolean' },
                            message: { type: 'string' },
                        },
                    },
                },
            },
            render: (_args, value) => text(`${value.name}: block [${value.start} … ${value.end}] (lines ${value.startLineNumber}..${value.endLineNumber}) ` +
                `replaced (${value.oldLines} → ${value.newLines} lines)` +
                `${value.unlocked === false ? ' (still locked)' : ''}` +
                `${value.activated ? ' · activated' : ''}` +
                (value.transport
                    ? ` · change recorded in transport ${value.transport}${value.transportSource === 'auto' ? ' (backend-assigned — pass transport to choose)' : ''}`
                    : '') +
                `${value.activation?.success === false ? ` · activation failed: ${value.activation.message ?? ''}` : ''}`),
        },
        execute: async (args, exec) => {
            const entry = registry.require(destinationOf(args));
            const ref = await resolveToolObject(entry.client, args, exec.signal);
            await assertObjectEditable(entry, ref, {
                toolName: 'adt_edit_object',
                packageHint: optStr(args.packageName),
                signal: exec.signal,
            });
            // ---- Mode validation: oldText (mode 1) vs start/startLine (mode 2). ----
            const oldText = typeof args.oldText === 'string' ? args.oldText : undefined;
            const startText = String(args.start ?? '').trim();
            const hasStartLine = args.startLine !== undefined && args.startLine !== null;
            if (oldText !== undefined) {
                if (startText || hasStartLine || args.end !== undefined || args.endLine !== undefined) {
                    throw new Error('adt_edit_object: `oldText` cannot be combined with `start`/`end`/`startLine`/`endLine` — ' +
                        'oldText+newText replaces the quoted text directly');
                }
                if (typeof args.newText !== 'string') {
                    throw new Error('adt_edit_object: `oldText` requires `newText` (the replacement; empty string deletes)');
                }
                if (args.source !== undefined || args.sourceFile !== undefined) {
                    throw new Error('adt_edit_object: `oldText` mode uses `newText`, not `source`/`sourceFile`');
                }
            }
            else if (!startText && !hasStartLine) {
                throw new Error('adt_edit_object: provide `oldText`+`newText` (quote-and-replace, preferred) or `start`/`startLine` (block mode)');
            }
            if (args.endLine !== undefined && !hasStartLine) {
                throw new Error('adt_edit_object: `endLine` requires `startLine` (position mode)');
            }
            const occurrence = args.occurrence !== undefined ? Number(args.occurrence) : undefined;
            if (occurrence !== undefined && (!Number.isInteger(occurrence) || occurrence < 1)) {
                throw new Error('adt_edit_object: `occurrence` must be a positive integer (1-based)');
            }
            // Mode 2 end resolution: explicit `end` > derived closer (METHOD/FORM/…)
            // > the start line itself (single-line replacement).
            const endText = String(args.end ?? '').trim() || defaultEndFor(startText) || startText;
            const replacement = oldText !== undefined ? args.newText : await resolveSourceInput(ctx, args);
            // Explicitly-passed transport: policy-check up front, then the write
            // (PUT ?corrNr=…) records the change into EXACTLY this request.
            const transport = optStr(args.transport);
            if (transport) {
                entry.policy.assertTransportsEnabled('adt_edit_object');
                entry.policy.assertTransportAllowed(transport, `adt_edit_object (${ref.name})`);
            }
            let unlocked = false;
            let activated = false;
            let activationResult;
            let replaced;
            const { handle, transport: assignedTransport } = await entry.client.lock(ref.uri, { signal: exec.signal });
            // User-specified transport wins over the lock-assigned CORRNR.
            const effectiveTransport = transport ?? assignedTransport;
            ledger.register({ destination: entry.config.name, uri: ref.uri, name: ref.name, handle, transport: effectiveTransport });
            try {
                entry.policy.assertTransportUsage(effectiveTransport, `adt_edit_object (${ref.name})`);
                const current = (await entry.client.readSource(ref.uri, { signal: exec.signal })).source;
                const replacementText = oldText !== undefined ? String(args.newText ?? '') : replacement;
                replaced =
                    oldText !== undefined
                        ? replaceSourceText(current, oldText, replacementText, { occurrence })
                        : replaceSourceBlock(current, startText, endText, replacementText, {
                            occurrence,
                            startLine: hasStartLine ? Number(args.startLine) : undefined,
                            endLine: args.endLine !== undefined ? Number(args.endLine) : undefined,
                        });
                await entry.client.writeSource(ref.uri, replaced.full, { lockHandle: handle, transport: effectiveTransport ?? undefined, signal: exec.signal });
                if (args.activate === true) {
                    const act = await entry.client.activate([ref], { transport: effectiveTransport ?? undefined, signal: exec.signal });
                    activated = act.success;
                    activationResult = {
                        success: act.success,
                        message: act.items.map((i) => `${i.name}: ${i.status}${i.message ? ' ' + i.message : ''}`).join('; ') || undefined,
                    };
                }
            }
            finally {
                const released = await entry.client
                    .unlock(ref.uri, handle)
                    .then(() => true)
                    .catch(() => false);
                if (released)
                    ledger.deregister(entry.config.name, ref.uri);
                unlocked = released;
            }
            const transportSource = effectiveTransport
                ? transport
                    ? 'user'
                    : 'auto'
                : undefined;
            // In oldText mode report the first/last quoted line as the block labels.
            const oldQuoteLines = oldText !== undefined ? oldText.replace(/\r\n/g, '\n').split('\n') : undefined;
            const startLabel = oldQuoteLines ? (oldQuoteLines[0] ?? '').trim() : startText;
            const endLabel = oldQuoteLines ? (oldQuoteLines[oldQuoteLines.length - 1] ?? '').trim() : endText;
            return {
                uri: ref.uri,
                name: ref.name,
                start: startLabel,
                end: endLabel,
                replaced: true,
                startLineNumber: replaced?.startLineNumber ?? 0,
                endLineNumber: replaced?.endLineNumber ?? 0,
                oldLines: replaced?.oldLines ?? 0,
                newLines: replaced?.newLines ?? 0,
                matchMode: replaced?.matchMode ?? 'text',
                occurrence: replaced?.occurrence,
                unlocked,
                activated: activated || undefined,
                transport: effectiveTransport,
                transportSource,
                activation: activationResult,
            };
        },
    });
    return [writeObject, editSource];
}
//# sourceMappingURL=write.js.map