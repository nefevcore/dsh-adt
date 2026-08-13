"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtInterface = void 0;
const criticalSection_1 = require("../../utils/criticalSection");
const deletionCheck_1 = require("../../utils/deletionCheck");
const internalUtils_1 = require("../../utils/internalUtils");
const LockRegistry_1 = require("../shared/LockRegistry");
const activation_1 = require("./activation");
const check_1 = require("./check");
const create_1 = require("./create");
const delete_1 = require("./delete");
const lock_1 = require("./lock");
const read_1 = require("./read");
const unlock_1 = require("./unlock");
const update_1 = require("./update");
const validation_1 = require("./validation");
const versions_1 = require("./versions");
class AdtInterface {
    connection;
    logger;
    systemContext;
    contentTypes;
    lockTracker;
    objectType = 'Interface';
    constructor(connection, logger, systemContext, contentTypes, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
        this.contentTypes = contentTypes;
        this.lockTracker = (0, LockRegistry_1.createLockTracker)(lockRegistry, this.objectType, (interfaceName, lockHandle) => (0, unlock_1.unlockInterface)(this.connection, interfaceName, lockHandle));
    }
    /**
     * Validate interface configuration before creation
     */
    async validate(config) {
        if (!config.interfaceName) {
            throw new Error('Interface name is required for validation');
        }
        const validationResponse = await (0, validation_1.validateInterfaceName)(this.connection, config.interfaceName, config.packageName, config.description);
        return {
            validationResponse: validationResponse,
            errors: [],
        };
    }
    /**
     * Create interface with full operation chain
     */
    async create(config, options) {
        if (!config.interfaceName) {
            throw new Error('Interface name is required');
        }
        if (!config.packageName) {
            throw new Error('Package name is required');
        }
        if (!config.description) {
            throw new Error('Description is required');
        }
        let objectCreated = false;
        const state = {
            errors: [],
        };
        try {
            // Create interface
            this.logger?.info?.('Creating interface');
            const createResponse = await (0, create_1.create)(this.connection, {
                interfaceName: config.interfaceName,
                packageName: config.packageName,
                transportRequest: config.transportRequest,
                description: config.description,
                masterSystem: this.systemContext.masterSystem,
                responsible: this.systemContext.responsible,
                masterLanguage: config.masterLanguage ?? this.systemContext.masterLanguage,
            }, this.logger);
            state.createResult = createResponse;
            objectCreated = true;
            this.logger?.info?.('Interface created');
            return state;
        }
        catch (error) {
            // Cleanup on error - ensure stateless
            this.connection.setSessionType('stateless');
            if (objectCreated && options?.deleteOnFailure) {
                try {
                    this.logger?.warn?.('Deleting interface after failure');
                    this.connection.setSessionType('stateful');
                    await (0, delete_1.deleteInterface)(this.connection, {
                        interface_name: config.interfaceName,
                        transport_request: config.transportRequest,
                    });
                    this.connection.setSessionType('stateless');
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete interface after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
                }
            }
            this.logger?.error('Create failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read interface
     */
    async read(config, version, options) {
        if (!config.interfaceName) {
            throw new Error('Interface name is required');
        }
        try {
            const response = await (0, read_1.getInterfaceSource)(this.connection, config.interfaceName, version, options);
            return {
                readResult: response,
                errors: [],
            };
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
     * Read interface metadata (object characteristics: package, responsible, description, etc.)
     */
    async readMetadata(config, options) {
        const state = { errors: [] };
        if (!config.interfaceName) {
            const error = new Error('Interface name is required');
            state.errors.push({
                method: 'readMetadata',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getInterfaceMetadata)(this.connection, config.interfaceName, options);
            state.metadataResult = response;
            this.logger?.info?.('Interface metadata read successfully');
            return state;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            state.errors.push({
                method: 'readMetadata',
                error: err,
                timestamp: new Date(),
            });
            this.logger?.error('readMetadata', (0, internalUtils_1.safeErrorMessage)(err));
            throw err;
        }
    }
    /**
     * Update interface with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    async update(config, options) {
        if (!config.interfaceName) {
            throw new Error('Interface name is required');
        }
        // Low-level mode: if lockHandle is provided, perform only update operation
        if (options?.lockHandle) {
            const codeToUpdate = options?.sourceCode || config.sourceCode;
            if (!codeToUpdate) {
                throw new Error('Source code is required for update');
            }
            this.logger?.info?.('Low-level update: performing update only (lockHandle provided)');
            await (0, update_1.upload)(this.connection, config.interfaceName, codeToUpdate, options.lockHandle, config.transportRequest, this.contentTypes?.sourceArtifactContentType());
            this.logger?.info?.('Interface updated (low-level)');
            return {
                errors: [],
            };
        }
        let lockHandle;
        const state = {
            errors: [],
        };
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            // 1. Lock (update always starts with lock, stateful only for lock)
            this.logger?.info?.('Step 1: Locking interface');
            this.connection.setSessionType('stateful');
            const lockResult = await (0, lock_1.lockInterface)(this.connection, config.interfaceName);
            lockHandle = lockResult.lockHandle;
            state.lockHandle = lockHandle;
            this.lockTracker.track(config.interfaceName, lockHandle);
            this.logger?.info?.('Interface locked, handle:', lockHandle);
            // 2. Check inactive with code for update (from options or config)
            const codeToCheck = options?.sourceCode || config.sourceCode;
            if (codeToCheck) {
                this.logger?.info?.('Step 2: Checking inactive version with update content');
                const deletionCheck = await (0, check_1.checkInterface)(this.connection, config.interfaceName, 'inactive', codeToCheck, this.contentTypes?.sourceArtifactContentType());
                state.checkResult = deletionCheck;
                this.logger?.info?.('Check inactive with update content passed');
            }
            // 3. Update
            if (codeToCheck && lockHandle) {
                this.logger?.info?.('Step 3: Updating interface');
                await (0, update_1.upload)(this.connection, config.interfaceName, codeToCheck, lockHandle, config.transportRequest, this.contentTypes?.sourceArtifactContentType());
                // upload() returns void, so we don't store it in state
                this.logger?.info?.('Interface updated');
                // Poll the inactive version: the write above produced it; the active version may not exist yet.
                // 3.5. Read with long polling to ensure object is ready after update
                this.logger?.info?.('read (wait for object ready after update)');
                try {
                    await this.read({ interfaceName: config.interfaceName }, 'inactive', {
                        withLongPolling: true,
                    });
                    this.logger?.info?.('object is ready after update');
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed after update:', (0, internalUtils_1.safeErrorMessage)(readError));
                    // Continue anyway - unlock might still work
                }
            }
            // 4. Unlock (obligatory stateless after unlock)
            if (lockHandle) {
                this.logger?.info?.('Step 4: Unlocking interface');
                this.connection.setSessionType('stateful');
                const unlockResponse = await (0, unlock_1.unlockInterface)(this.connection, config.interfaceName, lockHandle);
                state.unlockResult = unlockResponse;
                this.connection.setSessionType('stateless');
                this.lockTracker.untrack(config.interfaceName);
                lockHandle = undefined;
                this.logger?.info?.('Interface unlocked');
            }
            // 5. Final check (no stateful needed)
            this.logger?.info?.('Step 5: Final check');
            const checkResponse2 = await (0, check_1.checkInterface)(this.connection, config.interfaceName, 'inactive', undefined, this.contentTypes?.sourceArtifactContentType());
            state.checkResult = checkResponse2;
            this.logger?.info?.('Final check passed');
            // 6. Activate (if requested, no stateful needed - uses same session/cookies)
            if (options?.activateOnUpdate) {
                this.logger?.info?.('Step 6: Activating interface');
                const activateResponse = await (0, activation_1.activateInterface)(this.connection, config.interfaceName);
                state.activateResult = activateResponse;
                this.logger?.info?.('Interface activated, status:', activateResponse.status);
                // 6.5. Read with long polling to ensure object is ready after activation
                this.logger?.info?.('read (wait for object ready after activation)');
                try {
                    const readState = await this.read({ interfaceName: config.interfaceName }, 'active', { withLongPolling: true });
                    if (readState) {
                        state.readResult = readState.readResult;
                    }
                    this.logger?.info?.('object is ready after activation');
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed after activation:', (0, internalUtils_1.safeErrorMessage)(readError));
                    // Continue anyway - activation was successful
                }
            }
            else {
                // Read inactive version if not activated
                const readResponse = await (0, read_1.getInterfaceSource)(this.connection, config.interfaceName, 'inactive');
                state.readResult = readResponse;
            }
            return state;
        }
        catch (error) {
            // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking interface during error cleanup');
                    this.connection.setSessionType('stateful');
                    await (0, unlock_1.unlockInterface)(this.connection, config.interfaceName, lockHandle);
                    this.connection.setSessionType('stateless');
                    this.lockTracker.untrack(config.interfaceName);
                }
                catch (unlockError) {
                    this.logger?.warn?.('Failed to unlock during cleanup:', (0, internalUtils_1.safeErrorMessage)(unlockError));
                }
            }
            else {
                // Ensure stateless if lock failed
                this.connection.setSessionType('stateless');
            }
            if (options?.deleteOnFailure) {
                try {
                    this.logger?.warn?.('Deleting interface after failure');
                    this.connection.setSessionType('stateful');
                    await (0, delete_1.deleteInterface)(this.connection, {
                        interface_name: config.interfaceName,
                        transport_request: config.transportRequest,
                    });
                    this.connection.setSessionType('stateless');
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete interface after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
                }
            }
            this.logger?.error('Update failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
        finally {
            endCriticalSection();
        }
    }
    /**
     * Delete interface
     */
    async delete(config) {
        if (!config.interfaceName) {
            throw new Error('Interface name is required');
        }
        const state = {
            errors: [],
        };
        try {
            // Check for deletion (no stateful needed)
            this.logger?.info?.('Checking interface for deletion');
            const deletionCheck = await (0, delete_1.checkDeletion)(this.connection, {
                interface_name: config.interfaceName,
                transport_request: config.transportRequest,
            });
            // ADT already said whether this may be deleted; refusing to read that
            // answer is how a delete came to report success while the object
            // stayed. Throws on isDeletable=false or a message of type E; a W
            // is a warning and passes.
            (0, deletionCheck_1.assertDeletable)(deletionCheck.data);
            state.checkResult = deletionCheck;
            this.logger?.info?.('Deletion check passed');
            // Delete (requires stateful, but no lock)
            this.logger?.info?.('Deleting interface');
            this.connection.setSessionType('stateful');
            const deleteResponse = await (0, delete_1.deleteInterface)(this.connection, {
                interface_name: config.interfaceName,
                transport_request: config.transportRequest,
            });
            state.deleteResult = deleteResponse;
            this.logger?.info?.('Interface deleted');
            return state;
        }
        catch (error) {
            this.logger?.error('Delete failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
        finally {
            this.connection.setSessionType('stateless');
        }
    }
    /**
     * Activate interface
     * No stateful needed - uses same session/cookies
     */
    async activate(config) {
        if (!config.interfaceName) {
            throw new Error('Interface name is required');
        }
        const state = {
            errors: [],
        };
        try {
            const activateResponse = await (0, activation_1.activateInterface)(this.connection, config.interfaceName);
            state.activateResult = activateResponse;
            return state;
        }
        catch (error) {
            this.logger?.error('Activate failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Check interface
     */
    async check(config, status) {
        if (!config.interfaceName) {
            throw new Error('Interface name is required');
        }
        const state = {
            errors: [],
        };
        // Map status to version
        const version = status === 'active' ? 'active' : 'inactive';
        const deletionCheck = await (0, check_1.checkInterface)(this.connection, config.interfaceName, version, config.sourceCode, this.contentTypes?.sourceArtifactContentType());
        state.checkResult = deletionCheck;
        return state;
    }
    /**
     * Read transport request information for the interface
     */
    async readTransport(config, options) {
        const state = {
            errors: [],
        };
        if (!config.interfaceName) {
            const error = new Error('Interface name is required');
            state.errors.push({
                method: 'readTransport',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getInterfaceTransport)(this.connection, config.interfaceName, options?.withLongPolling !== undefined
                ? { withLongPolling: options.withLongPolling }
                : undefined);
            state.transportResult = response;
            this.logger?.info?.('Transport request read successfully');
            return state;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            state.errors.push({
                method: 'readTransport',
                error: err,
                timestamp: new Date(),
            });
            this.logger?.error('readTransport', (0, internalUtils_1.safeErrorMessage)(err));
            throw err;
        }
    }
    /**
     * Lock interface for modification
     */
    async lock(config) {
        if (!config.interfaceName) {
            throw new Error('Interface name is required');
        }
        this.connection.setSessionType('stateful');
        const result = await (0, lock_1.lockInterface)(this.connection, config.interfaceName);
        this.lockTracker.track(config.interfaceName, result.lockHandle);
        return result.lockHandle;
    }
    /**
     * Unlock interface
     */
    async unlock(config, lockHandle) {
        if (!config.interfaceName) {
            throw new Error('Interface name is required');
        }
        this.connection.setSessionType('stateful');
        const result = await (0, unlock_1.unlockInterface)(this.connection, config.interfaceName, lockHandle);
        this.connection.setSessionType('stateless');
        this.lockTracker.untrack(config.interfaceName);
        return {
            unlockResult: result,
            errors: [],
        };
    }
    getVersions(config) {
        return (0, versions_1.getInterfaceVersions)(this.connection, config);
    }
    getVersionSource(contentUri) {
        return (0, versions_1.getInterfaceVersionSource)(this.connection, contentUri);
    }
}
exports.AdtInterface = AdtInterface;
