"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtStructure = void 0;
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
class AdtStructure {
    connection;
    logger;
    systemContext;
    lockTracker;
    objectType = 'Structure';
    constructor(connection, logger, systemContext, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
        this.lockTracker = (0, LockRegistry_1.createLockTracker)(lockRegistry, this.objectType, (name, lockHandle) => (0, unlock_1.unlockStructure)(this.connection, name, lockHandle));
    }
    /**
     * Validate structure configuration before creation
     */
    async validate(config) {
        if (!config.structureName) {
            throw new Error('Structure name is required for validation');
        }
        const state = { errors: [] };
        try {
            const response = await (0, validation_1.validateStructureName)(this.connection, config.structureName, config.description);
            state.validationResponse = response;
            return state;
        }
        catch (error) {
            state.errors.push({
                method: 'validate',
                error: error instanceof Error ? error : new Error(String(error)),
                timestamp: new Date(),
            });
            this.logger?.error('validate failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Create structure metadata only
     * Use update() to upload DDL code after creation
     */
    async create(config, options) {
        if (!config.structureName) {
            throw new Error('Structure name is required');
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
            // Create structure
            this.logger?.info?.('Creating structure');
            const createResponse = await (0, create_1.create)(this.connection, {
                structureName: config.structureName,
                packageName: config.packageName,
                transportRequest: config.transportRequest,
                description: config.description,
                masterSystem: this.systemContext.masterSystem,
                responsible: this.systemContext.responsible,
                masterLanguage: config.masterLanguage ?? this.systemContext.masterLanguage,
            });
            objectCreated = true;
            state.createResult = createResponse;
            this.logger?.info?.('Structure created');
            return state;
        }
        catch (error) {
            if (objectCreated && options?.deleteOnFailure) {
                try {
                    this.logger?.warn?.('Deleting structure after failure');
                    await (0, delete_1.deleteStructure)(this.connection, {
                        structure_name: config.structureName,
                        transport_request: config.transportRequest,
                    });
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete structure after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
                }
            }
            this.logger?.error('Create failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read structure
     */
    async read(config, version, options) {
        if (!config.structureName) {
            throw new Error('Structure name is required');
        }
        try {
            const response = await (0, read_1.getStructureSource)(this.connection, config.structureName, version, options);
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
            throw error;
        }
    }
    /**
     * Read structure metadata (object characteristics: package, responsible, description, etc.)
     */
    async readMetadata(config, options) {
        const state = { errors: [] };
        if (!config.structureName) {
            const error = new Error('Structure name is required');
            state.errors.push({
                method: 'readMetadata',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getStructureMetadata)(this.connection, config.structureName, options);
            state.metadataResult = response;
            this.logger?.info?.('Structure metadata read successfully');
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
     * Read transport request information for the structure
     */
    async readTransport(config, options) {
        const state = { errors: [] };
        if (!config.structureName) {
            const error = new Error('Structure name is required');
            state.errors.push({
                method: 'readTransport',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getStructureTransport)(this.connection, config.structureName, options?.withLongPolling !== undefined
                ? { withLongPolling: options.withLongPolling }
                : undefined);
            state.transportResult = response;
            this.logger?.info?.('Structure transport request read successfully');
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
     * Update structure with full operation chain
     * Always starts with lock
     * If options.low is true, performs only low-level update without lock/check/unlock chain
     */
    async update(config, options) {
        if (!config.structureName) {
            throw new Error('Structure name is required');
        }
        // Low-level mode: if lockHandle is provided, perform only update operation
        if (options?.lockHandle) {
            const codeToUpdate = options?.sourceCode || config.ddlCode;
            if (!codeToUpdate) {
                throw new Error('Source code (ddlCode) is required for update');
            }
            this.logger?.info?.('Low-level update: performing update only (lockHandle provided)');
            const updateResponse = await (0, update_1.upload)(this.connection, {
                structureName: config.structureName,
                ddlCode: codeToUpdate,
                transportRequest: config.transportRequest,
            }, options.lockHandle);
            this.logger?.info?.('Structure updated (low-level)');
            return {
                updateResult: updateResponse,
                errors: [],
            };
        }
        let lockHandle;
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            // 1. Lock (update always starts with lock, stateful ONLY before lock)
            this.logger?.info?.('Step 1: Locking structure');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockStructure)(this.connection, config.structureName);
            this.lockTracker.track(config.structureName, lockHandle);
            this.logger?.info?.('Structure locked, handle:', lockHandle);
            // 2. Check inactive with code for update (from options or config)
            const codeToCheck = options?.sourceCode || config.ddlCode;
            if (codeToCheck) {
                this.logger?.info?.('Step 2: Checking inactive version with update content');
                await (0, check_1.checkStructure)(this.connection, config.structureName, 'inactive', codeToCheck, this.logger);
                this.logger?.info?.('Check inactive with update content passed');
            }
            // 3. Update
            if (codeToCheck && lockHandle) {
                this.logger?.info?.('Step 3: Updating structure');
                await (0, update_1.upload)(this.connection, {
                    structureName: config.structureName,
                    ddlCode: codeToCheck,
                    transportRequest: config.transportRequest,
                }, lockHandle);
                this.logger?.info?.('Structure updated');
                // Poll the inactive version: the write above produced it; the active version may not exist yet.
                // 3.5. Read with long polling to ensure object is ready after update
                this.logger?.info?.('read (wait for object ready after update)');
                try {
                    await this.read({ structureName: config.structureName }, 'inactive', {
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
                this.logger?.info?.('Step 4: Unlocking structure');
                this.connection.setSessionType('stateful');
                await (0, unlock_1.unlockStructure)(this.connection, config.structureName, lockHandle);
                this.connection.setSessionType('stateless');
                this.lockTracker.untrack(config.structureName);
                lockHandle = undefined;
                this.logger?.info?.('Structure unlocked');
            }
            // 5. Final check (no stateful needed)
            this.logger?.info?.('Step 5: Final check');
            await (0, check_1.checkStructure)(this.connection, config.structureName, 'inactive', undefined, this.logger);
            this.logger?.info?.('Final check passed');
            // 6. Activate (if requested, no stateful needed - uses same session/cookies)
            if (options?.activateOnUpdate) {
                this.logger?.info?.('Step 6: Activating structure');
                const activateResponse = await (0, activation_1.activateStructure)(this.connection, config.structureName);
                this.logger?.info?.('Structure activated, status:', activateResponse.status);
                // 6.5. Read with long polling to ensure object is ready after activation
                this.logger?.info?.('read (wait for object ready after activation)');
                try {
                    const readState = await this.read({ structureName: config.structureName }, 'active', { withLongPolling: true });
                    if (readState) {
                        return {
                            activateResult: activateResponse,
                            readResult: readState.readResult,
                            errors: [],
                        };
                    }
                    this.logger?.info?.('object is ready after activation');
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed after activation:', (0, internalUtils_1.safeErrorMessage)(readError));
                    // Continue anyway - activation was successful
                }
                return {
                    activateResult: activateResponse,
                    errors: [],
                };
            }
            // Read and return result (no stateful needed)
            const readResponse = await (0, read_1.getStructureSource)(this.connection, config.structureName, 'inactive');
            return {
                readResult: readResponse,
                errors: [],
            };
        }
        catch (error) {
            // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking structure during error cleanup');
                    this.connection.setSessionType('stateful');
                    await (0, unlock_1.unlockStructure)(this.connection, config.structureName, lockHandle);
                    this.connection.setSessionType('stateless');
                    this.lockTracker.untrack(config.structureName);
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
                    this.logger?.warn?.('Deleting structure after failure');
                    // No stateful needed - delete doesn't use lock/unlock
                    await (0, delete_1.deleteStructure)(this.connection, {
                        structure_name: config.structureName,
                        transport_request: config.transportRequest,
                    });
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete structure after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
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
     * Delete structure
     */
    async delete(config) {
        if (!config.structureName) {
            throw new Error('Structure name is required');
        }
        try {
            // Check for deletion (no stateful needed)
            this.logger?.info?.('Checking structure for deletion');
            const deletionCheck = await (0, delete_1.checkDeletion)(this.connection, {
                structure_name: config.structureName,
                transport_request: config.transportRequest,
            });
            // ADT already said whether this may be deleted; refusing to read that
            // answer is how a delete came to report success while the object
            // stayed. Throws on isDeletable=false or a message of type E; a W
            // is a warning and passes.
            (0, deletionCheck_1.assertDeletable)(deletionCheck.data);
            this.logger?.info?.('Deletion check passed');
            // Delete (no stateful needed - no lock/unlock)
            this.logger?.info?.('Deleting structure');
            const result = await (0, delete_1.deleteStructure)(this.connection, {
                structure_name: config.structureName,
                transport_request: config.transportRequest,
            });
            this.logger?.info?.('Structure deleted');
            return {
                deleteResult: result,
                errors: [],
            };
        }
        catch (error) {
            this.logger?.error('Delete failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Activate structure
     * No stateful needed - uses same session/cookies
     */
    async activate(config) {
        if (!config.structureName) {
            throw new Error('Structure name is required');
        }
        try {
            const result = await (0, activation_1.activateStructure)(this.connection, config.structureName);
            return {
                activateResult: result,
                errors: [],
            };
        }
        catch (error) {
            this.logger?.error('Activate failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Check structure
     */
    async check(config, status) {
        if (!config.structureName) {
            throw new Error('Structure name is required');
        }
        // Map status to version
        const version = status === 'active' ? 'active' : 'inactive';
        return {
            checkResult: await (0, check_1.checkStructure)(this.connection, config.structureName, version, undefined, this.logger),
            errors: [],
        };
    }
    /**
     * Lock structure for modification
     */
    async lock(config) {
        if (!config.structureName) {
            throw new Error('Structure name is required');
        }
        this.connection.setSessionType('stateful');
        const lockHandle = await (0, lock_1.lockStructure)(this.connection, config.structureName);
        this.lockTracker.track(config.structureName, lockHandle);
        return lockHandle;
    }
    /**
     * Unlock structure
     */
    async unlock(config, lockHandle) {
        if (!config.structureName) {
            throw new Error('Structure name is required');
        }
        this.connection.setSessionType('stateful');
        const result = await (0, unlock_1.unlockStructure)(this.connection, config.structureName, lockHandle);
        this.connection.setSessionType('stateless');
        this.lockTracker.untrack(config.structureName);
        return {
            unlockResult: result,
            errors: [],
        };
    }
    getVersions(config) {
        return (0, versions_1.getStructureVersions)(this.connection, config);
    }
    getVersionSource(contentUri) {
        return (0, versions_1.getStructureVersionSource)(this.connection, contentUri);
    }
}
exports.AdtStructure = AdtStructure;
