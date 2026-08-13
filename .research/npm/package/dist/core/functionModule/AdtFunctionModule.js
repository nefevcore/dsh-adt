"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtFunctionModule = void 0;
const criticalSection_1 = require("../../utils/criticalSection");
const deletionCheck_1 = require("../../utils/deletionCheck");
const internalUtils_1 = require("../../utils/internalUtils");
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
class AdtFunctionModule {
    connection;
    logger;
    systemContext;
    contentTypes;
    lockRegistry;
    objectType = 'FunctionModule';
    constructor(connection, logger, systemContext, contentTypes, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
        this.contentTypes = contentTypes;
        this.lockRegistry = lockRegistry;
    }
    /** Registry key for a held lock (nested: group + module). */
    lockKey(group, moduleName) {
        return `${this.objectType}/${group.toUpperCase()}/${moduleName.toUpperCase()}`;
    }
    /** Record a held lock; the unlock thunk needs the parent function group. */
    trackLock(group, moduleName, lockHandle) {
        if (!group || !moduleName)
            return;
        // Raw unlock — LockRegistry.unlockAll() manages the session for the batch.
        this.lockRegistry?.track(this.lockKey(group, moduleName), () => (0, unlock_1.unlockFunctionModule)(this.connection, group, moduleName, lockHandle));
    }
    /** Drop a lock from the registry after a clean unlock. */
    untrackLock(group, moduleName) {
        if (!group || !moduleName)
            return;
        this.lockRegistry?.untrack(this.lockKey(group, moduleName));
    }
    /**
     * Validate function module configuration before creation
     */
    async validate(config) {
        if (!config.functionModuleName) {
            throw new Error('Function module name is required for validation');
        }
        if (!config.functionGroupName) {
            throw new Error('Function group name is required for validation');
        }
        return {
            validationResponse: await (0, validation_1.validateFunctionModuleName)(this.connection, config.functionGroupName, config.functionModuleName, config.description),
            errors: [],
        };
    }
    /**
     * Create function module with full operation chain
     */
    async create(config, options) {
        if (!config.functionModuleName) {
            throw new Error('Function module name is required');
        }
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        if (!config.description) {
            throw new Error('Description is required');
        }
        let objectCreated = false;
        const state = {
            errors: [],
        };
        try {
            // Create function module
            this.logger?.info?.('Creating function module');
            const createResult = await (0, create_1.create)(this.connection, {
                functionGroupName: config.functionGroupName,
                functionModuleName: config.functionModuleName,
                transportRequest: config.transportRequest,
                description: config.description,
                masterSystem: config.masterSystem ?? this.systemContext.masterSystem,
                responsible: config.responsible ?? this.systemContext.responsible,
            });
            objectCreated = true;
            state.createResult = createResult;
            this.logger?.info?.('Function module created');
            return state;
        }
        catch (error) {
            // Cleanup on error - ensure stateless
            this.connection.setSessionType('stateless');
            if (objectCreated && options?.deleteOnFailure) {
                try {
                    this.logger?.warn?.('Deleting function module after failure');
                    // No stateful needed - delete doesn't use lock/unlock
                    await (0, delete_1.deleteFunctionModule)(this.connection, {
                        function_module_name: config.functionModuleName,
                        function_group_name: config.functionGroupName,
                        transport_request: config.transportRequest,
                    });
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete function module after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
                }
            }
            this.logger?.error('Create failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read function module
     */
    async read(config, version, options) {
        if (!config.functionModuleName) {
            throw new Error('Function module name is required');
        }
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        try {
            const response = await (0, read_1.getFunctionSource)(this.connection, config.functionModuleName, config.functionGroupName, version, options);
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
     * Read function module metadata (object characteristics: package, responsible, description, etc.)
     */
    async readMetadata(config, options) {
        const state = { errors: [] };
        if (!config.functionModuleName) {
            const error = new Error('Function module name is required');
            state.errors.push({
                method: 'readMetadata',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        if (!config.functionGroupName) {
            const error = new Error('Function group name is required');
            state.errors.push({
                method: 'readMetadata',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getFunctionMetadata)(this.connection, config.functionModuleName, config.functionGroupName, options);
            state.metadataResult = response;
            this.logger?.info?.('Function module metadata read successfully');
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
     * Read transport request information for the function module
     */
    async readTransport(config, options) {
        const state = { errors: [] };
        if (!config.functionModuleName) {
            const error = new Error('Function module name is required');
            state.errors.push({
                method: 'readTransport',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        if (!config.functionGroupName) {
            const error = new Error('Function group name is required');
            state.errors.push({
                method: 'readTransport',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getFunctionModuleTransport)(this.connection, config.functionModuleName, config.functionGroupName, options?.withLongPolling !== undefined
                ? { withLongPolling: options.withLongPolling }
                : undefined);
            state.transportResult = response;
            this.logger?.info?.('Function module transport request read successfully');
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
     * Update function module with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    async update(config, options) {
        if (!config.functionModuleName) {
            throw new Error('Function module name is required');
        }
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        // Low-level mode: if lockHandle is provided, perform only update operation
        if (options?.lockHandle) {
            const codeToUpdate = options?.sourceCode || config.sourceCode;
            if (!codeToUpdate) {
                throw new Error('Source code is required for update');
            }
            this.logger?.info?.('Low-level update: performing update only (lockHandle provided)');
            const updateResponse = await (0, update_1.update)(this.connection, {
                functionModuleName: config.functionModuleName,
                functionGroupName: config.functionGroupName,
                sourceCode: codeToUpdate,
                lockHandle: options.lockHandle,
                transportRequest: config.transportRequest,
            }, this.contentTypes);
            this.logger?.info?.('Function module updated (low-level)');
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
            this.logger?.info?.('Step 1: Locking function module');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockFunctionModule)(this.connection, config.functionGroupName, config.functionModuleName);
            this.trackLock(config.functionGroupName, config.functionModuleName, lockHandle);
            this.logger?.info?.('Function module locked, handle:', lockHandle);
            // 2. Check inactive with code for update (from options or config)
            const codeToCheck = options?.sourceCode || config.sourceCode;
            if (codeToCheck) {
                this.logger?.info?.('Step 2: Checking inactive version with update content');
                await (0, check_1.checkFunctionModule)(this.connection, config.functionGroupName, config.functionModuleName, 'inactive', codeToCheck, this.contentTypes);
                this.logger?.info?.('Check inactive with update content passed');
            }
            // 3. Update
            if (codeToCheck && lockHandle) {
                this.logger?.info?.('Step 3: Updating function module');
                await (0, update_1.update)(this.connection, {
                    functionGroupName: config.functionGroupName,
                    functionModuleName: config.functionModuleName,
                    sourceCode: codeToCheck,
                    lockHandle,
                    transportRequest: config.transportRequest,
                }, this.contentTypes);
                this.logger?.info?.('Function module updated');
                // Poll the inactive version: the write above produced it; the active version may not exist yet.
                // 3.5. Read with long polling (wait for object to be ready after update)
                this.logger?.info?.('read (wait for object ready after update)');
                try {
                    await this.read({
                        functionModuleName: config.functionModuleName,
                        functionGroupName: config.functionGroupName,
                    }, 'inactive', { withLongPolling: true });
                    this.logger?.info?.('object is ready after update');
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed (object may not be ready yet):', (0, internalUtils_1.safeErrorMessage)(readError));
                    // Continue anyway - unlock might still work
                }
            }
            // 4. Unlock (obligatory stateless after unlock)
            if (lockHandle) {
                this.logger?.info?.('Step 4: Unlocking function module');
                this.connection.setSessionType('stateful');
                await (0, unlock_1.unlockFunctionModule)(this.connection, config.functionGroupName, config.functionModuleName, lockHandle);
                this.connection.setSessionType('stateless');
                this.untrackLock(config.functionGroupName, config.functionModuleName);
                lockHandle = undefined;
                this.logger?.info?.('Function module unlocked');
            }
            // 5. Final check (no stateful needed)
            this.logger?.info?.('Step 5: Final check');
            await (0, check_1.checkFunctionModule)(this.connection, config.functionGroupName, config.functionModuleName, 'inactive', undefined, this.contentTypes);
            this.logger?.info?.('Final check passed');
            // 6. Activate (if requested, no stateful needed - uses same session/cookies)
            if (options?.activateOnUpdate) {
                this.logger?.info?.('Step 6: Activating function module');
                const activateResponse = await (0, activation_1.activateFunctionModule)(this.connection, config.functionGroupName, config.functionModuleName);
                this.logger?.info?.('Function module activated, status:', activateResponse.status);
                // 6.5. Read with long polling (wait for object to be ready after activation)
                this.logger?.info?.('read (wait for object ready after activation)');
                try {
                    await this.read({
                        functionModuleName: config.functionModuleName,
                        functionGroupName: config.functionGroupName,
                    }, 'active', { withLongPolling: true });
                    this.logger?.info?.('object is ready after activation');
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed (object may not be ready yet):', (0, internalUtils_1.safeErrorMessage)(readError));
                    // Continue anyway - return activation response
                }
                return {
                    updateResult: activateResponse,
                    errors: [],
                };
            }
            // Read and return result (no stateful needed)
            const readResponse = await (0, read_1.getFunctionSource)(this.connection, config.functionModuleName, config.functionGroupName);
            const _sourceCode = typeof readResponse.data === 'string'
                ? readResponse.data
                : JSON.stringify(readResponse.data);
            return {
                updateResult: readResponse,
                errors: [],
            };
        }
        catch (error) {
            // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking function module during error cleanup');
                    this.connection.setSessionType('stateful');
                    await (0, unlock_1.unlockFunctionModule)(this.connection, config.functionGroupName, config.functionModuleName, lockHandle);
                    this.connection.setSessionType('stateless');
                    this.untrackLock(config.functionGroupName, config.functionModuleName);
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
                    this.logger?.warn?.('Deleting function module after failure');
                    // No stateful needed - delete doesn't use lock/unlock
                    await (0, delete_1.deleteFunctionModule)(this.connection, {
                        function_module_name: config.functionModuleName,
                        function_group_name: config.functionGroupName,
                        transport_request: config.transportRequest,
                    });
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete function module after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
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
     * Delete function module
     */
    async delete(config) {
        if (!config.functionModuleName) {
            throw new Error('Function module name is required');
        }
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        try {
            // Check for deletion (no stateful needed)
            this.logger?.info?.('Checking function module for deletion');
            const deletionCheck = await (0, delete_1.checkDeletion)(this.connection, {
                function_module_name: config.functionModuleName,
                function_group_name: config.functionGroupName,
                transport_request: config.transportRequest,
            });
            // ADT already said whether this may be deleted; refusing to read that
            // answer is how a delete came to report success while the object
            // stayed. Throws on isDeletable=false or a message of type E; a W
            // is a warning and passes.
            (0, deletionCheck_1.assertDeletable)(deletionCheck.data);
            this.logger?.info?.('Deletion check passed');
            // Delete (no stateful needed - no lock/unlock)
            this.logger?.info?.('Deleting function module');
            const result = await (0, delete_1.deleteFunctionModule)(this.connection, {
                function_module_name: config.functionModuleName,
                function_group_name: config.functionGroupName,
                transport_request: config.transportRequest,
            });
            this.logger?.info?.('Function module deleted');
            return { deleteResult: result, errors: [] };
        }
        catch (error) {
            this.logger?.error('Delete failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Activate function module
     * No stateful needed - uses same session/cookies
     */
    async activate(config) {
        if (!config.functionModuleName) {
            throw new Error('Function module name is required');
        }
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        try {
            const result = await (0, activation_1.activateFunctionModule)(this.connection, config.functionGroupName, config.functionModuleName);
            return { activateResult: result, errors: [] };
        }
        catch (error) {
            this.logger?.error('Activate failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Check function module
     */
    async check(config, status) {
        if (!config.functionModuleName) {
            throw new Error('Function module name is required');
        }
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        // Map status to version
        const version = status === 'active' ? 'active' : 'inactive';
        return {
            checkResult: await (0, check_1.checkFunctionModule)(this.connection, config.functionGroupName, config.functionModuleName, version, undefined, this.contentTypes),
            errors: [],
        };
    }
    /**
     * Lock function module for modification
     */
    async lock(config) {
        if (!config.functionModuleName || !config.functionGroupName) {
            throw new Error('Function module name and function group name are required');
        }
        this.connection.setSessionType('stateful');
        const lockHandle = await (0, lock_1.lockFunctionModule)(this.connection, config.functionGroupName, config.functionModuleName);
        this.trackLock(config.functionGroupName, config.functionModuleName, lockHandle);
        return lockHandle;
    }
    /**
     * Unlock function module
     */
    async unlock(config, lockHandle) {
        if (!config.functionModuleName || !config.functionGroupName) {
            throw new Error('Function module name and function group name are required');
        }
        this.connection.setSessionType('stateful');
        const result = await (0, unlock_1.unlockFunctionModule)(this.connection, config.functionGroupName, config.functionModuleName, lockHandle);
        this.connection.setSessionType('stateless');
        this.untrackLock(config.functionGroupName, config.functionModuleName);
        return {
            unlockResult: result,
            errors: [],
        };
    }
    getVersions(config) {
        return (0, versions_1.getFunctionModuleVersions)(this.connection, config);
    }
    getVersionSource(contentUri) {
        return (0, versions_1.getFunctionModuleVersionSource)(this.connection, contentUri);
    }
}
exports.AdtFunctionModule = AdtFunctionModule;
