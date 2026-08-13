"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtBehaviorDefinition = void 0;
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
class AdtBehaviorDefinition {
    connection;
    logger;
    systemContext;
    lockTracker;
    objectType = 'BehaviorDefinition';
    constructor(connection, logger, systemContext, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
        this.lockTracker = (0, LockRegistry_1.createLockTracker)(lockRegistry, this.objectType, (name, lockHandle) => (0, unlock_1.unlock)(this.connection, name, lockHandle));
    }
    /**
     * Validate behavior definition configuration before creation
     */
    async validate(config) {
        const state = { errors: [] };
        if (!config.name) {
            const error = new Error('Behavior definition name is required for validation');
            state.errors.push({ method: 'validate', error, timestamp: new Date() });
            throw error;
        }
        if (!config.rootEntity) {
            const error = new Error('Root entity is required for validation');
            state.errors.push({ method: 'validate', error, timestamp: new Date() });
            throw error;
        }
        if (!config.packageName) {
            const error = new Error('Package name is required for validation');
            state.errors.push({ method: 'validate', error, timestamp: new Date() });
            throw error;
        }
        if (!config.implementationType) {
            const error = new Error('Implementation type is required for validation');
            state.errors.push({ method: 'validate', error, timestamp: new Date() });
            throw error;
        }
        try {
            const response = await (0, validation_1.validate)(this.connection, {
                objname: config.name,
                rootEntity: config.rootEntity,
                description: config.description || config.name,
                package: config.packageName,
                implementationType: config.implementationType,
            });
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
            this.logger?.error('Validate failed:', (0, internalUtils_1.safeErrorMessage)(err));
            throw err;
        }
    }
    /**
     * Create behavior definition with full operation chain
     */
    async create(config, options) {
        const state = { errors: [] };
        if (!config.name) {
            throw new Error('Behavior definition name is required');
        }
        if (!config.packageName) {
            throw new Error('Package name is required');
        }
        if (!config.description) {
            throw new Error('Description is required');
        }
        if (!config.rootEntity) {
            throw new Error('Root entity is required');
        }
        if (!config.implementationType) {
            throw new Error('Implementation type is required');
        }
        let objectCreated = false;
        try {
            // Create behavior definition
            this.logger?.info?.('Creating behavior definition');
            const createResponse = await (0, create_1.create)(this.connection, {
                name: config.name,
                package: config.packageName,
                description: config.description,
                implementationType: config.implementationType,
                transportRequest: config.transportRequest,
                language: config.masterLanguage ?? this.systemContext.masterLanguage,
                masterSystem: this.systemContext.masterSystem,
                responsible: this.systemContext.responsible,
            });
            state.createResult = createResponse;
            objectCreated = true;
            this.logger?.info?.('Behavior definition created');
            return state;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            state.errors.push({
                method: 'create',
                error: err,
                timestamp: new Date(),
            });
            // Cleanup on error - ensure stateless
            this.connection.setSessionType('stateless');
            if (objectCreated && options?.deleteOnFailure) {
                try {
                    this.logger?.warn?.('Deleting behavior definition after failure');
                    // No stateful needed - delete doesn't use lock/unlock
                    await (0, delete_1.deleteBehaviorDefinition)(this.connection, config.name, config.transportRequest);
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete behavior definition after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
                }
            }
            this.logger?.error('Create failed:', (0, internalUtils_1.safeErrorMessage)(err));
            throw err;
        }
    }
    /**
     * Read behavior definition
     */
    async read(config, version, options) {
        const state = { errors: [] };
        if (!config.name) {
            const error = new Error('Behavior definition name is required');
            state.errors.push({ method: 'read', error, timestamp: new Date() });
            throw error;
        }
        try {
            const response = await (0, read_1.readSource)(this.connection, config.name, version, options, this.logger);
            state.readResult = response;
            return state;
        }
        catch (error) {
            const e = error;
            if (e.response?.status === 404) {
                return undefined;
            }
            const err = error instanceof Error ? error : new Error(String(error));
            state.errors.push({ method: 'read', error: err, timestamp: new Date() });
            this.logger?.error('Read failed:', (0, internalUtils_1.safeErrorMessage)(err));
            throw err;
        }
    }
    /**
     * Read behavior definition metadata (object characteristics: package, responsible, description, etc.)
     */
    async readMetadata(config, options) {
        const state = { errors: [] };
        if (!config.name) {
            const error = new Error('Behavior definition name is required');
            state.errors.push({
                method: 'readMetadata',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            // Use empty sessionId for metadata read
            const response = await (0, read_1.read)(this.connection, config.name, '', 'inactive', options, this.logger);
            state.metadataResult = response;
            this.logger?.info?.('Behavior definition metadata read successfully');
            return state;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            state.errors.push({
                method: 'readMetadata',
                error: err,
                timestamp: new Date(),
            });
            this.logger?.error('Read metadata failed:', (0, internalUtils_1.safeErrorMessage)(err));
            throw err;
        }
    }
    /**
     * Read transport request information for the behavior definition
     */
    async readTransport(config, options) {
        const state = { errors: [] };
        if (!config.name) {
            const error = new Error('Behavior definition name is required');
            state.errors.push({
                method: 'readTransport',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getBehaviorDefinitionTransport)(this.connection, config.name, options?.withLongPolling !== undefined
                ? { withLongPolling: options.withLongPolling }
                : undefined);
            state.transportResult = response;
            this.logger?.info?.('Behavior definition transport request read successfully');
            return state;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            state.errors.push({
                method: 'readTransport',
                error: err,
                timestamp: new Date(),
            });
            this.logger?.error('Read transport failed:', (0, internalUtils_1.safeErrorMessage)(err));
            throw err;
        }
    }
    /**
     * Update behavior definition with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    async update(config, options) {
        const state = { errors: [] };
        if (!config.name) {
            const error = new Error('Behavior definition name is required');
            state.errors.push({ method: 'update', error, timestamp: new Date() });
            throw error;
        }
        // Low-level mode: if lockHandle is provided, perform only update operation
        if (options?.lockHandle) {
            const codeToUpdate = options?.sourceCode || config.sourceCode;
            if (!codeToUpdate) {
                throw new Error('Source code is required for update');
            }
            this.logger?.info?.('Low-level update: performing update only (lockHandle provided)');
            const updateResponse = await (0, update_1.update)(this.connection, {
                name: config.name,
                sourceCode: codeToUpdate,
                lockHandle: options.lockHandle,
                transportRequest: config.transportRequest,
            });
            this.logger?.info?.('Behavior definition updated (low-level)');
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
            this.logger?.info?.('Step 1: Locking behavior definition');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lock)(this.connection, config.name);
            state.lockHandle = lockHandle;
            this.lockTracker.track(config.name, lockHandle);
            this.logger?.info?.('Behavior definition locked, handle:', lockHandle);
            // 2. Check inactive with code for update (from options or config)
            const codeToCheck = options?.sourceCode || config.sourceCode;
            if (codeToCheck) {
                this.logger?.info?.('Step 2: Checking inactive version with update content');
                const checkInactiveResponse = await (0, check_1.check)(this.connection, config.name, 'abapCheckRun', '', 'inactive', codeToCheck);
                state.checkResult = checkInactiveResponse;
                this.logger?.info?.('Check inactive with update content passed');
            }
            // 3. Update
            if (codeToCheck && lockHandle) {
                this.logger?.info?.('Step 3: Updating behavior definition');
                const updateResponse = await (0, update_1.update)(this.connection, {
                    name: config.name,
                    sourceCode: codeToCheck,
                    lockHandle,
                    transportRequest: config.transportRequest,
                });
                state.updateResult = updateResponse;
                this.logger?.info?.('Behavior definition updated');
                // Poll the inactive version: the write above produced it; the active version may not exist yet.
                // 3.5. Read with long polling (wait for object to be ready after update)
                this.logger?.info?.('read (wait for object ready after update)');
                try {
                    await this.read({ name: config.name }, 'inactive', {
                        withLongPolling: true,
                    });
                    this.logger?.info?.('object is ready after update');
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed (object may not be ready yet):', (0, internalUtils_1.safeErrorMessage)(readError));
                    // Continue anyway - unlock might still work
                }
            }
            // 4. Unlock (obligatory stateless after unlock)
            if (lockHandle) {
                this.logger?.info?.('Step 4: Unlocking behavior definition');
                this.connection.setSessionType('stateful');
                const unlockResponse = await (0, unlock_1.unlock)(this.connection, config.name, lockHandle);
                state.unlockResult = unlockResponse;
                this.connection.setSessionType('stateless');
                this.lockTracker.untrack(config.name);
                lockHandle = undefined;
                this.logger?.info?.('Behavior definition unlocked');
            }
            // 5. Final check (no stateful needed)
            this.logger?.info?.('Step 5: Final check');
            const finalCheckResponse = await (0, check_1.check)(this.connection, config.name, 'bdefImplementationCheck', '', 'inactive');
            state.checkResult = finalCheckResponse;
            this.logger?.info?.('Final check passed');
            // 6. Activate (if requested, no stateful needed - uses same session/cookies)
            if (options?.activateOnUpdate) {
                this.logger?.info?.('Step 6: Activating behavior definition');
                const activateResponse = await (0, activation_1.activate)(this.connection, config.name);
                state.activateResult = activateResponse;
                this.logger?.info?.('Behavior definition activated, status:', activateResponse.status);
                // 6.5. Read with long polling (wait for object to be ready after activation)
                this.logger?.info?.('read (wait for object ready after activation)');
                try {
                    await this.read({ name: config.name }, 'active', {
                        withLongPolling: true,
                    });
                    this.logger?.info?.('object is ready after activation');
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed (object may not be ready yet):', (0, internalUtils_1.safeErrorMessage)(readError));
                    // Continue anyway - return state with activation result
                }
                return state;
            }
            // Read and return result (no stateful needed)
            const readResponse = await (0, read_1.readSource)(this.connection, config.name, 'inactive', undefined, this.logger);
            state.readResult = readResponse;
            return state;
        }
        catch (error) {
            // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking behavior definition during error cleanup');
                    this.connection.setSessionType('stateful');
                    await (0, unlock_1.unlock)(this.connection, config.name, lockHandle);
                    this.connection.setSessionType('stateless');
                    this.lockTracker.untrack(config.name);
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
                    this.logger?.warn?.('Deleting behavior definition after failure');
                    // No stateful needed - delete doesn't use lock/unlock
                    await (0, delete_1.deleteBehaviorDefinition)(this.connection, config.name, config.transportRequest);
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete behavior definition after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
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
     * Delete behavior definition
     */
    async delete(config) {
        const state = { errors: [] };
        if (!config.name) {
            const error = new Error('Behavior definition name is required');
            state.errors.push({ method: 'delete', error, timestamp: new Date() });
            throw error;
        }
        try {
            // Check for deletion (no stateful needed)
            this.logger?.info?.('Checking behavior definition for deletion');
            const deletionCheck = await (0, delete_1.checkDeletion)(this.connection, config.name);
            // ADT already said whether this may be deleted; refusing to read that
            // answer is how a delete came to report success while the object
            // stayed. Throws on isDeletable=false or a message of type E; a W
            // is a warning and passes.
            (0, deletionCheck_1.assertDeletable)(deletionCheck.data);
            this.logger?.info?.('Deletion check passed');
            // Delete (no stateful needed - no lock/unlock)
            this.logger?.info?.('Deleting behavior definition');
            const result = await (0, delete_1.deleteBehaviorDefinition)(this.connection, config.name, config.transportRequest);
            state.deleteResult = result;
            this.logger?.info?.('Behavior definition deleted');
            return state;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            state.errors.push({
                method: 'delete',
                error: err,
                timestamp: new Date(),
            });
            this.logger?.error('Delete failed:', (0, internalUtils_1.safeErrorMessage)(err));
            throw err;
        }
    }
    /**
     * Activate behavior definition
     * No stateful needed - uses same session/cookies
     */
    async activate(config) {
        const state = { errors: [] };
        if (!config.name) {
            const error = new Error('Behavior definition name is required');
            state.errors.push({ method: 'activate', error, timestamp: new Date() });
            throw error;
        }
        try {
            const result = await (0, activation_1.activate)(this.connection, config.name);
            state.activateResult = result;
            return state;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            state.errors.push({
                method: 'activate',
                error: err,
                timestamp: new Date(),
            });
            this.logger?.error('Activate failed:', (0, internalUtils_1.safeErrorMessage)(err));
            throw err;
        }
    }
    /**
     * Check behavior definition
     */
    async check(config, status) {
        const state = { errors: [] };
        if (!config.name) {
            const error = new Error('Behavior definition name is required');
            state.errors.push({ method: 'check', error, timestamp: new Date() });
            throw error;
        }
        try {
            // Map status to version
            const version = status === 'active' ? 'active' : 'inactive';
            const response = await (0, check_1.check)(this.connection, config.name, 'bdefImplementationCheck', '', version);
            state.checkResult = response;
            return state;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            state.errors.push({ method: 'check', error: err, timestamp: new Date() });
            this.logger?.error('Check failed:', (0, internalUtils_1.safeErrorMessage)(err));
            throw err;
        }
    }
    /**
     * Lock behavior definition for modification
     */
    async lock(config) {
        if (!config.name) {
            throw new Error('Behavior definition name is required');
        }
        this.connection.setSessionType('stateful');
        const lockHandle = await (0, lock_1.lock)(this.connection, config.name);
        this.lockTracker.track(config.name, lockHandle);
        return lockHandle;
    }
    /**
     * Unlock behavior definition
     */
    async unlock(config, lockHandle) {
        if (!config.name) {
            throw new Error('Behavior definition name is required');
        }
        this.connection.setSessionType('stateful');
        const result = await (0, unlock_1.unlock)(this.connection, config.name, lockHandle);
        this.connection.setSessionType('stateless');
        this.lockTracker.untrack(config.name);
        return {
            unlockResult: result,
            errors: [],
        };
    }
    getVersions(config) {
        return (0, versions_1.getBehaviorDefinitionVersions)(this.connection, config);
    }
    getVersionSource(contentUri) {
        return (0, versions_1.getBehaviorDefinitionVersionSource)(this.connection, contentUri);
    }
}
exports.AdtBehaviorDefinition = AdtBehaviorDefinition;
