"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtMessageClassMessage = void 0;
const criticalSection_1 = require("../../utils/criticalSection");
const interfaces_1 = require("@mcp-abap-adt/interfaces");
const contentTypes_1 = require("../../constants/contentTypes");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const unsupported_1 = require("../shared/unsupported");
const lock_1 = require("./lock");
const read_1 = require("./read");
const unlock_1 = require("./unlock");
const xml_1 = require("./xml");
const BASE = '/sap/bc/adt/messageclass';
class AdtMessageClassMessage {
    connection;
    logger;
    objectType = 'MessageClassMessage';
    constructor(connection, logger) {
        this.connection = connection;
        this.logger = logger;
    }
    // ── read ──────────────────────────────────────────────────────────────────
    /**
     * Read a single message from the parent class.
     * Returns undefined when the parent class itself is absent (404).
     * Throws OBJECT_NOT_FOUND when the class exists but the message number is absent.
     */
    async read(config) {
        if (!config.className)
            throw new Error('className is required');
        if (!config.msgno)
            throw new Error('msgno is required');
        const no = String(config.msgno);
        try {
            const response = await (0, read_1.getMessageClassSource)(this.connection, config.className);
            const cls = (0, xml_1.parseMessageClass)(String(response.data));
            const message = cls.messages.find((m) => m.msgno === no);
            if (!message) {
                const e = new interfaces_1.AdtOperationError(`Message ${no} not found in class ${config.className}`);
                e.code = interfaces_1.AdtObjectErrorCodes.OBJECT_NOT_FOUND;
                throw e;
            }
            return { message, errors: [] };
        }
        catch (error) {
            const e = error;
            if (e.response?.status === 404) {
                return undefined;
            }
            throw error;
        }
    }
    // ── create / update (upsert) ───────────────────────────────────────────────
    /**
     * Create or upsert a single message in the parent class.
     * Delegates to the update logic.
     */
    async create(config, _options) {
        return this._upsertMessage(config);
    }
    /**
     * Update (upsert) a single message in the parent class.
     * Full chain: GET class → merge message → stateful → LOCK_MSG + class LOCK →
     * PUT class XML → unlock class → unlockAllMessages → stateless.
     */
    async update(config, _options) {
        return this._upsertMessage(config);
    }
    async _upsertMessage(config) {
        if (!config.className)
            throw new Error('className is required');
        if (!config.msgno)
            throw new Error('msgno is required');
        const name = config.className;
        const no = String(config.msgno);
        // 1. Read current class state to preserve all messages
        const response = await (0, read_1.getMessageClassSource)(this.connection, name);
        const cls = (0, xml_1.parseMessageClass)(String(response.data));
        // 2. Merge/set the message in the messages array
        const existingIdx = cls.messages.findIndex((m) => m.msgno === no);
        if (existingIdx >= 0) {
            // Update existing message — only override fields when explicitly provided in config
            cls.messages[existingIdx] = {
                ...cls.messages[existingIdx],
                ...(config.msgtext !== undefined ? { msgtext: config.msgtext } : {}),
                ...(config.selfExplanatory !== undefined
                    ? { selfExplanatory: config.selfExplanatory }
                    : {}),
                ...(config.description !== undefined
                    ? { description: config.description }
                    : {}),
            };
        }
        else {
            // Add new message with all authorable fields
            cls.messages.push({
                msgno: no,
                msgtext: config.msgtext ?? '',
                ...(config.selfExplanatory !== undefined
                    ? { selfExplanatory: config.selfExplanatory }
                    : {}),
                ...(config.description !== undefined
                    ? { description: config.description }
                    : {}),
            });
        }
        let messageLockHandle;
        let classLockHandle;
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            this.logger?.info?.('upsertMessage: stateful');
            this.connection.setSessionType('stateful');
            // 3. Lock individual message
            this.logger?.info?.('upsertMessage: lockMessage');
            messageLockHandle = await (0, lock_1.lockMessage)(this.connection, name, no);
            // 4. Lock class for message save
            this.logger?.info?.('upsertMessage: lockClassForMessage');
            classLockHandle = await (0, lock_1.lockClassForMessage)(this.connection, name, no);
            // 5. PUT full class XML with message lock handle embedded
            this.logger?.info?.('upsertMessage: PUT');
            const xmlBody = (0, xml_1.buildMessageClassXml)(cls, {
                messageLockHandles: { [no]: messageLockHandle },
            });
            const encoded = (0, internalUtils_1.encodeSapObjectName)(name.toLowerCase());
            const corrNr = config.transportRequest?.trim()
                ? `&corrNr=${encodeURIComponent(config.transportRequest)}`
                : '';
            const updateResult = await this.connection.makeAdtRequest({
                url: `${BASE}/${encoded}?lockHandle=${encodeURIComponent(classLockHandle)}${corrNr}`,
                method: 'PUT',
                timeout: (0, timeouts_1.getTimeout)('default'),
                data: xmlBody,
                headers: { 'Content-Type': contentTypes_1.MESSAGE_CLASS_UPDATE_CONTENT_TYPE },
            });
            // 6. Release the message lock first, then unlock the whole class last —
            //    the class edit-lock must be the final release of the process.
            this.logger?.info?.('upsertMessage: unlockAllMessages');
            await (0, unlock_1.unlockAllMessages)(this.connection, name, no);
            messageLockHandle = undefined;
            // 7. Unlock the whole class (final release)
            this.logger?.info?.('upsertMessage: unlock class');
            await (0, unlock_1.unlockMessageClass)(this.connection, name, classLockHandle);
            classLockHandle = undefined;
            // 8. Back to stateless
            this.connection.setSessionType('stateless');
            this.logger?.info?.('upsertMessage: done');
            return { updateResult, errors: [] };
        }
        catch (error) {
            // Always clean up locks and reset session on failure — release the
            // message lock first, then the class (final release), mirroring the happy path.
            if (messageLockHandle) {
                try {
                    await (0, unlock_1.unlockAllMessages)(this.connection, name, no);
                }
                catch (ue) {
                    this.logger?.warn?.('Failed to unlock messages during cleanup:', (0, internalUtils_1.safeErrorMessage)(ue));
                }
            }
            if (classLockHandle) {
                try {
                    await (0, unlock_1.unlockMessageClass)(this.connection, name, classLockHandle);
                }
                catch (ue) {
                    this.logger?.warn?.('Failed to unlock class during cleanup:', (0, internalUtils_1.safeErrorMessage)(ue));
                }
            }
            this.connection.setSessionType('stateless');
            this.logger?.error('upsertMessage failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
        finally {
            endCriticalSection();
        }
    }
    // ── delete ────────────────────────────────────────────────────────────────
    /**
     * Delete a single message from the parent class.
     *
     * SAP does NOT remove messages that are merely omitted from a class PUT — it
     * only upserts what is present.  The correct mechanism is to PUT the class
     * with the target message placed in <mc:deletedmessages> (carrying its own
     * message lock handle), while every other message remains in <mc:messages>.
     *
     * Chain: GET class → stateful → lockMessage (MH) + lockClassForMessage (CH)
     * → PUT class XML with target in <mc:deletedmessages mc:lockhandle=MH>,
     * remaining messages in <mc:messages> → unlockAllMessages →
     * unlock class (CH) → stateless.
     */
    async delete(config) {
        if (!config.className)
            throw new Error('className is required');
        if (!config.msgno)
            throw new Error('msgno is required');
        const name = config.className;
        const no = String(config.msgno);
        // 1. Read current class state — keep ALL messages (including the one being
        //    deleted) so the builder can emit <mc:deletedmessages> for the target
        const response = await (0, read_1.getMessageClassSource)(this.connection, name);
        const cls = (0, xml_1.parseMessageClass)(String(response.data));
        let messageLockHandle;
        let classLockHandle;
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            this.logger?.info?.('deleteMessage: stateful');
            this.connection.setSessionType('stateful');
            // 2. Lock the individual message (required for <mc:deletedmessages>)
            this.logger?.info?.('deleteMessage: lockMessage');
            messageLockHandle = await (0, lock_1.lockMessage)(this.connection, name, no);
            // 3. Lock the class for a message-save (msgNo + onSave=X)
            this.logger?.info?.('deleteMessage: lockClassForMessage');
            classLockHandle = await (0, lock_1.lockClassForMessage)(this.connection, name, no);
            // 4. PUT: target message → <mc:deletedmessages>; all others → <mc:messages>
            this.logger?.info?.('deleteMessage: PUT');
            const xmlBody = (0, xml_1.buildMessageClassXml)(cls, {
                deletedMsgnos: [no],
                messageLockHandles: { [no]: messageLockHandle },
            });
            const encoded = (0, internalUtils_1.encodeSapObjectName)(name.toLowerCase());
            const corrNr = config.transportRequest?.trim()
                ? `&corrNr=${encodeURIComponent(config.transportRequest)}`
                : '';
            const deleteResult = await this.connection.makeAdtRequest({
                url: `${BASE}/${encoded}?lockHandle=${encodeURIComponent(classLockHandle)}${corrNr}`,
                method: 'PUT',
                timeout: (0, timeouts_1.getTimeout)('default'),
                data: xmlBody,
                headers: { 'Content-Type': contentTypes_1.MESSAGE_CLASS_UPDATE_CONTENT_TYPE },
            });
            // 5. Release the message lock first, then unlock the whole class last.
            this.logger?.info?.('deleteMessage: unlockAllMessages');
            await (0, unlock_1.unlockAllMessages)(this.connection, name, no);
            messageLockHandle = undefined;
            // 6. Unlock the whole class (final release)
            this.logger?.info?.('deleteMessage: unlock class');
            await (0, unlock_1.unlockMessageClass)(this.connection, name, classLockHandle);
            classLockHandle = undefined;
            this.connection.setSessionType('stateless');
            this.logger?.info?.('deleteMessage: done');
            return { deleteResult, errors: [] };
        }
        catch (error) {
            // Release the message lock first, then the class (final release).
            if (messageLockHandle) {
                try {
                    await (0, unlock_1.unlockAllMessages)(this.connection, name, no);
                }
                catch (ue) {
                    this.logger?.warn?.('Failed to unlock messages during cleanup:', (0, internalUtils_1.safeErrorMessage)(ue));
                }
            }
            if (classLockHandle) {
                try {
                    await (0, unlock_1.unlockMessageClass)(this.connection, name, classLockHandle);
                }
                catch (ue) {
                    this.logger?.warn?.('Failed to unlock class during cleanup:', (0, internalUtils_1.safeErrorMessage)(ue));
                }
            }
            this.connection.setSessionType('stateless');
            this.logger?.error('deleteMessage failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
        finally {
            endCriticalSection();
        }
    }
    // ── readMetadata ───────────────────────────────────────────────────────────
    /** Delegates to read() — individual messages have no separate metadata endpoint. */
    async readMetadata(config) {
        const state = await this.read(config);
        if (!state) {
            throw new Error(`Message ${config.msgno} not found in class ${config.className}`);
        }
        return state;
    }
    // ── unsupported operations ─────────────────────────────────────────────────
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    async validate(_config) {
        (0, unsupported_1.throwUnsupportedOperation)('validate', 'message class message');
    }
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    async activate(_config) {
        (0, unsupported_1.throwUnsupportedOperation)('activate', 'message class message');
    }
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    async check(_config) {
        (0, unsupported_1.throwUnsupportedOperation)('check', 'message class message');
    }
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    async readTransport(_config) {
        (0, unsupported_1.throwUnsupportedOperation)('readTransport', 'message class message');
    }
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    async lock(_config) {
        (0, unsupported_1.throwUnsupportedOperation)('lock', 'message class message');
    }
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    async unlock(_config, _lockHandle) {
        (0, unsupported_1.throwUnsupportedOperation)('unlock', 'message class message');
    }
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    async getVersions(_config) {
        (0, unsupported_1.throwUnsupportedOperation)('getVersions', 'message class message');
    }
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    async getVersionSource(_contentUri) {
        (0, unsupported_1.throwUnsupportedOperation)('getVersionSource', 'message class message');
    }
}
exports.AdtMessageClassMessage = AdtMessageClassMessage;
