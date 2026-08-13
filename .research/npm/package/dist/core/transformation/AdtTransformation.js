"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtTransformation = void 0;
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
class AdtTransformation {
    connection;
    logger;
    systemContext;
    lockTracker;
    objectType = 'Transformation';
    constructor(connection, logger, systemContext, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
        this.lockTracker = (0, LockRegistry_1.createLockTracker)(lockRegistry, this.objectType, (transformationName, lockHandle) => (0, unlock_1.unlockTransformation)(this.connection, transformationName, lockHandle));
    }
    /**
     * Validate transformation configuration before creation
     */
    async validate(config) {
        const state = { errors: [] };
        if (!config.transformationName) {
            const error = new Error('Transformation name is required for validation');
            state.errors.push({ method: 'validate', error, timestamp: new Date() });
            throw error;
        }
        try {
            const response = await (0, validation_1.validateTransformationName)(this.connection, config.transformationName, config.packageName, config.description);
            state.validationResponse = response;
            return state;
        }
        catch (error) {
            // Validation endpoint may not exist on all systems (e.g. cloud trial)
            const e = error;
            if (e.response?.status === 404) {
                this.logger?.warn?.('Validation endpoint not available, skipping validation');
                state.validationResponse = { status: 200, data: '' };
                return state;
            }
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
     * Create transformation with full operation chain
     */
    async create(config, _options) {
        const state = { errors: [] };
        if (!config.transformationName) {
            const error = new Error('Transformation name is required');
            state.errors.push({ method: 'create', error, timestamp: new Date() });
            throw error;
        }
        if (!config.packageName) {
            throw new Error('Package name is required');
        }
        if (!config.description) {
            throw new Error('Description is required');
        }
        if (!config.transformationType) {
            throw new Error('Transformation type is required');
        }
        try {
            // Create transformation
            this.logger?.info?.('Creating transformation');
            const createResponse = await (0, create_1.create)(this.connection, {
                transformation_name: config.transformationName,
                transformation_type: config.transformationType,
                package_name: config.packageName,
                transport_request: config.transportRequest,
                description: config.description,
                masterSystem: this.systemContext.masterSystem,
                responsible: this.systemContext.responsible,
                masterLanguage: config.masterLanguage ?? this.systemContext.masterLanguage,
            });
            state.createResult = createResponse;
            this.logger?.info?.('Transformation created');
            return state;
        }
        catch (error) {
            this.logger?.error('Create failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read transformation source code
     */
    async read(config, version, options) {
        const state = { errors: [] };
        if (!config.transformationName) {
            const error = new Error('Transformation name is required');
            state.errors.push({ method: 'read', error, timestamp: new Date() });
            throw error;
        }
        try {
            const response = await (0, read_1.getTransformationSource)(this.connection, config.transformationName, version, options, this.logger);
            state.readResult = response;
            return state;
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
     * Read transformation metadata (object characteristics: package, responsible, description, etc.)
     */
    async readMetadata(config, options) {
        const state = { errors: [] };
        if (!config.transformationName) {
            const error = new Error('Transformation name is required');
            state.errors.push({
                method: 'readMetadata',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getTransformation)(this.connection, config.transformationName, 'inactive', options, this.logger);
            state.metadataResult = response;
            this.logger?.info?.('Transformation metadata read successfully');
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
     * Read transport request information for the transformation
     */
    async readTransport(config, options) {
        const state = { errors: [] };
        if (!config.transformationName) {
            const error = new Error('Transformation name is required');
            state.errors.push({
                method: 'readTransport',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getTransformationTransport)(this.connection, config.transformationName, options?.withLongPolling !== undefined
                ? { withLongPolling: options.withLongPolling }
                : undefined);
            state.transportResult = response;
            this.logger?.info?.('Transformation transport request read successfully');
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
     * Update transformation with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    async update(config, options) {
        const state = { errors: [] };
        if (!config.transformationName) {
            const error = new Error('Transformation name is required');
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
            const updateResponse = await (0, update_1.updateTransformation)(this.connection, {
                transformation_name: config.transformationName,
                source_code: codeToUpdate,
                transport_request: config.transportRequest,
            }, options.lockHandle);
            this.logger?.info?.('Transformation updated (low-level)');
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
            this.logger?.info?.('Step 1: Locking transformation');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockTransformation)(this.connection, config.transformationName);
            this.lockTracker.track(config.transformationName, lockHandle);
            this.logger?.info?.('Transformation locked, handle:', lockHandle);
            // 2. Check inactive with code for update (from options or config)
            const codeToCheck = options?.sourceCode || config.sourceCode;
            if (codeToCheck) {
                this.logger?.info?.('Step 2: Checking inactive version with update content');
                await (0, check_1.checkTransformation)(this.connection, config.transformationName, 'inactive', codeToCheck);
                this.logger?.info?.('Check inactive with update content passed');
            }
            // 3. Update
            if (codeToCheck && lockHandle) {
                this.logger?.info?.('Step 3: Updating transformation');
                await (0, update_1.updateTransformation)(this.connection, {
                    transformation_name: config.transformationName,
                    source_code: codeToCheck,
                    transport_request: config.transportRequest,
                }, lockHandle);
                this.logger?.info?.('Transformation updated');
                // Poll the inactive version: the write above produced it; the active version may not exist yet.
                // 3.5. Read with long polling (wait for object to be ready after update)
                this.logger?.info?.('read (wait for object ready after update)');
                try {
                    await this.read({ transformationName: config.transformationName }, 'inactive', { withLongPolling: true });
                    this.logger?.info?.('object is ready after update');
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed (object may not be ready yet):', (0, internalUtils_1.safeErrorMessage)(readError));
                    // Continue anyway - unlock might still work
                }
            }
            // 4. Unlock (obligatory stateless after unlock)
            if (lockHandle) {
                this.logger?.info?.('Step 4: Unlocking transformation');
                this.connection.setSessionType('stateful');
                await (0, unlock_1.unlockTransformation)(this.connection, config.transformationName, lockHandle);
                this.connection.setSessionType('stateless');
                this.lockTracker.untrack(config.transformationName);
                lockHandle = undefined;
                this.logger?.info?.('Transformation unlocked');
            }
            // 5. Final check (no stateful needed)
            this.logger?.info?.('Step 5: Final check');
            await (0, check_1.checkTransformation)(this.connection, config.transformationName, 'inactive');
            this.logger?.info?.('Final check passed');
            // 6. Activate (if requested, no stateful needed - uses same session/cookies)
            if (options?.activateOnUpdate) {
                this.logger?.info?.('Step 6: Activating transformation');
                const activateResponse = await (0, activation_1.activateTransformation)(this.connection, config.transformationName);
                this.logger?.info?.('Transformation activated, status:', activateResponse.status);
                // 6.5. Read with long polling (wait for object to be ready after activation)
                this.logger?.info?.('read (wait for object ready after activation)');
                try {
                    await this.read({ transformationName: config.transformationName }, 'active', { withLongPolling: true });
                    this.logger?.info?.('object is ready after activation');
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed (object may not be ready yet):', (0, internalUtils_1.safeErrorMessage)(readError));
                    // Continue anyway - return activation response
                }
                return {
                    activateResult: activateResponse,
                    errors: [],
                };
            }
            // Read and return result (no stateful needed)
            const readResponse = await (0, read_1.getTransformationSource)(this.connection, config.transformationName);
            return {
                readResult: readResponse,
                errors: [],
            };
        }
        catch (error) {
            // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking transformation during error cleanup');
                    this.connection.setSessionType('stateful');
                    await (0, unlock_1.unlockTransformation)(this.connection, config.transformationName, lockHandle);
                    this.connection.setSessionType('stateless');
                    this.lockTracker.untrack(config.transformationName);
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
                    this.logger?.warn?.('Deleting transformation after failure');
                    // No stateful needed - delete doesn't use lock/unlock
                    await (0, delete_1.deleteTransformation)(this.connection, {
                        transformation_name: config.transformationName,
                        transport_request: config.transportRequest,
                    });
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete transformation after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
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
     * Delete transformation
     */
    async delete(config) {
        const state = { errors: [] };
        if (!config.transformationName) {
            const error = new Error('Transformation name is required');
            state.errors.push({ method: 'delete', error, timestamp: new Date() });
            throw error;
        }
        try {
            // Check for deletion (no stateful needed)
            this.logger?.info?.('Checking transformation for deletion');
            const deletionCheck = await (0, delete_1.checkDeletion)(this.connection, {
                transformation_name: config.transformationName,
                transport_request: config.transportRequest,
            });
            // ADT already said whether this may be deleted; refusing to read that
            // answer is how a delete came to report success while the object
            // stayed. Throws on isDeletable=false or a message of type E; a W
            // is a warning and passes.
            (0, deletionCheck_1.assertDeletable)(deletionCheck.data);
            this.logger?.info?.('Deletion check passed');
            // Delete (no stateful needed - no lock/unlock)
            this.logger?.info?.('Deleting transformation');
            const result = await (0, delete_1.deleteTransformation)(this.connection, {
                transformation_name: config.transformationName,
                transport_request: config.transportRequest,
            });
            this.logger?.info?.('Transformation deleted');
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
     * Activate transformation
     * No stateful needed - uses same session/cookies
     */
    async activate(config) {
        const state = { errors: [] };
        if (!config.transformationName) {
            const error = new Error('Transformation name is required');
            state.errors.push({ method: 'activate', error, timestamp: new Date() });
            throw error;
        }
        try {
            const result = await (0, activation_1.activateTransformation)(this.connection, config.transformationName);
            state.activateResult = result;
            return state;
        }
        catch (error) {
            this.logger?.error('Activate failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Check transformation
     */
    async check(config, status) {
        const state = { errors: [] };
        if (!config.transformationName) {
            const error = new Error('Transformation name is required');
            state.errors.push({ method: 'check', error, timestamp: new Date() });
            throw error;
        }
        // Map status to version
        const version = status === 'active' ? 'active' : 'inactive';
        state.checkResult = await (0, check_1.checkTransformation)(this.connection, config.transformationName, version);
        return state;
    }
    /**
     * Lock transformation for modification
     */
    async lock(config) {
        if (!config.transformationName) {
            throw new Error('Transformation name is required');
        }
        this.connection.setSessionType('stateful');
        const lockHandle = await (0, lock_1.lockTransformation)(this.connection, config.transformationName);
        this.lockTracker.track(config.transformationName, lockHandle);
        return lockHandle;
    }
    /**
     * Unlock transformation
     */
    async unlock(config, lockHandle) {
        if (!config.transformationName) {
            throw new Error('Transformation name is required');
        }
        this.connection.setSessionType('stateful');
        const result = await (0, unlock_1.unlockTransformation)(this.connection, config.transformationName, lockHandle);
        this.connection.setSessionType('stateless');
        this.lockTracker.untrack(config.transformationName);
        return {
            unlockResult: result,
            errors: [],
        };
    }
    getVersions(config) {
        return (0, versions_1.getTransformationVersions)(this.connection, config);
    }
    getVersionSource(contentUri) {
        return (0, versions_1.getTransformationVersionSource)(this.connection, contentUri);
    }
}
exports.AdtTransformation = AdtTransformation;
