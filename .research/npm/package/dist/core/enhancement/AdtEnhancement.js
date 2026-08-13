"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtEnhancement = void 0;
const criticalSection_1 = require("../../utils/criticalSection");
const deletionCheck_1 = require("../../utils/deletionCheck");
const internalUtils_1 = require("../../utils/internalUtils");
const activation_1 = require("./activation");
const check_1 = require("./check");
const create_1 = require("./create");
const delete_1 = require("./delete");
const lock_1 = require("./lock");
const read_1 = require("./read");
const types_1 = require("./types");
const unlock_1 = require("./unlock");
const update_1 = require("./update");
const validation_1 = require("./validation");
const versions_1 = require("./versions");
class AdtEnhancement {
    connection;
    logger;
    systemContext;
    lockRegistry;
    objectType = 'Enhancement';
    constructor(connection, logger, systemContext, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
        this.lockRegistry = lockRegistry;
    }
    /** Registry key for a held enhancement lock (e.g. `Enhancement/ZFOO`). */
    lockKey(name) {
        return `${this.objectType}/${name.toUpperCase()}`;
    }
    /**
     * Record a held lock. Enhancement unlock needs the enhancement type, so the
     * unlock thunk captures it alongside the name and handle.
     */
    trackLock(type, name, lockHandle) {
        if (!type || !name)
            return;
        // Raw unlock — LockRegistry.unlockAll() manages the session for the batch.
        this.lockRegistry?.track(this.lockKey(name), () => (0, unlock_1.unlockEnhancement)(this.connection, type, name, lockHandle));
    }
    /** Drop a lock from the registry after a clean unlock. */
    untrackLock(name) {
        if (!name)
            return;
        this.lockRegistry?.untrack(this.lockKey(name));
    }
    /**
     * Validate enhancement configuration before creation
     */
    async validate(config) {
        const state = { errors: [] };
        if (!config.enhancementName) {
            const error = new Error('Enhancement name is required for validation');
            state.errors.push({ method: 'validate', error, timestamp: new Date() });
            throw error;
        }
        if (!config.enhancementType) {
            const error = new Error('Enhancement type is required for validation');
            state.errors.push({ method: 'validate', error, timestamp: new Date() });
            throw error;
        }
        try {
            const response = await (0, validation_1.validate)(this.connection, config.enhancementType, config.enhancementName, config.packageName, config.description);
            state.validationResponse = response;
            state.enhancementType = config.enhancementType;
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
     * Create enhancement with full operation chain
     */
    async create(config, options) {
        const state = {
            errors: [],
            enhancementType: config.enhancementType,
        };
        if (!config.enhancementName) {
            throw new Error('Enhancement name is required');
        }
        if (!config.enhancementType) {
            throw new Error('Enhancement type is required');
        }
        if (!config.packageName) {
            throw new Error('Package name is required');
        }
        let objectCreated = false;
        try {
            // Create enhancement
            this.logger?.info?.('Creating enhancement');
            const createResponse = await (0, create_1.create)(this.connection, {
                enhancement_name: config.enhancementName,
                enhancement_type: config.enhancementType,
                package_name: config.packageName,
                description: config.description,
                transport_request: config.transportRequest,
                enhancement_spot: config.enhancementSpot,
                badi_definition: config.badiDefinition,
                masterSystem: this.systemContext.masterSystem,
                responsible: this.systemContext.responsible,
                masterLanguage: config.masterLanguage ?? this.systemContext.masterLanguage,
            }, this.logger);
            state.createResult = createResponse;
            objectCreated = true;
            this.logger?.info?.('Enhancement created');
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
                    this.logger?.warn?.('Deleting enhancement after failure');
                    await (0, delete_1.deleteEnhancement)(this.connection, {
                        enhancement_name: config.enhancementName,
                        enhancement_type: config.enhancementType,
                        transport_request: config.transportRequest,
                    });
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete enhancement after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
                }
            }
            this.logger?.error('Create failed:', (0, internalUtils_1.safeErrorMessage)(err));
            throw err;
        }
    }
    /**
     * Read enhancement
     */
    async read(config, version, options) {
        const state = {
            errors: [],
            enhancementType: config.enhancementType,
        };
        if (!config.enhancementName) {
            const error = new Error('Enhancement name is required');
            state.errors.push({ method: 'read', error, timestamp: new Date() });
            throw error;
        }
        if (!config.enhancementType) {
            const error = new Error('Enhancement type is required');
            state.errors.push({ method: 'read', error, timestamp: new Date() });
            throw error;
        }
        try {
            // For enhoxhh, read source code; for others, read metadata
            if ((0, types_1.supportsSourceCode)(config.enhancementType)) {
                const response = await (0, read_1.getEnhancementSource)(this.connection, config.enhancementType, config.enhancementName, version, options, this.logger);
                state.readResult = response;
                state.sourceCode = response.data;
            }
            else {
                const response = await (0, read_1.getEnhancementMetadata)(this.connection, config.enhancementType, config.enhancementName, options, this.logger);
                state.readResult = response;
            }
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
     * Read enhancement metadata (object characteristics: package, responsible, description, etc.)
     */
    async readMetadata(config, options) {
        const state = {
            errors: [],
            enhancementType: config.enhancementType,
        };
        if (!config.enhancementName) {
            const error = new Error('Enhancement name is required');
            state.errors.push({
                method: 'readMetadata',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        if (!config.enhancementType) {
            const error = new Error('Enhancement type is required');
            state.errors.push({
                method: 'readMetadata',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getEnhancementMetadata)(this.connection, config.enhancementType, config.enhancementName, options, this.logger);
            state.metadataResult = response;
            this.logger?.info?.('Enhancement metadata read successfully');
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
     * Read transport request information for the enhancement
     */
    async readTransport(config, options) {
        const state = {
            errors: [],
            enhancementType: config.enhancementType,
        };
        if (!config.enhancementName) {
            const error = new Error('Enhancement name is required');
            state.errors.push({
                method: 'readTransport',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        if (!config.enhancementType) {
            const error = new Error('Enhancement type is required');
            state.errors.push({
                method: 'readTransport',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getEnhancementTransport)(this.connection, config.enhancementType, config.enhancementName, options);
            state.transportResult = response;
            this.logger?.info?.('Enhancement transport request read successfully');
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
     * Update enhancement with full operation chain
     * Always starts with lock
     * Only available for enhoxhh (Source Code Plugin) type
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    async update(config, options) {
        const state = {
            errors: [],
            enhancementType: config.enhancementType,
        };
        if (!config.enhancementName) {
            const error = new Error('Enhancement name is required');
            state.errors.push({ method: 'update', error, timestamp: new Date() });
            throw error;
        }
        if (!config.enhancementType) {
            const error = new Error('Enhancement type is required');
            state.errors.push({ method: 'update', error, timestamp: new Date() });
            throw error;
        }
        if (!(0, types_1.supportsSourceCode)(config.enhancementType)) {
            const error = new Error(`Enhancement type '${config.enhancementType}' does not support source code update. Only 'enhoxhh' supports source code.`);
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
                enhancement_name: config.enhancementName,
                enhancement_type: config.enhancementType,
                source_code: codeToUpdate,
                lock_handle: options.lockHandle,
                transport_request: config.transportRequest,
            }, this.logger);
            this.logger?.info?.('Enhancement updated (low-level)');
            return {
                updateResult: updateResponse,
                errors: [],
                enhancementType: config.enhancementType,
            };
        }
        let lockHandle;
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            // 1. Lock (update always starts with lock, stateful ONLY before lock)
            this.logger?.info?.('Step 1: Locking enhancement');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockEnhancement)(this.connection, config.enhancementType, config.enhancementName);
            state.lockHandle = lockHandle;
            this.trackLock(config.enhancementType, config.enhancementName, lockHandle);
            this.logger?.info?.('Enhancement locked, handle:', lockHandle);
            // 2. Check inactive with code for update (from options or config)
            const codeToCheck = options?.sourceCode || config.sourceCode;
            if (codeToCheck) {
                this.logger?.info?.('Step 2: Checking inactive version with update content');
                const checkInactiveResponse = await (0, check_1.check)(this.connection, config.enhancementType, config.enhancementName, 'inactive', codeToCheck);
                state.checkResult = checkInactiveResponse;
                this.logger?.info?.('Check inactive with update content passed');
            }
            // 3. Update
            if (codeToCheck && lockHandle) {
                this.logger?.info?.('Step 3: Updating enhancement');
                const updateResponse = await (0, update_1.update)(this.connection, {
                    enhancement_name: config.enhancementName,
                    enhancement_type: config.enhancementType,
                    source_code: codeToCheck,
                    lock_handle: lockHandle,
                    transport_request: config.transportRequest,
                }, this.logger);
                state.updateResult = updateResponse;
                this.logger?.info?.('Enhancement updated');
                // Poll the inactive version: the write above produced it; the active version may not exist yet.
                // 3.5. Read with long polling (wait for object to be ready after update)
                this.logger?.info?.('read (wait for object ready after update)');
                try {
                    await this.read({
                        enhancementName: config.enhancementName,
                        enhancementType: config.enhancementType,
                    }, 'inactive', { withLongPolling: true });
                    this.logger?.info?.('object is ready after update');
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed (object may not be ready yet):', (0, internalUtils_1.safeErrorMessage)(readError));
                }
            }
            // 4. Unlock (obligatory stateless after unlock)
            if (lockHandle) {
                this.logger?.info?.('Step 4: Unlocking enhancement');
                this.connection.setSessionType('stateful');
                const unlockResponse = await (0, unlock_1.unlockEnhancement)(this.connection, config.enhancementType, config.enhancementName, lockHandle);
                state.unlockResult = unlockResponse;
                this.connection.setSessionType('stateless');
                this.untrackLock(config.enhancementName);
                lockHandle = undefined;
                this.logger?.info?.('Enhancement unlocked');
            }
            // 5. Final check (no stateful needed)
            this.logger?.info?.('Step 5: Final check');
            const finalCheckResponse = await (0, check_1.check)(this.connection, config.enhancementType, config.enhancementName, 'inactive');
            state.checkResult = finalCheckResponse;
            this.logger?.info?.('Final check passed');
            // 6. Activate (if requested, no stateful needed - uses same session/cookies)
            if (options?.activateOnUpdate) {
                this.logger?.info?.('Step 6: Activating enhancement');
                const activateResponse = await (0, activation_1.activateEnhancement)(this.connection, config.enhancementType, config.enhancementName);
                state.activateResult = activateResponse;
                this.logger?.info?.('Enhancement activated, status:', activateResponse.status);
                // 6.5. Read with long polling (wait for object to be ready after activation)
                this.logger?.info?.('read (wait for object ready after activation)');
                try {
                    await this.read({
                        enhancementName: config.enhancementName,
                        enhancementType: config.enhancementType,
                    }, 'active', { withLongPolling: true });
                    this.logger?.info?.('object is ready after activation');
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed (object may not be ready yet):', (0, internalUtils_1.safeErrorMessage)(readError));
                }
                return state;
            }
            // Read and return result (no stateful needed).
            // No activation happened: return the version just written (inactive,
            // i.e. workingArea in the enhancement URI dialect), not the stale active
            // one. getEnhancementSource defaults to 'active', so pass it explicitly.
            const readResponse = await (0, read_1.getEnhancementSource)(this.connection, config.enhancementType, config.enhancementName, 'inactive');
            state.readResult = readResponse;
            return state;
        }
        catch (error) {
            // Cleanup on error - unlock if locked
            if (lockHandle && config.enhancementType && config.enhancementName) {
                try {
                    this.logger?.warn?.('Unlocking enhancement during error cleanup');
                    this.connection.setSessionType('stateful');
                    await (0, unlock_1.unlockEnhancement)(this.connection, config.enhancementType, config.enhancementName, lockHandle);
                    this.connection.setSessionType('stateless');
                    this.untrackLock(config.enhancementName);
                }
                catch (unlockError) {
                    this.logger?.warn?.('Failed to unlock during cleanup:', (0, internalUtils_1.safeErrorMessage)(unlockError));
                }
            }
            else {
                this.connection.setSessionType('stateless');
            }
            if (options?.deleteOnFailure &&
                config.enhancementName &&
                config.enhancementType) {
                try {
                    this.logger?.warn?.('Deleting enhancement after failure');
                    await (0, delete_1.deleteEnhancement)(this.connection, {
                        enhancement_name: config.enhancementName,
                        enhancement_type: config.enhancementType,
                        transport_request: config.transportRequest,
                    });
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete enhancement after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
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
     * Delete enhancement
     */
    async delete(config) {
        const state = {
            errors: [],
            enhancementType: config.enhancementType,
        };
        if (!config.enhancementName) {
            const error = new Error('Enhancement name is required');
            state.errors.push({ method: 'delete', error, timestamp: new Date() });
            throw error;
        }
        if (!config.enhancementType) {
            const error = new Error('Enhancement type is required');
            state.errors.push({ method: 'delete', error, timestamp: new Date() });
            throw error;
        }
        try {
            // Check for deletion (no stateful needed)
            this.logger?.info?.('Checking enhancement for deletion');
            const deletionCheck = await (0, delete_1.checkDeletion)(this.connection, {
                enhancement_name: config.enhancementName,
                enhancement_type: config.enhancementType,
            });
            // ADT already said whether this may be deleted; refusing to read that
            // answer is how a delete came to report success while the object
            // stayed. Throws on isDeletable=false or a message of type E; a W
            // is a warning and passes.
            (0, deletionCheck_1.assertDeletable)(deletionCheck.data);
            this.logger?.info?.('Deletion check passed');
            // Delete (no stateful needed - no lock/unlock)
            this.logger?.info?.('Deleting enhancement');
            const result = await (0, delete_1.deleteEnhancement)(this.connection, {
                enhancement_name: config.enhancementName,
                enhancement_type: config.enhancementType,
                transport_request: config.transportRequest,
            });
            state.deleteResult = result;
            this.logger?.info?.('Enhancement deleted');
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
     * Activate enhancement
     * No stateful needed - uses same session/cookies
     */
    async activate(config) {
        const state = {
            errors: [],
            enhancementType: config.enhancementType,
        };
        if (!config.enhancementName) {
            const error = new Error('Enhancement name is required');
            state.errors.push({ method: 'activate', error, timestamp: new Date() });
            throw error;
        }
        if (!config.enhancementType) {
            const error = new Error('Enhancement type is required');
            state.errors.push({ method: 'activate', error, timestamp: new Date() });
            throw error;
        }
        try {
            const result = await (0, activation_1.activateEnhancement)(this.connection, config.enhancementType, config.enhancementName);
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
     * Check enhancement
     */
    async check(config, status) {
        const state = {
            errors: [],
            enhancementType: config.enhancementType,
        };
        if (!config.enhancementName) {
            const error = new Error('Enhancement name is required');
            state.errors.push({ method: 'check', error, timestamp: new Date() });
            throw error;
        }
        if (!config.enhancementType) {
            const error = new Error('Enhancement type is required');
            state.errors.push({ method: 'check', error, timestamp: new Date() });
            throw error;
        }
        try {
            const version = status === 'active' ? 'active' : 'inactive';
            const response = await (0, check_1.check)(this.connection, config.enhancementType, config.enhancementName, version);
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
     * Lock enhancement for modification
     */
    async lock(config) {
        if (!config.enhancementName || !config.enhancementType) {
            throw new Error('Enhancement name and type are required');
        }
        this.connection.setSessionType('stateful');
        const lockHandle = await (0, lock_1.lockEnhancement)(this.connection, config.enhancementType, config.enhancementName);
        this.trackLock(config.enhancementType, config.enhancementName, lockHandle);
        return lockHandle;
    }
    /**
     * Unlock enhancement
     */
    async unlock(config, lockHandle) {
        if (!config.enhancementName || !config.enhancementType) {
            throw new Error('Enhancement name and type are required');
        }
        this.connection.setSessionType('stateful');
        const result = await (0, unlock_1.unlockEnhancement)(this.connection, config.enhancementType, config.enhancementName, lockHandle);
        this.connection.setSessionType('stateless');
        this.untrackLock(config.enhancementName);
        return {
            unlockResult: result,
            errors: [],
            enhancementType: config.enhancementType,
        };
    }
    getVersions(config) {
        return (0, versions_1.getEnhancementVersions)(this.connection, config);
    }
    getVersionSource(contentUri) {
        return (0, versions_1.getEnhancementVersionSource)(this.connection, contentUri);
    }
}
exports.AdtEnhancement = AdtEnhancement;
