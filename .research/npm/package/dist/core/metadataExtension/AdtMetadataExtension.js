"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtMetadataExtension = void 0;
const criticalSection_1 = require("../../utils/criticalSection");
const internalUtils_1 = require("../../utils/internalUtils");
const LockRegistry_1 = require("../shared/LockRegistry");
const activate_1 = require("./activate");
const check_1 = require("./check");
const create_1 = require("./create");
const delete_1 = require("./delete");
const lock_1 = require("./lock");
const read_1 = require("./read");
const unlock_1 = require("./unlock");
const update_1 = require("./update");
const validation_1 = require("./validation");
const versions_1 = require("./versions");
class AdtMetadataExtension {
    connection;
    logger;
    systemContext;
    lockTracker;
    objectType = 'MetadataExtension';
    constructor(connection, logger, systemContext, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
        this.lockTracker = (0, LockRegistry_1.createLockTracker)(lockRegistry, this.objectType, (name, lockHandle) => (0, unlock_1.unlockMetadataExtension)(this.connection, name, lockHandle));
    }
    /**
     * Validate metadata extension configuration before creation
     */
    async validate(config) {
        const state = { errors: [] };
        if (!config.name) {
            const error = new Error('Metadata extension name is required for validation');
            state.errors.push({ method: 'validate', error, timestamp: new Date() });
            throw error;
        }
        if (!config.packageName) {
            const error = new Error('Package name is required for validation');
            state.errors.push({ method: 'validate', error, timestamp: new Date() });
            throw error;
        }
        const response = await (0, validation_1.validateMetadataExtension)(this.connection, {
            name: config.name,
            description: config.description || config.name,
            packageName: config.packageName,
        });
        state.validationResponse = response;
        return state;
    }
    /**
     * Create metadata extension with full operation chain
     */
    async create(config, _options) {
        const state = { errors: [] };
        if (!config.name) {
            const error = new Error('Metadata extension name is required');
            state.errors.push({ method: 'create', error, timestamp: new Date() });
            throw error;
        }
        if (!config.packageName) {
            const error = new Error('Package name is required');
            state.errors.push({ method: 'create', error, timestamp: new Date() });
            throw error;
        }
        if (!config.description) {
            const error = new Error('Description is required');
            state.errors.push({ method: 'create', error, timestamp: new Date() });
            throw error;
        }
        try {
            // Create metadata extension
            this.logger?.info?.('Creating metadata extension');
            const createResponse = await (0, create_1.createMetadataExtension)(this.connection, {
                name: config.name,
                packageName: config.packageName,
                transportRequest: config.transportRequest,
                description: config.description,
                masterLanguage: config.masterLanguage ?? this.systemContext.masterLanguage,
                masterSystem: config.masterSystem ?? this.systemContext.masterSystem,
                responsible: config.responsible ?? this.systemContext.responsible,
            });
            state.createResult = createResponse;
            this.logger?.info?.('Metadata extension created');
            return state;
        }
        catch (error) {
            this.logger?.error('Create failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read metadata extension
     */
    async read(config, version, options) {
        const state = { errors: [] };
        if (!config.name) {
            const error = new Error('Metadata extension name is required');
            state.errors.push({ method: 'read', error, timestamp: new Date() });
            throw error;
        }
        try {
            const response = await (0, read_1.readMetadataExtensionSource)(this.connection, config.name, version, options, this.logger);
            const _sourceCode = typeof response.data === 'string'
                ? response.data
                : JSON.stringify(response.data);
            return {
                readResult: response,
                errors: [],
            };
        }
        catch (error) {
            const e = error;
            if (e.response?.status === 404) {
                return state;
            }
            const err = error instanceof Error ? error : new Error(String(error));
            state.errors.push({ method: 'read', error: err, timestamp: new Date() });
            this.logger?.error('read', (0, internalUtils_1.safeErrorMessage)(err));
            throw err;
        }
    }
    /**
     * Read metadata extension metadata (object characteristics: package, responsible, description, etc.)
     */
    async readMetadata(config, options) {
        const state = { errors: [] };
        if (!config.name) {
            const error = new Error('Metadata extension name is required');
            state.errors.push({
                method: 'readMetadata',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.readMetadataExtension)(this.connection, config.name, options, this.logger);
            state.metadataResult = response;
            this.logger?.info?.('Metadata extension metadata read successfully');
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
     * Read transport request information for the metadata extension
     */
    async readTransport(config, options) {
        const state = { errors: [] };
        if (!config.name) {
            const error = new Error('Metadata extension name is required');
            state.errors.push({
                method: 'readTransport',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getMetadataExtensionTransport)(this.connection, config.name, options?.withLongPolling !== undefined
                ? { withLongPolling: options.withLongPolling }
                : undefined);
            state.transportResult = response;
            this.logger?.info?.('Metadata extension transport request read successfully');
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
     * Update metadata extension with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    async update(config, options) {
        const state = { errors: [] };
        if (!config.name) {
            const error = new Error('Metadata extension name is required');
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
            const updateResponse = await (0, update_1.updateMetadataExtension)(this.connection, config.name, codeToUpdate, options.lockHandle, config.transportRequest);
            this.logger?.info?.('Metadata extension updated (low-level)');
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
            this.logger?.info?.('Step 1: Locking metadata extension');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockMetadataExtension)(this.connection, config.name);
            this.lockTracker.track(config.name, lockHandle);
            this.logger?.info?.('Metadata extension locked, handle:', lockHandle);
            // 2. Check inactive with code for update (from options or config)
            const codeToCheck = options?.sourceCode || config.sourceCode;
            if (codeToCheck) {
                this.logger?.info?.('Step 2: Checking inactive version with update content');
                await (0, check_1.checkMetadataExtension)(this.connection, config.name, 'inactive', codeToCheck);
                this.logger?.info?.('Check inactive with update content passed');
            }
            // 3. Update
            if (codeToCheck && lockHandle) {
                this.logger?.info?.('Step 3: Updating metadata extension');
                await (0, update_1.updateMetadataExtension)(this.connection, config.name, codeToCheck, lockHandle, config.transportRequest);
                this.logger?.info?.('Metadata extension updated');
                // 3.5. Read with long polling (wait for object to be ready after update)
                this.logger?.info?.('read (wait for object ready after update)');
                try {
                    await this.read({ name: config.name }, 'active', {
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
                this.logger?.info?.('Step 4: Unlocking metadata extension');
                this.connection.setSessionType('stateful');
                await (0, unlock_1.unlockMetadataExtension)(this.connection, config.name, lockHandle);
                this.connection.setSessionType('stateless');
                this.lockTracker.untrack(config.name);
                lockHandle = undefined;
                this.logger?.info?.('Metadata extension unlocked');
            }
            // 5. Final check (no stateful needed)
            this.logger?.info?.('Step 5: Final check');
            await (0, check_1.checkMetadataExtension)(this.connection, config.name, 'inactive');
            this.logger?.info?.('Final check passed');
            // 6. Activate (if requested, no stateful needed - uses same session/cookies)
            if (options?.activateOnUpdate) {
                this.logger?.info?.('Step 6: Activating metadata extension');
                const activateResponse = await (0, activate_1.activateMetadataExtension)(this.connection, config.name);
                this.logger?.info?.('Metadata extension activated, status:', activateResponse.status);
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
                    // Continue anyway - return activation response
                }
                return {
                    activateResult: activateResponse,
                    errors: [],
                };
            }
            // Read and return result (no stateful needed)
            const readResponse = await (0, read_1.readMetadataExtensionSource)(this.connection, config.name);
            const _sourceCode = typeof readResponse.data === 'string'
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
                    this.logger?.warn?.('Unlocking metadata extension during error cleanup');
                    this.connection.setSessionType('stateful');
                    await (0, unlock_1.unlockMetadataExtension)(this.connection, config.name, lockHandle);
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
                    this.logger?.warn?.('Deleting metadata extension after failure');
                    // No stateful needed - delete doesn't use lock/unlock
                    await (0, delete_1.deleteMetadataExtension)(this.connection, config.name, config.transportRequest);
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete metadata extension after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
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
     * Delete metadata extension
     */
    async delete(config) {
        const state = { errors: [] };
        if (!config.name) {
            const error = new Error('Metadata extension name is required');
            state.errors.push({ method: 'delete', error, timestamp: new Date() });
            throw error;
        }
        try {
            // Delete (no stateful needed - no lock/unlock, no deletion check for metadata extensions)
            this.logger?.info?.('Deleting metadata extension');
            const result = await (0, delete_1.deleteMetadataExtension)(this.connection, config.name, config.transportRequest);
            this.logger?.info?.('Metadata extension deleted');
            return {
                deleteResult: result,
                errors: [],
            };
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            state.errors.push({
                method: 'delete',
                error: err,
                timestamp: new Date(),
            });
            this.logger?.error('Delete', (0, internalUtils_1.safeErrorMessage)(err));
            throw err;
        }
    }
    /**
     * Activate metadata extension
     * No stateful needed - uses same session/cookies
     */
    async activate(config) {
        const state = { errors: [] };
        if (!config.name) {
            const error = new Error('Metadata extension name is required');
            state.errors.push({ method: 'activate', error, timestamp: new Date() });
            throw error;
        }
        try {
            const result = await (0, activate_1.activateMetadataExtension)(this.connection, config.name);
            return {
                activateResult: result,
                errors: [],
            };
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            state.errors.push({
                method: 'activate',
                error: err,
                timestamp: new Date(),
            });
            this.logger?.error('Activate', (0, internalUtils_1.safeErrorMessage)(err));
            throw err;
        }
    }
    /**
     * Check metadata extension
     */
    async check(config, status) {
        const state = { errors: [] };
        if (!config.name) {
            const error = new Error('Metadata extension name is required');
            state.errors.push({ method: 'check', error, timestamp: new Date() });
            throw error;
        }
        // Map status to version
        const version = status === 'active' ? 'active' : 'inactive';
        const result = await (0, check_1.checkMetadataExtension)(this.connection, config.name, version);
        state.checkResult = result;
        return state;
    }
    /**
     * Lock metadata extension for modification
     */
    async lock(config) {
        if (!config.name) {
            throw new Error('Metadata extension name is required');
        }
        this.connection.setSessionType('stateful');
        const lockHandle = await (0, lock_1.lockMetadataExtension)(this.connection, config.name);
        this.lockTracker.track(config.name, lockHandle);
        return lockHandle;
    }
    /**
     * Unlock metadata extension
     */
    async unlock(config, lockHandle) {
        if (!config.name) {
            throw new Error('Metadata extension name is required');
        }
        this.connection.setSessionType('stateful');
        const result = await (0, unlock_1.unlockMetadataExtension)(this.connection, config.name, lockHandle);
        this.connection.setSessionType('stateless');
        this.lockTracker.untrack(config.name);
        return {
            unlockResult: result,
            errors: [],
        };
    }
    getVersions(config) {
        return (0, versions_1.getMetadataExtensionVersions)(this.connection, config);
    }
    getVersionSource(contentUri) {
        return (0, versions_1.getMetadataExtensionVersionSource)(this.connection, contentUri);
    }
}
exports.AdtMetadataExtension = AdtMetadataExtension;
