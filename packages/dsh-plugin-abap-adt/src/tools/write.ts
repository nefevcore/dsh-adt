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
import type { Context } from '@deepseek-ai/cordis';
import {
  DESTINATION_PARAM,
  OBJECT_REF_PARAMS,
  PACKAGE_HINT_PARAM,
  assertObjectEditable,
  destinationOf,
  optStr,
  resolveToolObject,
  text,
  type ToolDeps,
} from './common.js';

/** Read a UTF-8 text file through the sandbox-aware DSH filesystem service. */
async function readSourceFile(ctx: Context, filePath: string): Promise<string> {
  const fs = ctx.fs;
  if (!fs) throw new Error('adt: the dsh filesystem service (ctx.fs) is required to read `sourceFile`');
  const target = await fs.resolve(filePath);
  return fs.readText(target);
}

/** Resolve the replacement source from args: `sourceFile` (local file, takes
 * precedence) or `source` (inline) — exactly one must be given. */
async function resolveSourceInput(ctx: Context, args: Record<string, unknown>): Promise<string> {
  const inline = typeof args.source === 'string' ? args.source : undefined;
  const file = optStr(args.sourceFile);
  if (inline !== undefined && file !== undefined) {
    throw new Error('adt: provide exactly one of `source` and `sourceFile`');
  }
  if (file !== undefined) return readSourceFile(ctx, file);
  if (inline !== undefined) return inline;
  throw new Error('adt: `source` or `sourceFile` is required');
}

/** Auto-derive the closing statement for common ABAP block openers. */
function defaultEndFor(startText: string): string | undefined {
  const s = startText.trim().toUpperCase();
  if (/^(?:METHOD|CLASS-METHOD)\b/.test(s)) return 'ENDMETHOD.';
  if (/^FORM\b/.test(s)) return 'ENDFORM.';
  if (/^FUNCTION\b/.test(s)) return 'ENDFUNCTION.';
  if (/^MODULE\b/.test(s)) return 'ENDMODULE.';
  return undefined;
}

/**
 * Strip ABAP comments from a line for marker matching: `*` at line start is a
 * full-line comment; `"` starts a tail comment unless it sits inside a
 * single-quoted string literal ('' is an escaped quote inside literals).
 */
export function stripAbapComment(line: string): string {
  if (line.trimStart().startsWith('*')) return '';
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === "'") inString = !inString;
    else if (ch === '"' && !inString) return line.slice(0, i);
  }
  return line;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Locate a block by start/end line markers in the source and replace it
 * wholesale; bytes outside the block are preserved. Line-ending style follows
 * the source file (CRLF/LF). Matching rules (DSH-`edit` semantics):
 *  - markers match case-insensitively as line substrings of the
 *    COMMENT-STRIPPED line, so `" METHOD x.` / `* METHOD x.` never match;
 *  - ambiguous markers (more than one candidate line) fail loudly with the
 *    candidate line numbers instead of silently picking the first.
 */
export function replaceSourceBlock(
  source: string,
  startText: string,
  endText: string,
  replacement: string,
): { full: string; oldLines: number; newLines: number; startLineNumber: number; endLineNumber: number } {
  const nl = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r\n|\n/);
  const startKey = norm(startText);
  const endKey = norm(endText);
  if (!startKey || !endKey) throw new Error('adt_edit_object: start/end must not be empty');

  const startHits: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (norm(stripAbapComment(lines[i] ?? '')).includes(startKey)) startHits.push(i);
  }
  if (startHits.length === 0) throw new Error(`adt_edit_object: start line "${startText}" not found`);
  if (startHits.length > 1) {
    const candidates = startHits.map((i) => `line ${i + 1}: ${(lines[i] ?? '').trim()}`).join('; ');
    throw new Error(
      `adt_edit_object: start marker "${startText}" is ambiguous (${startHits.length} matches: ${candidates}); ` +
        'make the marker more specific (e.g. the full "METHOD name." line)',
    );
  }
  const startIdx = startHits[0]!;

  const endHits: number[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (norm(stripAbapComment(lines[i] ?? '')).includes(endKey)) endHits.push(i);
  }
  if (endHits.length === 0) {
    throw new Error(`adt_edit_object: end line "${endText}" not found after "${startText}"`);
  }
  if (endHits.length > 1) {
    const candidates = endHits.map((i) => `line ${i + 1}: ${(lines[i] ?? '').trim()}`).join('; ');
    throw new Error(
      `adt_edit_object: end marker "${endText}" is ambiguous (${endHits.length} matches after the start: ${candidates}); ` +
        'provide a more specific `end` marker',
    );
  }
  const endIdx = endHits[0]!;

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
  };
}

