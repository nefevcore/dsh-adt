"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtMessageClass = void 0;
const criticalSection_1 = require("../../utils/criticalSection");
const deletionCheck_1 = require("../../utils/deletionCheck");
const internalUtils_1 = require("../../utils/internalUtils");
const timeouts_1 = require("../../utils/timeouts");
const LockRegistry_1 = require("../shared/LockRegistry");
const unsupported_1 = require("../shared/unsupported");
const create_1 = require("./create");
const delete_1 = require("./delete");
const lock_1 = require("./lock");
const read_1 = require("./read");
const unlock_1 = require("./unlock");
const update_1 = require("./update");
const xml_1 = require("./xml");
const VALIDATE_BASE = '/sap/bc/adt/messageclass/validation';
class AdtMessageClass {
    connection;
    logger;
    systemContext;
    lockTracker;
    objectType = 'MessageClass';
    constructor(connection, logger, systemContext, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
        this.lockTracker = (0, LockRegistry_1.createLockTracker)(lockRegistry, this.objectType, (name, lockHandle) => (0, unlock_1.unlockMessageClass)(this.connection, name, lockHandle));
    }
    /**
     * Validate name + description via the ADT validation endpoint.
     */
    async validate(config) {
        if (!config.name) {
            throw new Error('Message class name is required for validation');
        }
        const params = new URLSearchParams({ objname: config.name });
        if (config.description) {
            params.set('description', config.description);
        }
        // POST with the params in the query string (empty body) — matches Eclipse ADT
        // and the other object types' validation (accessControl, transformation, …).
        const response = await this.connection.makeAdtRequest({
            url: `${VALIDATE_BASE}?${params.toString()}`,
            method: 'POST',
            timeout: (0, timeouts_1.getTimeout)('default'),
        });
        return { validationResponse: response, errors: [] };
    }
    /**
     * Create a new message class (shell with name/description/package).
     * No activation is needed — message classes are not activated.
     */
    async create(config, _options) {
        if (!config.name) {
            throw new Error('Message class name is required');
        }
        if (!config.packageName) {
            throw new Error('Package name is required');
        }
        if (!config.description) {
            throw new Error('Description is required');
        }
        try {
            this.logger?.info?.('Creating message class');
            const createResult = await (0, create_1.createMessageClass)(this.connection, {
                name: config.name,
                description: config.description,
                package_name: config.packageName,
                // config → global systemContext → 'EN', like class/domain/package.
                master_language: config.masterLanguage?.trim() ||
                    this.systemContext.masterLanguage?.trim() ||
                    'EN',
                // sent as ?corrNr= for a transportable package; empty for local
                transport_request: config.transportRequest,
            });
            this.logger?.info?.('Message class created');
            return { createResult, errors: [] };
        }
        catch (error) {
            // Defensive reset: create never sets stateful, but this guard ensures the
            // session is always left stateless if the caller had set it before this call.
            this.connection.setSessionType('stateless');
            this.logger?.error('Create failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read message class metadata and messages.
     * Returns undefined on 404 (object does not exist).
     */
    async read(config, _version, options) {
        if (!config.name) {
            throw new Error('Message class name is required');
        }
        try {
            const readResult = await (0, read_1.getMessageClassSource)(this.connection, config.name, options);
            const messageClass = (0, xml_1.parseMessageClass)(String(readResult.data));
            return { readResult, messageClass, errors: [] };
        }
        catch (error) {
            const e = error;
            if (e.response?.status === 404) {
                return undefined;
            }
            this.logger?.error('Read failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Update a message class.
     * Full operation chain: stateful → lock → read current → rebuild XML → PUT → unlock → stateless.
     * On failure: unlock if locked, then stateless.
     */
    async update(config, _options) {
        if (!config.name) {
            throw new Error('Message class name is required');
        }
        let lockHandle;
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            this.logger?.info?.('lock');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockMessageClass)(this.connection, config.name);
            this.lockTracker.track(config.name, lockHandle);
            this.logger?.info?.('locked');
            this.logger?.info?.('update');
            const updateResult = await (0, update_1.updateMessageClass)(this.connection, config.name, lockHandle, config.description, config.transportRequest);
            this.logger?.info?.('updated');
            this.logger?.info?.('unlock');
            const unlockResult = await (0, unlock_1.unlockMessageClass)(this.connection, config.name, lockHandle);
            this.connection.setSessionType('stateless');
            this.lockTracker.untrack(config.name);
            lockHandle = undefined;
            this.logger?.info?.('unlocked');
            return { updateResult, unlockResult, errors: [] };
        }
        catch (error) {
            // Unlock + stateless cleanup on any failure inside the lock chain
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking message class during error cleanup');
                    await (0, unlock_1.unlockMessageClass)(this.connection, config.name, lockHandle);
                    this.lockTracker.untrack(config.name);
                }
                catch (unlockError) {
                    this.logger?.warn?.('Failed to unlock during cleanup:', (0, internalUtils_1.safeErrorMessage)(unlockError));
                }
            }
            this.connection.setSessionType('stateless');
            this.logger?.error('Update failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
        finally {
            endCriticalSection();
        }
    }
    /**
     * Delete a message class.
     * Operation chain: check(deletion) → delete via the stateless ADT deletion
     * service (/deletion/check + /deletion/delete). No lock, no direct DELETE.
     */
    async delete(config) {
        if (!config.name) {
            throw new Error('Message class name is required');
        }
        try {
            // Stateless deletion service (check → delete) — no lock. A stateful
            // lock + direct DELETE leaves a lingering message-editing enqueue that
            // blocks a same-name re-create, so it is not used. See delete.ts.
            this.logger?.info?.('delete: check');
            const deletionCheck = await (0, delete_1.checkDeletion)(this.connection, config.name);
            // ADT already said whether this may be deleted; refusing to read that
            // answer is how a delete came to report success while the object
            // stayed. Throws on isDeletable=false or a message of type E; a W
            // is a warning and passes.
            (0, deletionCheck_1.assertDeletable)(deletionCheck.data);
            this.logger?.info?.('delete: delete');
            const deleteResult = await (0, delete_1.deleteMessageClass)(this.connection, config.name, config.transportRequest);
            this.logger?.info?.('deleted');
            return { deleteResult, errors: [] };
        }
        catch (error) {
            this.logger?.error('Delete failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read message class metadata.
     * Message classes have no separate metadata endpoint — delegates to read().
     */
    async readMetadata(config, options) {
        if (!config.name) {
            throw new Error('Message class name is required');
        }
        const state = await this.read(config, options?.version, {
            withLongPolling: options?.withLongPolling,
        });
        if (!state) {
            throw new Error(`Message class '${config.name}' not found`);
        }
        return { ...state, metadataResult: state.readResult };
    }
    /**
     * Read transport request information.
     * Transport endpoint is not confirmed for message classes — always throws.
     *
     * @deprecated Not part of this handler's capability set; throws. Removed in a later major.
     */
    async readTransport(config) {
        (0, unsupported_1.throwUnsupportedOperation)('readTransport', `message class ${config.name ?? ''}`);
    }
    /**
     * Lock message class for modification (low-level — use when managing lock externally).
     */
    async lock(config) {
        if (!config.name) {
            throw new Error('Message class name is required');
        }
        this.connection.setSessionType('stateful');
        const lockHandle = await (0, lock_1.lockMessageClass)(this.connection, config.name);
        this.lockTracker.track(config.name, lockHandle);
        return lockHandle;
    }
    /**
     * Unlock message class (low-level).
     */
    async unlock(config, lockHandle) {
        if (!config.name) {
            throw new Error('Message class name is required');
        }
        const unlockResult = await (0, unlock_1.unlockMessageClass)(this.connection, config.name, lockHandle);
        this.connection.setSessionType('stateless');
        this.lockTracker.untrack(config.name);
        return { unlockResult, errors: [] };
    }
    /**
     * Message classes are not activated — always throws.
     * @deprecated Not part of this handler's capability set; throws. Removed in a later major.
     */
    async activate(_config) {
        (0, unsupported_1.throwUnsupportedOperation)('activate', `message class ${_config.name ?? ''}`);
    }
    /**
     * Syntax check is not applicable to message classes — always throws.
     * @deprecated Not part of this handler's capability set; throws. Removed in a later major.
     */
    async check(_config) {
        (0, unsupported_1.throwUnsupportedOperation)('check', `message class ${_config.name ?? ''}`);
    }
    /**
     * Version history is not supported for message classes — always throws.
     * @deprecated Not part of this handler's capability set; throws. Removed in a later major.
     */
    async getVersions(_config) {
        (0, unsupported_1.throwUnsupportedOperation)('getVersions', `message class ${_config.name ?? ''}`);
    }
    /**
     * Version source retrieval is not supported for message classes — always throws.
     * @deprecated Not part of this handler's capability set; throws. Removed in a later major.
     */
    async getVersionSource(_contentUri) {
        (0, unsupported_1.throwUnsupportedOperation)('getVersionSource', 'message class');
    }
}
exports.AdtMessageClass = AdtMessageClass;
