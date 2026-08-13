"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtFunctionGroup = void 0;
const criticalSection_1 = require("../../utils/criticalSection");
const deletionCheck_1 = require("../../utils/deletionCheck");
const internalUtils_1 = require("../../utils/internalUtils");
const LockRegistry_1 = require("../shared/LockRegistry");
const versions_1 = require("../shared/versions");
const activation_1 = require("./activation");
const check_1 = require("./check");
const create_1 = require("./create");
const delete_1 = require("./delete");
const lock_1 = require("./lock");
const read_1 = require("./read");
const update_1 = require("./update");
const validation_1 = require("./validation");
class AdtFunctionGroup {
    connection;
    logger;
    systemContext;
    contentTypes;
    lockTracker;
    objectType = 'FunctionGroup';
    constructor(connection, logger, systemContext, contentTypes, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
        this.contentTypes = contentTypes;
        this.lockTracker = (0, LockRegistry_1.createLockTracker)(lockRegistry, this.objectType, (functionGroupName, lockHandle) => (0, lock_1.unlockFunctionGroup)(this.connection, functionGroupName, lockHandle));
    }
    /**
     * Validate function group configuration before creation
     */
    async validate(config) {
        if (!config.functionGroupName) {
            throw new Error('Function group name is required for validation');
        }
        return {
            validationResponse: await (0, validation_1.validateFunctionGroupName)(this.connection, config.functionGroupName, config.packageName, config.description),
            errors: [],
        };
    }
    /**
     * Create function group with full operation chain
     * Note: Function groups are containers, so no source code update after create
     */
    async create(config, options) {
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        if (!config.packageName) {
            throw new Error('Package name is required');
        }
        if (!config.description) {
            throw new Error('Description is required');
        }
        let objectCreated = false;
        const _sessionId = this.connection.getSessionId?.() || '';
        try {
            // 1. Validate (no stateful needed)
            this.logger?.info?.('Step 1: Validating function group configuration');
            try {
                const validationResponse = await (0, validation_1.validateFunctionGroupName)(this.connection, config.functionGroupName, config.packageName, config.description);
                // Check SEVERITY in response body (HTTP 200 can still contain validation errors)
                const responseData = typeof validationResponse.data === 'string'
                    ? validationResponse.data
                    : '';
                const severityMatch = responseData.match(/<SEVERITY>([^<]+)<\/SEVERITY>/);
                if (severityMatch?.[1] === 'ERROR') {
                    const shortTextMatch = responseData.match(/<SHORT_TEXT>([^<]+)<\/SHORT_TEXT>/);
                    throw new Error(shortTextMatch?.[1] || 'Function group validation failed');
                }
                this.logger?.info?.('Validation passed');
            }
            catch (error) {
                const e = error;
                // Ignore "Kerberos library not loaded" error for FunctionGroup (test cloud issue)
                const errorMessage = e.response?.data || e.message || String(error);
                const errorText = typeof errorMessage === 'string'
                    ? errorMessage
                    : JSON.stringify(errorMessage);
                if (errorText.toLowerCase().includes('kerberos library not loaded')) {
                    this.logger?.warn?.('Validation returned Kerberos error (ignoring): Kerberos library not loaded');
                    // Continue - this is a known issue in test environments
                }
                else {
                    throw error; // Re-throw other errors
                }
            }
            // 2. Create (no stateful needed)
            this.logger?.info?.('Step 2: Creating function group');
            await (0, create_1.create)(this.connection, {
                functionGroupName: config.functionGroupName,
                packageName: config.packageName,
                transportRequest: config.transportRequest,
                description: config.description,
                masterSystem: config.masterSystem ?? this.systemContext.masterSystem,
                responsible: config.responsible ?? this.systemContext.responsible,
                masterLanguage: config.masterLanguage ?? this.systemContext.masterLanguage,
            }, this.logger, this.contentTypes);
            this.logger?.info?.('Function group created');
            // 2.5. Read with long polling to ensure object is ready
            // Read 'inactive' version since object is not yet activated
            this.logger?.info?.('read (wait for object ready)');
            try {
                await this.read({ functionGroupName: config.functionGroupName }, 'inactive', { withLongPolling: true });
                this.logger?.info?.('object is ready after creation');
            }
            catch (readError) {
                this.logger?.warn?.('read with long polling failed (object may not be ready yet):', (0, internalUtils_1.safeErrorMessage)(readError));
                // Continue anyway - check might still work
            }
            objectCreated = true;
            // 3. Check after create (no stateful needed)
            this.logger?.info?.('Step 3: Checking created function group');
            await (0, check_1.checkFunctionGroup)(this.connection, config.functionGroupName, 'inactive');
            this.logger?.info?.('Check after create passed');
            // Note: Function groups are containers - no source code to update after create
            // 4. Activate (if requested, no stateful needed - uses same session/cookies)
            if (options?.activateOnCreate) {
                this.logger?.info?.('Step 4: Activating function group');
                const activateResponse = await (0, activation_1.activateFunctionGroup)(this.connection, config.functionGroupName);
                this.logger?.info?.('Function group activated, status:', activateResponse.status);
                // 4.5. Read with long polling to ensure object is ready after activation
                this.logger?.info?.('read (wait for object ready after activation)');
                try {
                    const readState = await this.read({ functionGroupName: config.functionGroupName }, 'active', { withLongPolling: true });
                    if (readState) {
                        return {
                            createResult: activateResponse,
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
                    createResult: activateResponse,
                    errors: [],
                };
            }
            // Read and return result (no stateful needed)
            // Wrap in try-catch: on cloud systems the object may not be immediately
            // readable after creation due to eventual consistency (HTTP 404).
            try {
                const readResponse = await (0, read_1.getFunctionGroup)(this.connection, config.functionGroupName);
                return {
                    createResult: readResponse,
                    errors: [],
                };
            }
            catch (readError) {
                const status = readError?.response?.status;
                if (status === 404) {
                    this.logger?.warn?.('Post-create read returned 404 (cloud eventual consistency), retrying after delay');
                    await new Promise((r) => setTimeout(r, 5000));
                    try {
                        const retryResponse = await (0, read_1.getFunctionGroup)(this.connection, config.functionGroupName);
                        return {
                            createResult: retryResponse,
                            errors: [],
                        };
                    }
                    catch (retryError) {
                        this.logger?.warn?.('Post-create read retry also failed, returning without read result', retryError);
                        return { errors: [] };
                    }
                }
                throw readError;
            }
        }
        catch (error) {
            // Ensure stateless if needed
            this.connection.setSessionType('stateless');
            if (objectCreated && options?.deleteOnFailure) {
                try {
                    this.logger?.warn?.('Deleting function group after failure');
                    // No stateful needed - delete doesn't use lock/unlock
                    await (0, delete_1.deleteFunctionGroup)(this.connection, {
                        function_group_name: config.functionGroupName,
                        transport_request: config.transportRequest,
                    });
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete function group after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
                }
            }
            this.logger?.error('Create failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read function group
     */
    async read(config, _version, options) {
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        try {
            const response = await (0, read_1.getFunctionGroup)(this.connection, config.functionGroupName, options);
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
     * Read function group metadata (object characteristics: package, responsible, description, etc.)
     * For function groups, read() already returns metadata since there's no source code.
     */
    async readMetadata(config, options) {
        const state = { errors: [] };
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
            // For objects without source code, read() already returns metadata
            const readState = await this.read(config, options?.version ?? 'active', options);
            if (readState) {
                state.metadataResult = readState.readResult;
                state.readResult = readState.readResult;
            }
            else {
                const error = new Error(`Function group '${config.functionGroupName}' not found`);
                state.errors.push({
                    method: 'readMetadata',
                    error,
                    timestamp: new Date(),
                });
                throw error;
            }
            this.logger?.info?.('Function group metadata read successfully');
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
     * Read transport request information for the function group
     */
    async readTransport(config, options) {
        const state = { errors: [] };
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
            const response = await (0, read_1.getFunctionGroupTransport)(this.connection, config.functionGroupName, options?.withLongPolling !== undefined
                ? { withLongPolling: options.withLongPolling }
                : undefined);
            state.transportResult = response;
            this.logger?.info?.('Function group transport request read successfully');
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
     * Update function group with full operation chain
     * Always starts with lock
     * Note: Function groups only support metadata updates (description)
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    async update(config, options) {
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        if (!config.description) {
            throw new Error('Description is required for update');
        }
        // Low-level mode: if lockHandle is provided, perform only update operation
        if (options?.lockHandle) {
            this.logger?.info?.('Low-level update: performing update only (lockHandle provided)');
            const updateResponse = await (0, update_1.updateFunctionGroup)(this.connection, {
                function_group_name: config.functionGroupName,
                description: config.description,
                lock_handle: options.lockHandle,
                transport_request: config.transportRequest,
            }, this.contentTypes);
            this.logger?.info?.('Function group updated (low-level)');
            return {
                updateResult: updateResponse,
                errors: [],
            };
        }
        let lockHandle;
        const sessionId = this.connection.getSessionId?.() || '';
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            // 1. Lock (update always starts with lock, stateful ONLY before lock)
            this.logger?.info?.('Step 1: Locking function group');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockFunctionGroup)(this.connection, config.functionGroupName, sessionId);
            this.lockTracker.track(config.functionGroupName, lockHandle);
            this.logger?.info?.('Function group locked, handle:', lockHandle);
            // 2. Update metadata (description)
            this.logger?.info?.('Step 2: Updating function group metadata');
            await (0, update_1.updateFunctionGroup)(this.connection, {
                function_group_name: config.functionGroupName,
                description: config.description,
                transport_request: config.transportRequest,
                lock_handle: lockHandle,
            }, this.contentTypes);
            this.logger?.info?.('Function group updated');
            // 2.5. Read with long polling to ensure object is ready after update
            this.logger?.info?.('read (wait for object ready after update)');
            try {
                await this.read({ functionGroupName: config.functionGroupName }, 'active', { withLongPolling: true });
                this.logger?.info?.('object is ready after update');
            }
            catch (readError) {
                this.logger?.warn?.('read with long polling failed after update:', (0, internalUtils_1.safeErrorMessage)(readError));
                // Continue anyway - unlock might still work
            }
            // 3. Unlock (obligatory stateless after unlock)
            if (lockHandle) {
                this.logger?.info?.('Step 3: Unlocking function group');
                this.connection.setSessionType('stateful');
                await (0, lock_1.unlockFunctionGroup)(this.connection, config.functionGroupName, lockHandle, sessionId);
                this.connection.setSessionType('stateless');
                this.lockTracker.untrack(config.functionGroupName);
                lockHandle = undefined;
                this.logger?.info?.('Function group unlocked');
            }
            // 4. Final check (no stateful needed)
            this.logger?.info?.('Step 4: Final check');
            await (0, check_1.checkFunctionGroup)(this.connection, config.functionGroupName, 'inactive');
            this.logger?.info?.('Final check passed');
            // 5. Activate (if requested, no stateful needed - uses same session/cookies)
            if (options?.activateOnUpdate) {
                this.logger?.info?.('Step 5: Activating function group');
                const activateResponse = await (0, activation_1.activateFunctionGroup)(this.connection, config.functionGroupName);
                this.logger?.info?.('Function group activated, status:', activateResponse.status);
                // 5.5. Read with long polling to ensure object is ready after activation
                this.logger?.info?.('read (wait for object ready after activation)');
                try {
                    const readState = await this.read({ functionGroupName: config.functionGroupName }, 'active', { withLongPolling: true });
                    if (readState) {
                        return {
                            updateResult: activateResponse,
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
                    updateResult: activateResponse,
                    errors: [],
                };
            }
            // Read and return result (no stateful needed)
            const readResponse = await (0, read_1.getFunctionGroup)(this.connection, config.functionGroupName);
            return {
                updateResult: readResponse,
                errors: [],
            };
        }
        catch (error) {
            // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking function group during error cleanup');
                    this.connection.setSessionType('stateful');
                    await (0, lock_1.unlockFunctionGroup)(this.connection, config.functionGroupName, lockHandle, sessionId);
                    this.connection.setSessionType('stateless');
                    this.lockTracker.untrack(config.functionGroupName);
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
                    this.logger?.warn?.('Deleting function group after failure');
                    // No stateful needed - delete doesn't use lock/unlock
                    await (0, delete_1.deleteFunctionGroup)(this.connection, {
                        function_group_name: config.functionGroupName,
                        transport_request: config.transportRequest,
                    });
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete function group after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
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
     * Delete function group
     */
    async delete(config) {
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        try {
            // Check for deletion (no stateful needed)
            this.logger?.info?.('Checking function group for deletion');
            const deletionCheck = await (0, delete_1.checkDeletion)(this.connection, {
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
            this.logger?.info?.('Deleting function group');
            const result = await (0, delete_1.deleteFunctionGroup)(this.connection, {
                function_group_name: config.functionGroupName,
                transport_request: config.transportRequest,
            });
            this.logger?.info?.('Function group deleted');
            return { deleteResult: result, errors: [] };
        }
        catch (error) {
            this.logger?.error('Delete failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Activate function group
     * No stateful needed - uses same session/cookies
     */
    async activate(config) {
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        try {
            const result = await (0, activation_1.activateFunctionGroup)(this.connection, config.functionGroupName);
            return { activateResult: result, errors: [] };
        }
        catch (error) {
            this.logger?.error('Activate failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Check function group
     */
    async check(config, status) {
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        // Map status to version
        const version = status === 'active' ? 'active' : 'inactive';
        return {
            checkResult: await (0, check_1.checkFunctionGroup)(this.connection, config.functionGroupName, version),
            errors: [],
        };
    }
    /**
     * Lock function group for modification
     */
    async lock(config) {
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        this.connection.setSessionType('stateful');
        const lockHandle = await (0, lock_1.lockFunctionGroup)(this.connection, config.functionGroupName);
        this.lockTracker.track(config.functionGroupName, lockHandle);
        return lockHandle;
    }
    /**
     * Unlock function group
     */
    async unlock(config, lockHandle) {
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        this.connection.setSessionType('stateful');
        const result = await (0, lock_1.unlockFunctionGroup)(this.connection, config.functionGroupName, lockHandle);
        this.connection.setSessionType('stateless');
        this.lockTracker.untrack(config.functionGroupName);
        return {
            unlockResult: result,
            errors: [],
        };
    }
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    async getVersions(_config) {
        (0, versions_1.throwUnsupportedVersions)('function group');
    }
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    async getVersionSource(_contentUri) {
        (0, versions_1.throwUnsupportedVersions)('function group');
    }
}
exports.AdtFunctionGroup = AdtFunctionGroup;
