"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtDdl = void 0;
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
class AdtDdl {
    connection;
    logger;
    systemContext;
    lockTracker;
    objectType = 'View';
    constructor(connection, logger, systemContext, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
        this.lockTracker = (0, LockRegistry_1.createLockTracker)(lockRegistry, this.objectType, (ddlName, lockHandle) => (0, unlock_1.unlockDDLS)(this.connection, ddlName, lockHandle));
    }
    /**
     * Validate view configuration before creation
     */
    async validate(config) {
        if (!config.ddlName) {
            throw new Error('View name is required for validation');
        }
        const state = { errors: [] };
        try {
            const response = await (0, validation_1.validateDdlName)(this.connection, config.ddlName, config.packageName, config.description);
            state.validationResponse = response;
            return state;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            state.errors.push({
                method: 'validate',
                error: err,
                timestamp: new Date(),
            });
            this.logger?.error('validate', (0, internalUtils_1.safeErrorMessage)(err));
            throw err;
        }
    }
    /**
     * Create view with full operation chain
     */
    async create(config, options) {
        if (!config.ddlName) {
            throw new Error('View name is required');
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
            // Create view
            this.logger?.info?.('Creating view');
            const createResponse = await (0, create_1.createDdl)(this.connection, {
                ddl_name: config.ddlName,
                package_name: config.packageName,
                transport_request: config.transportRequest,
                description: config.description,
                ddl_source: options?.sourceCode || config.ddlSource,
                masterSystem: this.systemContext.masterSystem,
                responsible: this.systemContext.responsible,
                masterLanguage: config.masterLanguage ?? this.systemContext.masterLanguage,
            });
            objectCreated = true;
            state.createResult = createResponse;
            this.logger?.info?.('View created');
            return state;
        }
        catch (error) {
            // Cleanup on error - ensure stateless
            this.connection.setSessionType('stateless');
            if (objectCreated && options?.deleteOnFailure) {
                try {
                    this.logger?.warn?.('Deleting view after failure');
                    // No stateful needed - delete doesn't use lock/unlock
                    await (0, delete_1.deleteDdl)(this.connection, {
                        ddl_name: config.ddlName,
                        transport_request: config.transportRequest,
                    });
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete view after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
                }
            }
            this.logger?.error('Create failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read view
     */
    async read(config, version, options) {
        if (!config.ddlName) {
            throw new Error('View name is required');
        }
        try {
            const response = await (0, read_1.getDdlSource)(this.connection, config.ddlName, version, options);
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
     * Read view metadata (object characteristics: package, responsible, description, etc.)
     */
    async readMetadata(config, options) {
        const state = { errors: [] };
        if (!config.ddlName) {
            const error = new Error('View name is required');
            state.errors.push({
                method: 'readMetadata',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getDdlMetadata)(this.connection, config.ddlName, options);
            state.metadataResult = response;
            this.logger?.info?.('View metadata read successfully');
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
     * Read transport request information for the view
     */
    async readTransport(config, options) {
        const state = { errors: [] };
        if (!config.ddlName) {
            const error = new Error('View name is required');
            state.errors.push({
                method: 'readTransport',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getDdlTransport)(this.connection, config.ddlName, options?.withLongPolling !== undefined
                ? { withLongPolling: options.withLongPolling }
                : undefined);
            state.transportResult = response;
            this.logger?.info?.('View transport request read successfully');
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
     * Update view with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    async update(config, options) {
        if (!config.ddlName) {
            throw new Error('View name is required');
        }
        // Low-level mode: if lockHandle is provided, perform only update operation
        if (options?.lockHandle) {
            const codeToUpdate = options?.sourceCode || config.ddlSource;
            if (!codeToUpdate) {
                throw new Error('Source code (ddlSource) is required for update');
            }
            this.logger?.info?.('Low-level update: performing update only (lockHandle provided)');
            const updateResponse = await (0, update_1.updateDdl)(this.connection, config.ddlName, codeToUpdate, options.lockHandle, config.transportRequest);
            this.logger?.info?.('View updated (low-level)');
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
            this.logger?.info?.('Step 1: Locking view');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockDDLS)(this.connection, config.ddlName);
            this.lockTracker.track(config.ddlName, lockHandle);
            this.logger?.info?.('View locked, handle:', lockHandle);
            // 2. Check inactive with code for update (from options or config)
            const codeToCheck = options?.sourceCode || config.ddlSource;
            if (codeToCheck) {
                this.logger?.info?.('Step 2: Checking inactive version with update content');
                await (0, check_1.checkDdl)(this.connection, config.ddlName, 'inactive', codeToCheck, this.logger);
                this.logger?.info?.('Check inactive with update content passed');
            }
            // 3. Update
            if (codeToCheck && lockHandle) {
                this.logger?.info?.('Step 3: Updating view');
                await (0, update_1.updateDdl)(this.connection, config.ddlName, codeToCheck, lockHandle, config.transportRequest);
                this.logger?.info?.('View updated');
                // Poll the inactive version: the write above produced it; the active version may not exist yet.
                // 3.5. Read with long polling to ensure object is ready after update
                this.logger?.info?.('read (wait for object ready after update)');
                try {
                    await this.read({ ddlName: config.ddlName }, 'inactive', {
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
                this.logger?.info?.('Step 4: Unlocking view');
                this.connection.setSessionType('stateful');
                await (0, unlock_1.unlockDDLS)(this.connection, config.ddlName, lockHandle);
                this.connection.setSessionType('stateless');
                this.lockTracker.untrack(config.ddlName);
                lockHandle = undefined;
                this.logger?.info?.('View unlocked');
            }
            // 5. Final check (no stateful needed)
            this.logger?.info?.('Step 5: Final check');
            await (0, check_1.checkDdl)(this.connection, config.ddlName, 'inactive', undefined, this.logger);
            this.logger?.info?.('Final check passed');
            // 6. Activate (if requested, no stateful needed - uses same session/cookies)
            if (options?.activateOnUpdate) {
                this.logger?.info?.('Step 6: Activating view');
                const activateResponse = await (0, activation_1.activateDDLS)(this.connection, config.ddlName);
                this.logger?.info?.('View activated, status:', activateResponse.status);
                // 6.5. Read with long polling to ensure object is ready after activation
                this.logger?.info?.('read (wait for object ready after activation)');
                try {
                    const readState = await this.read({ ddlName: config.ddlName }, 'active', { withLongPolling: true });
                    if (readState) {
                        return {
                            readResult: activateResponse,
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
                    readResult: activateResponse,
                    errors: [],
                };
            }
            // Read and return result (no stateful needed)
            const readResponse = await (0, read_1.getDdlSource)(this.connection, config.ddlName, 'inactive');
            const _ddlSource = typeof readResponse.data === 'string'
                ? readResponse.data
                : JSON.stringify(readResponse.data);
            return {
                readResult: readResponse,
                errors: [],
            };
        }
        catch (error) {
            // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking view during error cleanup');
                    this.connection.setSessionType('stateful');
                    await (0, unlock_1.unlockDDLS)(this.connection, config.ddlName, lockHandle);
                    this.connection.setSessionType('stateless');
                    this.lockTracker.untrack(config.ddlName);
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
                    this.logger?.warn?.('Deleting view after failure');
                    // No stateful needed - delete doesn't use lock/unlock
                    await (0, delete_1.deleteDdl)(this.connection, {
                        ddl_name: config.ddlName,
                        transport_request: config.transportRequest,
                    });
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete view after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
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
     * Delete view
     */
    async delete(config) {
        if (!config.ddlName) {
            throw new Error('View name is required');
        }
        try {
            // Check for deletion (no stateful needed)
            this.logger?.info?.('Checking view for deletion');
            const deletionCheck = await (0, delete_1.checkDeletion)(this.connection, {
                ddl_name: config.ddlName,
                transport_request: config.transportRequest,
            });
            // ADT already said whether this may be deleted; refusing to read that
            // answer is how a delete came to report success while the object
            // stayed. Throws on isDeletable=false or a message of type E; a W
            // is a warning and passes.
            (0, deletionCheck_1.assertDeletable)(deletionCheck.data);
            this.logger?.info?.('Deletion check passed');
            // Delete (no stateful needed - no lock/unlock)
            this.logger?.info?.('Deleting view');
            const result = await (0, delete_1.deleteDdl)(this.connection, {
                ddl_name: config.ddlName,
                transport_request: config.transportRequest,
            });
            this.logger?.info?.('View deleted');
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
     * Activate view
     * No stateful needed - uses same session/cookies
     */
    async activate(config) {
        if (!config.ddlName) {
            throw new Error('View name is required');
        }
        try {
            const result = await (0, activation_1.activateDDLS)(this.connection, config.ddlName);
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
     * Check view
     */
    async check(config, status) {
        if (!config.ddlName) {
            throw new Error('View name is required');
        }
        // Map status to version
        const version = status === 'active' ? 'active' : 'inactive';
        // Support ddlSource for checking with source code (standard operation)
        const sourceCode = config.ddlSource;
        return {
            checkResult: await (0, check_1.checkDdl)(this.connection, config.ddlName, version, sourceCode, this.logger),
            errors: [],
        };
    }
    /**
     * Lock view for modification
     */
    async lock(config) {
        if (!config.ddlName) {
            throw new Error('View name is required');
        }
        this.connection.setSessionType('stateful');
        const lockHandle = await (0, lock_1.lockDDLS)(this.connection, config.ddlName);
        this.lockTracker.track(config.ddlName, lockHandle);
        return lockHandle;
    }
    /**
     * Unlock view
     */
    async unlock(config, lockHandle) {
        if (!config.ddlName) {
            throw new Error('View name is required');
        }
        this.connection.setSessionType('stateful');
        const result = await (0, unlock_1.unlockDDLS)(this.connection, config.ddlName, lockHandle);
        this.connection.setSessionType('stateless');
        this.lockTracker.untrack(config.ddlName);
        return {
            unlockResult: result,
            errors: [],
        };
    }
    getVersions(config) {
        return (0, versions_1.getDdlVersions)(this.connection, config);
    }
    getVersionSource(contentUri) {
        return (0, versions_1.getDdlVersionSource)(this.connection, contentUri);
    }
}
exports.AdtDdl = AdtDdl;