export function writeTools(deps: ToolDeps, ctx: Context) {
  const { registry, ledger } = deps;

  const writeObject = defineTool({
    name: 'adt_write_object',
    description:
      'Replace the source code of an existing ABAP development object. Locks, updates and unlocks automatically; ' +
      'set `activate: true` to activate in the same call. Subject to the permission policy ' +
      '(allowedPackages / allowTransportableEdits / allowedTransports).',
    parameters: {
      ...OBJECT_REF_PARAMS,
      ...PACKAGE_HINT_PARAM,
      source: { type: 'string', description: 'Complete new source text of the object.' },
      sourceFile: {
        type: 'string',
        description:
          'Alternative to `source`: absolute path of a local UTF-8 file uploaded verbatim ' +
          '(sandbox-aware). Provide exactly one of source / sourceFile.',
      },
      unlock: { type: 'boolean', description: 'Unlock after writing (default true).' },
      activate: {
        type: 'boolean',
        description:
          'Also activate the object after writing (default false). Activates ONLY the written object — a PROG main ' +
          "program's includes (TOP/SCR/...) are NOT cascaded on most backends; call adt_activate with the main " +
          'object AND its includes in one list for a full activation.',
      },
      transport: {
        type: 'string',
        description:
          'Transport request number the change is recorded into, e.g. S4HK900001 (see adt_list_transports, ' +
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
      render: (_args, value) =>
        text(
          `${value.name} (${value.uri}): source ${value.updated ? 'updated' : 'NOT updated'}` +
            `${value.unlocked === false ? ' (still locked)' : ''}` +
            `${value.activated ? ' · activated' : ''}` +
            (value.transport
              ? ` · change recorded in transport ${value.transport}${value.transportSource === 'auto' ? ' (backend-assigned — pass transport to choose)' : ''}`
              : '') +
            `${value.activation?.success === false ? ` · activation failed: ${value.activation.message ?? ''}` : ''}`,
        ),
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
      let activationResult: { success: boolean; message?: string } | undefined;
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
      } catch (error) {
        // Policy denial or write failure → always roll back the lock. Keep the
        // ledger entry when the rollback unlock fails so it stays retryable.
        await entry.client.unlock(ref.uri, handle).then(
          () => ledger.deregister(entry.config.name, ref.uri),
          () => undefined,
        );
        unlocked = true;
        throw error;
      }
      const transportSource: 'user' | 'auto' | undefined = effectiveTransport
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
    description:
      'Replace ONE code block of an existing source object (class method, FORM, function module, MODULE, include, ' +
      'or any marker-delimited block) without uploading the whole object: locks the object, reads the current ' +
      'source, replaces only the block between the `start` and `end` line markers, writes the full source back ' +
      'and unlocks; optionally activates. Matching follows DSH-`edit` semantics: markers are compared against ' +
      'comment-stripped lines (case-insensitive substring) and an AMBIGUOUS marker fails with the candidate ' +
      'lines listed — never a silent first-match. `end` auto-derives for METHOD/FORM/FUNCTION/MODULE blocks. ' +
      'Provide the replacement block via `source` or `sourceFile`. Subject to the permission policy.',
    parameters: {
      ...OBJECT_REF_PARAMS,
      ...PACKAGE_HINT_PARAM,
      start: {
        type: 'string',
        required: true,
        description: 'First line of the block to replace, e.g. "METHOD chat_audit." / "FORM frm_xxx.".',
      },
      end: {
        type: 'string',
        description:
          'Last line of the block, e.g. "ENDMETHOD.". Optional: auto-derived from the block type.',
      },
      source: { type: 'string', description: 'Replacement block text (the full new block, including its start/end lines).' },
      sourceFile: {
        type: 'string',
        description: 'Alternative to `source`: absolute path of a local UTF-8 file holding the replacement block.',
      },
      activate: {
        type: 'boolean',
        description:
          'Also activate the object after writing (default false). Activates ONLY the written object — a PROG main ' +
          "program's includes (TOP/SCR/...) are NOT cascaded on most backends; call adt_activate with the main " +
          'object AND its includes in one list for a full activation.',
      },
      transport: {
        type: 'string',
        description:
          'Transport request number the change is recorded into, e.g. S4HK900001. When omitted the backend ' +
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
      render: (_args, value) =>
        text(
          `${value.name}: block [${value.start} … ${value.end}] (lines ${value.startLineNumber}..${value.endLineNumber}) ` +
            `replaced (${value.oldLines} → ${value.newLines} lines)` +
            `${value.unlocked === false ? ' (still locked)' : ''}` +
            `${value.activated ? ' · activated' : ''}` +
            (value.transport
              ? ` · change recorded in transport ${value.transport}${value.transportSource === 'auto' ? ' (backend-assigned — pass transport to choose)' : ''}`
              : '') +
            `${value.activation?.success === false ? ` · activation failed: ${value.activation.message ?? ''}` : ''}`,
        ),
    },
    execute: async (args, exec) => {
      const entry = registry.require(destinationOf(args));
      const ref = await resolveToolObject(entry.client, args, exec.signal);
      await assertObjectEditable(entry, ref, {
        toolName: 'adt_edit_object',
        packageHint: optStr(args.packageName),
        signal: exec.signal,
      });

      const startText = String(args.start ?? '').trim();
      if (!startText) throw new Error('adt_edit_object: `start` is required');
      const endText = String(args.end ?? '').trim() || defaultEndFor(startText) || '';
      if (!endText) {
        throw new Error(
          `adt_edit_object: cannot auto-derive the end line for "${startText}" — provide \`end\` explicitly`,
        );
      }
      const replacement = await resolveSourceInput(ctx, args);

      // Explicitly-passed transport: policy-check up front, then the write
      // (PUT ?corrNr=…) records the change into EXACTLY this request.
      const transport = optStr(args.transport);
      if (transport) {
        entry.policy.assertTransportsEnabled('adt_edit_object');
        entry.policy.assertTransportAllowed(transport, `adt_edit_object (${ref.name})`);
      }

      let unlocked = false;
      let activated = false;
      let activationResult: { success: boolean; message?: string } | undefined;
      let replaced: { full: string; oldLines: number; newLines: number; startLineNumber: number; endLineNumber: number } | undefined;
      const { handle, transport: assignedTransport } = await entry.client.lock(ref.uri, { signal: exec.signal });
      // User-specified transport wins over the lock-assigned CORRNR.
      const effectiveTransport = transport ?? assignedTransport;
      ledger.register({ destination: entry.config.name, uri: ref.uri, name: ref.name, handle, transport: effectiveTransport });
      try {
        entry.policy.assertTransportUsage(effectiveTransport, `adt_edit_object (${ref.name})`);
        const current = (await entry.client.readSource(ref.uri, { signal: exec.signal })).source;
        replaced = replaceSourceBlock(current, startText, endText, replacement);
        await entry.client.writeSource(ref.uri, replaced.full, { lockHandle: handle, transport: effectiveTransport ?? undefined, signal: exec.signal });
        if (args.activate === true) {
          const act = await entry.client.activate([ref], { transport: effectiveTransport ?? undefined, signal: exec.signal });
          activated = act.success;
          activationResult = {
            success: act.success,
            message: act.items.map((i) => `${i.name}: ${i.status}${i.message ? ' ' + i.message : ''}`).join('; ') || undefined,
          };
        }
      } finally {
        const released = await entry.client
          .unlock(ref.uri, handle)
          .then(() => true)
          .catch(() => false);
        if (released) ledger.deregister(entry.config.name, ref.uri);
        unlocked = released;
      }
      const transportSource: 'user' | 'auto' | undefined = effectiveTransport
        ? transport
          ? 'user'
          : 'auto'
        : undefined;
      return {
        uri: ref.uri,
        name: ref.name,
        start: startText,
        end: endText,
        replaced: true,
        startLineNumber: replaced?.startLineNumber ?? 0,
        endLineNumber: replaced?.endLineNumber ?? 0,
        oldLines: replaced?.oldLines ?? 0,
        newLines: replaced?.newLines ?? 0,
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
