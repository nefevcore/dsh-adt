import { defineTool } from '@deepseek-ai/dsh-tools';
import { AdtError } from '@nefevcore/abap-adt-protocol';
import { DESTINATION_PARAM, destinationOf, text } from './common.js';
import { resolveObject, resolvePackageName, refFromName, typeLabel } from '../resolve.js';
import { AdtPolicyError } from '../policy.js';
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
export function sourceTools(deps, ctx) {
    const { registry, policy, ledger } = deps;
    /** True when the backend answers GET on the object URI (object exists). */
    async function objectExists(client, uri) {
        try {
            await client.readSource(uri);
            return true;
        }
        catch {
            return false;
        }
    }
    /** Read a UTF-8 text file through the sandbox-aware DSH filesystem service. */
    async function readSourceFile(filePath) {
        const fs = ctx.fs;
        if (!fs)
            throw new Error('adt: 需要 dsh filesystem 服务(ctx.fs)来读取本地文件');
        const target = await fs.resolve(filePath);
        return fs.readText(target);
    }
    /** 从 args 解析源码：sourceFile(优先, 读本地文件) 或 source(内联)，二者必须提供其一。 */
    async function resolveSourceInput(args) {
        const inline = typeof args.source === 'string' ? args.source : undefined;
        const file = typeof args.sourceFile === 'string' && args.sourceFile ? args.sourceFile : undefined;
        if (inline !== undefined && file !== undefined) {
            throw new Error('adt: `source` 与 `sourceFile` 只能提供其一');
        }
        if (file !== undefined)
            return readSourceFile(file);
        if (inline !== undefined)
            return inline;
        throw new Error('adt: 必须提供 `source` 或 `sourceFile`');
    }
    /**
     * 在源码中按 起始行/结束行 定位一个代码块并整体替换，块外字节保持不动；
     * 行尾风格跟随源文件（CRLF/LF）。end 缺省时按 ABAP 块类型自动推导。
     */
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
    function replaceSourceBlock(source, startText, endText, replacement) {
        const nl = source.includes('\r\n') ? '\r\n' : '\n';
        const lines = source.split(/\r\n|\n/);
        const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');
        const startKey = norm(startText);
        const endKey = norm(endText);
        if (!startKey || !endKey)
            throw new Error('adt_edit_object: start/end 不能为空');
        let startIdx = -1;
        for (let i = 0; i < lines.length; i++) {
            if (norm(lines[i] ?? '').includes(startKey)) {
                startIdx = i;
                break;
            }
        }
        if (startIdx < 0)
            throw new Error(`adt_edit_object: 未找到起始行 "${startText}"`);
        let endIdx = -1;
        for (let i = startIdx + 1; i < lines.length; i++) {
            if (norm(lines[i] ?? '').includes(endKey)) {
                endIdx = i;
                break;
            }
        }
        if (endIdx < 0)
            throw new Error(`adt_edit_object: 在 "${startText}" 之后未找到结束行 "${endText}"`);
        const block = replacement.replace(/\r\n/g, '\n').replace(/\n/g, nl);
        const before = lines.slice(0, startIdx);
        const after = lines.slice(endIdx + 1);
        const prefix = before.length ? before.join(nl) + nl : '';
        const suffix = after.length ? nl + after.join(nl) : '';
        return {
            full: prefix + block + suffix,
            oldLines: endIdx - startIdx + 1,
            newLines: block.split(/\r\n|\n/).length,
        };
    }
    const readObject = defineTool({
        name: 'adt_read_object',
        description: 'Read the source code and metadata of an ABAP development object (class, interface, program, CDS view, ...). ' +
            'Pass `objectUri` (from search results) or `name` + optional `type` ("CLAS", "INTF", "PROG", "DDLS", "TABL", ...).',
        parameters: {
            objectUri: { type: 'string', description: 'Exact ADT object URI, e.g. /sap/bc/adt/oo/classes/zcl_demo.' },
            name: { type: 'string', description: 'Object name, e.g. ZCL_DEMO.' },
            type: { type: 'string', description: 'Object type (short or ADT form), e.g. CLAS, INTF, PROG, DDLS.' },
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
                },
            },
            render: (_args, value) => text([
                `${value.name} (${typeLabel(value.type)}) — ${value.uri}`,
                value.description ? `Description: ${value.description}` : '',
                '',
                '```abap',
                value.source,
                '```',
            ]
                .filter((l) => l !== '')
                .join('\n')),
            presentationMeta: (_args, value) => readPresentationMeta(value),
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
            const ref = await resolveObject(entry.client, {
                objectUri: typeof args.objectUri === 'string' ? args.objectUri : undefined,
                name: typeof args.name === 'string' ? args.name : undefined,
                type: typeof args.type === 'string' ? args.type : undefined,
            }, 10, exec.signal);
            const parsed = await entry.client.readSource(ref.uri, { signal: exec.signal });
            const properties = {};
            for (const p of parsed.properties)
                properties[p.key] = p.value;
            const description = properties['description'] ?? '';
            return {
                uri: ref.uri,
                name: ref.name,
                type: ref.type,
                source: parsed.source,
                description: description || undefined,
                properties,
            };
        },
    });
    const writeObject = defineTool({
        name: 'adt_write_object',
        description: 'Replace the source code of an existing ABAP development object. ' +
            'The object is locked, updated and unlocked automatically. ' +
            'Use after adt_read_object to edit; call adt_activate afterwards to activate the change. ' +
            'Subject to the plugin permission policy (allowedPackages / allowTransportableEdits / allowedTransports).',
        parameters: {
            objectUri: { type: 'string', description: 'Exact ADT object URI (recommended, from search/read).' },
            name: { type: 'string', description: 'Object name (used with type when no objectUri).' },
            type: { type: 'string', description: 'Object type, e.g. CLAS, INTF, PROG, DDLS.' },
            packageName: {
                type: 'string',
                description: 'Optional package of the object (e.g. ZPACK_DEMO, $TMP); used for the permission check when the backend does not expose it.',
            },
            source: { type: 'string', description: 'Complete new source text of the object.' },
            sourceFile: {
                type: 'string',
                description: 'Alternative to `source`: absolute path of a local UTF-8 file whose content is uploaded verbatim ' +
                    '(read through the sandbox-aware filesystem). Provide exactly one of source / sourceFile.',
            },
            unlock: { type: 'boolean', description: 'Unlock after writing (default true).' },
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
                },
            },
            render: (_args, value) => text(`${value.name} (${value.uri}): source ${value.updated ? 'updated' : 'NOT updated'}${value.unlocked === false ? ' (still locked)' : ''}`),
        },
        execute: async (args, exec) => {
            const entry = registry.require(destinationOf(args));
            const ref = await resolveObject(entry.client, {
                objectUri: typeof args.objectUri === 'string' ? args.objectUri : undefined,
                name: typeof args.name === 'string' ? args.name : undefined,
                type: typeof args.type === 'string' ? args.type : undefined,
            }, 10, exec.signal);
            // Permission check: package whitelist + transportable-edit rule.
            const packageName = await resolvePackageName(entry.client, ref, typeof args.packageName === 'string' ? args.packageName : undefined, exec.signal);
            if (!packageName) {
                throw new AdtPolicyError('allowedPackages', `adt_write_object: cannot determine the package of ${ref.name} for the permission check; ` +
                    'pass `packageName` explicitly or read the object first');
            }
            policy.assertEditAllowed(packageName, 'adt_write_object');
            const unlock = args.unlock !== false;
            let unlocked = false;
            const { handle, transport: assignedTransport } = await entry.client.lock(ref.uri, { signal: exec.signal });
            ledger.register({ destination: entry.config.name, uri: ref.uri, name: ref.name, handle, transport: assignedTransport });
            try {
                // The backend may auto-assign a transport request on lock (CORRNR);
                // it must be within allowedTransports or the edit is rolled back.
                policy.assertTransportUsage(assignedTransport, `adt_write_object (${ref.name})`);
                const src = await resolveSourceInput(args);
                await entry.client.writeSource(ref.uri, src, { lockHandle: handle, transport: assignedTransport ?? undefined, signal: exec.signal });
                if (unlock) {
                    await entry.client.unlock(ref.uri, handle).catch(() => undefined);
                    ledger.deregister(entry.config.name, ref.uri);
                    unlocked = true;
                }
            }
            catch (error) {
                // Policy denial or write failure → always roll back the lock.
                await entry.client.unlock(ref.uri, handle).catch(() => undefined);
                ledger.deregister(entry.config.name, ref.uri);
                unlocked = true;
                throw error;
            }
            return { uri: ref.uri, name: ref.name, updated: true, unlocked };
        },
    });
    const editSource = defineTool({
        name: 'adt_edit_object',
        description: 'Replace ONE code block of an existing source object (class method, program FORM, function module, MODULE, ' +
            'include, or any marker-delimited block) without uploading the whole object. ' +
            'The tool locks the object, reads its current source, replaces only the block between `start` and `end` lines, ' +
            'writes the full source back (transport/versioning still record the object; the change is confined to that block), ' +
            'and optionally activates it. `end` defaults to the matching closing statement for METHOD/ENDMETHOD, FORM/ENDFORM, ' +
            'FUNCTION/ENDFUNCTION, MODULE/ENDMODULE. Provide the replacement block via `source` or a local file via `sourceFile`. ' +
            'Subject to the plugin permission policy.',
        parameters: {
            objectUri: { type: 'string', description: 'Exact ADT object URI (recommended, from search/read).' },
            name: { type: 'string', description: 'Object name (used with type when no objectUri).' },
            type: { type: 'string', description: 'Object type, e.g. CLAS, INTF, PROG, FUGR, DDLS.' },
            packageName: {
                type: 'string',
                description: 'Optional package of the object; used for the permission check when the backend does not expose it.',
            },
            start: {
                type: 'string',
                required: true,
                description: 'First line of the block to replace, e.g. "METHOD chat_audit." / "FORM frm_xxx." / "FUNCTION zfm_yyy". ' +
                    'Matched case-insensitively as a line substring.',
            },
            end: {
                type: 'string',
                description: 'Last line of the block, e.g. "ENDMETHOD." / "ENDFORM.". Optional: auto-derived from the block type ' +
                    '(METHOD→ENDMETHOD., FORM→ENDFORM., FUNCTION→ENDFUNCTION., MODULE→ENDMODULE.).',
            },
            source: { type: 'string', description: 'Replacement block text (the full new block, including its start/end lines).' },
            sourceFile: {
                type: 'string',
                description: 'Alternative to `source`: absolute path of a local UTF-8 file holding the replacement block. ' +
                    'Provide exactly one of source / sourceFile.',
            },
            activate: { type: 'boolean', description: 'Also activate the object after writing (default false).' },
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
                    oldLines: { type: 'integer', required: true },
                    newLines: { type: 'integer', required: true },
                    unlocked: { type: 'boolean' },
                    activated: { type: 'boolean' },
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
            render: (_args, value) => text(`${value.name}: block [${value.start} … ${value.end}] replaced (${value.oldLines} → ${value.newLines} lines)` +
                `${value.unlocked === false ? ' (still locked)' : ''}` +
                `${value.activated ? ' · activated' : ''}` +
                `${value.activation?.success === false ? ` · activation failed: ${value.activation.message ?? ''}` : ''}`),
        },
        execute: async (args, exec) => {
            const entry = registry.require(destinationOf(args));
            const ref = await resolveObject(entry.client, {
                objectUri: typeof args.objectUri === 'string' ? args.objectUri : undefined,
                name: typeof args.name === 'string' ? args.name : undefined,
                type: typeof args.type === 'string' ? args.type : undefined,
            }, 10, exec.signal);
            const packageName = await resolvePackageName(entry.client, ref, typeof args.packageName === 'string' ? args.packageName : undefined, exec.signal);
            if (!packageName) {
                throw new AdtPolicyError('allowedPackages', `adt_edit_object: cannot determine the package of ${ref.name} for the permission check; ` +
                    'pass `packageName` explicitly or read the object first');
            }
            policy.assertEditAllowed(packageName, 'adt_edit_object');
            const startText = String(args.start ?? '').trim();
            if (!startText)
                throw new Error('adt_edit_object: `start` 必填');
            const endText = String(args.end ?? '').trim() || defaultEndFor(startText) || '';
            if (!endText)
                throw new Error(`adt_edit_object: 无法自动推导结束行，请显式提供 \`end\`（起始行: ${startText}）`);
            const replacement = await resolveSourceInput(args);
            let unlocked = false;
            let activated = false;
            let activationResult;
            let replaced;
            const { handle, transport: assignedTransport } = await entry.client.lock(ref.uri, { signal: exec.signal });
            ledger.register({ destination: entry.config.name, uri: ref.uri, name: ref.name, handle, transport: assignedTransport });
            try {
                policy.assertTransportUsage(assignedTransport, `adt_edit_object (${ref.name})`);
                const current = (await entry.client.readSource(ref.uri, { signal: exec.signal })).source;
                replaced = replaceSourceBlock(current, startText, endText, replacement);
                await entry.client.writeSource(ref.uri, replaced.full, { lockHandle: handle, transport: assignedTransport ?? undefined, signal: exec.signal });
                if (args.activate === true) {
                    const act = await entry.client.activate([ref], { transport: assignedTransport ?? undefined, signal: exec.signal });
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
                unlocked = true;
            }
            return {
                uri: ref.uri,
                name: ref.name,
                start: startText,
                end: endText,
                replaced: true,
                oldLines: replaced?.oldLines ?? 0,
                newLines: replaced?.newLines ?? 0,
                unlocked,
                activated: activated || undefined,
                activation: activationResult,
            };
        },
    });
    const createObject = defineTool({
        name: 'adt_create_object',
        description: 'Create a new ABAP development object on the SAP system: class (CLAS), interface (INTF), program (PROG), ' +
            'CDS view (DDLS), table (TABL), structure (STRU), message class (MSAG), function group (FUNC) or package (DEVC). ' +
            'Use package "$TMP" for local objects without transports.',
        parameters: {
            type: {
                type: 'string',
                required: true,
                enum: ['CLAS', 'INTF', 'PROG', 'DDLS', 'TABL', 'STRU', 'MSAG', 'FUNC', 'DEVC'],
                description: 'Object type to create.',
            },
            name: { type: 'string', required: true, description: 'Object name, e.g. ZCL_MY_CLASS.' },
            description: { type: 'string', required: true, description: 'Short description of the object.' },
            packageName: {
                type: 'string',
                required: true,
                description: 'Development package; use $TMP for local objects.',
            },
            transport: { type: 'string', description: 'Transport request number when the package requires one.' },
            ...DESTINATION_PARAM,
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    success: { type: 'boolean', required: true },
                    uri: { type: 'string', required: true },
                    name: { type: 'string' },
                    type: { type: 'string' },
                    messages: {
                        type: 'array',
                        required: true,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                severity: { type: 'string', required: true },
                                text: { type: 'string', required: true },
                            },
                        },
                    },
                },
            },
            render: (_args, value) => text([
                `${value.success ? 'Created' : 'FAILED to create'} ${value.type ?? ''} ${value.name ?? ''} — ${value.uri}`,
                ...value.messages.map((m) => `  ${m.severity}: ${m.text}`),
            ].join('\n')),
        },
        execute: async (args, exec) => {
            const entry = registry.require(destinationOf(args));
            const packageName = String(args.packageName ?? '$TMP').toUpperCase();
            // Permission check: package whitelist + transportable-edit rule.
            policy.assertEditAllowed(packageName, 'adt_create_object');
            if (typeof args.transport === 'string' && args.transport.trim().length > 0) {
                policy.assertTransportsEnabled('adt_create_object');
                policy.assertTransportAllowed(args.transport.trim(), 'adt_create_object');
            }
            const result = await (async () => {
                try {
                    return await entry.client.createObject({
                        destination: entry.config.name,
                        type: String(args.type),
                        name: String(args.name),
                        description: String(args.description ?? ''),
                        packageName,
                        transport: typeof args.transport === 'string' ? args.transport : undefined,
                    }, { signal: exec.signal });
                }
                catch (error) {
                    // Minimal ADT profiles (e.g. impc-dev) may CREATE the object but
                    // answer the create call with an error page (HTTP 500 after
                    // auto-assigning a transport request / lock). Detect that and report
                    // success-with-warning instead of a confusing failure.
                    if (error instanceof AdtError && error.status === 500) {
                        const probe = refFromName(String(args.name), String(args.type));
                        if (probe.uri && (await objectExists(entry.client, probe.uri))) {
                            return {
                                success: true,
                                uri: probe.uri,
                                object: probe,
                                messages: [
                                    {
                                        severity: 'W',
                                        text: `backend answered HTTP 500 but the object exists — created (check the auto-generated transport request if any)`,
                                    },
                                ],
                            };
                        }
                    }
                    throw error;
                }
            })();
            // Some backends auto-lock an object right after creation (and assign a
            // generated transport request) without returning a lock handle. Leaving
            // that lock behind blocks later edits (HTTP 403 EU510) until SM12. So:
            //   1. try to LOCK ourselves — if it succeeds the object was free and we
            //      immediately release OUR handle (clean state);
            //   2. if the backend already holds the lock, try a handle-less UNLOCK;
            //   3. if that is also rejected, remember the object in the lock ledger
            //      so `adt_unlock_all` can retry later.
            if (result.success && result.uri) {
                const destination = entry.config.name;
                let lockResult;
                try {
                    lockResult = await entry.client.lock(result.uri);
                }
                catch {
                    // already locked (403) or lock unsupported → handle-less attempt below
                }
                if (lockResult) {
                    try {
                        await entry.client.unlock(result.uri, lockResult.handle);
                    }
                    catch {
                        ledger.register({ destination, uri: result.uri, name: result.object?.name ?? String(args.name), handle: lockResult.handle, note: 'create post-check lock' });
                    }
                }
                else {
                    const released = await entry.client.unlockBestEffort(result.uri);
                    if (!released.released) {
                        ledger.register({
                            destination,
                            uri: result.uri,
                            name: result.object?.name ?? String(args.name),
                            note: 'create auto-lock (no handle returned by backend)',
                        });
                    }
                }
            }
            return {
                success: result.success,
                uri: result.uri ?? '',
                name: result.object?.name ?? String(args.name),
                type: result.object?.type ?? String(args.type),
                messages: result.messages.map((m) => ({ severity: m.severity, text: m.text })),
            };
        },
    });
    const deleteObject = defineTool({
        name: 'adt_delete_object',
        description: 'Delete an ABAP development object from the system (modern deletion service, legacy _action fallback). ' +
            'Irreversible — prefer deactivation or transport-based removal when unsure. ' +
            'Subject to the plugin permission policy (allowedPackages / allowTransportableEdits).',
        parameters: {
            objectUri: { type: 'string', description: 'Exact ADT object URI.' },
            name: { type: 'string', description: 'Object name (with type).' },
            type: { type: 'string', description: 'Object type.' },
            packageName: {
                type: 'string',
                description: 'Optional package of the object; used for the permission check when the backend does not expose it.',
            },
            ...DESTINATION_PARAM,
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    uri: { type: 'string', required: true },
                    deleted: { type: 'boolean', required: true },
                },
            },
            render: (_args, value) => text(`${value.uri}: ${value.deleted ? 'deleted' : 'NOT deleted'}`),
        },
        execute: async (args, exec) => {
            const entry = registry.require(destinationOf(args));
            const ref = await resolveObject(entry.client, {
                objectUri: typeof args.objectUri === 'string' ? args.objectUri : undefined,
                name: typeof args.name === 'string' ? args.name : undefined,
                type: typeof args.type === 'string' ? args.type : undefined,
            }, 10, exec.signal);
            const packageName = await resolvePackageName(entry.client, ref, typeof args.packageName === 'string' ? args.packageName : undefined, exec.signal);
            if (!packageName) {
                throw new AdtPolicyError('allowedPackages', `adt_delete_object: cannot determine the package of ${ref.name} for the permission check; ` +
                    'pass `packageName` explicitly');
            }
            policy.assertEditAllowed(packageName, 'adt_delete_object');
            await entry.client.deleteObject(ref.uri, { signal: exec.signal });
            // The object (and any lock on it) is gone — drop the ledger entry.
            ledger.deregister(entry.config.name, ref.uri);
            return { uri: ref.uri, deleted: true };
        },
    });
    return [readObject, writeObject, editSource, createObject, deleteObject];
}
//# sourceMappingURL=source.js.map