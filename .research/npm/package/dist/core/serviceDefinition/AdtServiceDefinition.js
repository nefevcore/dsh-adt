"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtServiceDefinition = void 0;
const criticalSection_1 = require("../../utils/criticalSection");
const deletionCheck_1 = require("../../utils/deletionCheck");
const internalUtils_1 = require("../../utils/internalUtils");
const capabilities_1 = require("../shared/capabilities");
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
class AdtServiceDefinition {
    connection;
    logger;
    systemContext;
    lockTracker;
    objectType = 'ServiceDefinition';
    // LAZY thunk (not a getter that snapshots): captures `this` but reads
    // this.connection/this.logger only when invoked, after the constructor has
    // run — so building the capabilities below as class fields is safe.
    capCtx = () => ({
        connection: this.connection,
        logger: this.logger,
    });
    lockCap = new capabilities_1.LockCapability(this.capCtx, {
        nameOf: (c) => {
            if (!c.serviceDefinitionName)
                throw new Error('Service definition name is required');
            return c.serviceDefinitionName;
        },
        acquire: async (ctx, name) => ({
            lockHandle: await (0, lock_1.lockServiceDefinition)(ctx.connection, name),
        }),
        release: async (ctx, name, handle) => {
            const result = await (0, unlock_1.unlockServiceDefinition)(ctx.connection, name, handle);
            return { unlockResult: result, errors: [] };
        },
    });
    versionsCap = new capabilities_1.VersionsCapability(this.capCtx, {
        nameOf: (c) => {
            if (!c.serviceDefinitionName)
                throw new Error('serviceDefinitionName is required');
            return c.serviceDefinitionName;
        },
        // NOTE: getServiceDefinitionVersions takes a config, not a bare name —
        // the strategy re-wraps. (getClassIncludeVersions, by contrast, takes a
        // name; the two low-level shapes differ and the strategy absorbs that.)
        list: (ctx, name) => (0, versions_1.getServiceDefinitionVersions)(ctx.connection, {
            serviceDefinitionName: name,
        }),
        source: (ctx, uri) => (0, versions_1.getServiceDefinitionVersionSource)(ctx.connection, uri),
    });
    constructor(connection, logger, systemContext, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
        this.lockTracker = (0, LockRegistry_1.createLockTracker)(lockRegistry, this.objectType, (name, lockHandle) => (0, unlock_1.unlockServiceDefinition)(this.connection, name, lockHandle));
    }
    /**
     * Validate service definition configuration before creation
     */
    async validate(config) {
        const state = { errors: [] };
        if (!config.serviceDefinitionName) {
            const error = new Error('Service definition name is required for validation');
            state.errors.push({ method: 'validate', error, timestamp: new Date() });
            throw error;
        }
        try {
            const response = await (0, validation_1.validateServiceDefinitionName)(this.connection, config.serviceDefinitionName, config.description);
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
     * Create service definition with full operation chain
     */
    async create(config, _options) {
        const state = { errors: [] };
        if (!config.serviceDefinitionName) {
            const error = new Error('Service definition name is required');
            state.errors.push({ method: 'create', error, timestamp: new Date() });
            throw error;
        }
        if (!config.packageName) {
            throw new Error('Package name is required');
        }
        if (!config.description) {
            throw new Error('Description is required');
        }
        try {
            // Create service definition
            this.logger?.info?.('Creating service definition');
            const createResponse = await (0, create_1.create)(this.connection, {
                service_definition_name: config.serviceDefinitionName,
                package_name: config.packageName,
                transport_request: config.transportRequest,
                description: config.description,
                masterSystem: this.systemContext.masterSystem,
                responsible: this.systemContext.responsible,
                masterLanguage: config.masterLanguage ?? this.systemContext.masterLanguage,
            });
            state.createResult = createResponse;
            this.logger?.info?.('Service definition created');
            return state;
        }
        catch (error) {
            this.logger?.error('Create failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read service definition
     */
    async read(config, version, options) {
        const state = { errors: [] };
        if (!config.serviceDefinitionName) {
            const error = new Error('Service definition name is required');
            state.errors.push({ method: 'read', error, timestamp: new Date() });
            throw error;
        }
        try {
            const response = await (0, read_1.getServiceDefinitionSource)(this.connection, config.serviceDefinitionName, version, options, this.logger);
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
     * Read service definition metadata (object characteristics: package, responsible, description, etc.)
     */
    async readMetadata(config, options) {
        const state = { errors: [] };
        if (!config.serviceDefinitionName) {
            const error = new Error('Service definition name is required');
            state.errors.push({
                method: 'readMetadata',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getServiceDefinition)(this.connection, config.serviceDefinitionName, 'inactive', options, this.logger);
            state.metadataResult = response;
            this.logger?.info?.('Service definition metadata read successfully');
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
     * Read transport request information for the service definition
     */
    async readTransport(config, options) {
        const state = { errors: [] };
        if (!config.serviceDefinitionName) {
            const error = new Error('Service definition name is required');
            state.errors.push({
                method: 'readTransport',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getServiceDefinitionTransport)(this.connection, config.serviceDefinitionName, options?.withLongPolling !== undefined
                ? { withLongPolling: options.withLongPolling }
                : undefined);
            state.transportResult = response;
            this.logger?.info?.('Service definition transport request read successfully');
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
     * Update service definition with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    async update(config, options) {
        const state = { errors: [] };
        if (!config.serviceDefinitionName) {
            const error = new Error('Service definition name is required');
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
            const updateResponse = await (0, update_1.updateServiceDefinition)(this.connection, {
                service_definition_name: config.serviceDefinitionName,
                source_code: codeToUpdate,
                transport_request: config.transportRequest,
            }, options.lockHandle);
            this.logger?.info?.('Service definition updated (low-level)');
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
            this.logger?.info?.('Step 1: Locking service definition');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockServiceDefinition)(this.connection, config.serviceDefinitionName);
            this.lockTracker.track(config.serviceDefinitionName, lockHandle);
            this.logger?.info?.('Service definition locked, handle:', lockHandle);
            // 2. Check inactive with code for update (from options or config)
            const codeToCheck = options?.sourceCode || config.sourceCode;
            if (codeToCheck) {
                this.logger?.info?.('Step 2: Checking inactive version with update content');
                await (0, check_1.checkServiceDefinition)(this.connection, config.serviceDefinitionName, 'inactive', codeToCheck);
                this.logger?.info?.('Check inactive with update content passed');
            }
            // 3. Update
            if (codeToCheck && lockHandle) {
                this.logger?.info?.('Step 3: Updating service definition');
                await (0, update_1.updateServiceDefinition)(this.connection, {
                    service_definition_name: config.serviceDefinitionName,
                    source_code: codeToCheck,
                    transport_request: config.transportRequest,
                }, lockHandle);
                this.logger?.info?.('Service definition updated');
                // 3.5. Read with long polling (wait for object to be ready after update)
                // Poll the inactive version: the write above produced it; the active version may not exist yet.
                this.logger?.info?.('read (wait for object ready after update)');
                try {
                    await this.read({ serviceDefinitionName: config.serviceDefinitionName }, 'inactive', { withLongPolling: true });
                    this.logger?.info?.('object is ready after update');
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed (object may not be ready yet):', (0, internalUtils_1.safeErrorMessage)(readError));
                    // Continue anyway - unlock might still work
                }
            }
            // 4. Unlock (obligatory stateless after unlock)
            if (lockHandle) {
                this.logger?.info?.('Step 4: Unlocking service definition');
                this.connection.setSessionType('stateful');
                await (0, unlock_1.unlockServiceDefinition)(this.connection, config.serviceDefinitionName, lockHandle);
                this.connection.setSessionType('stateless');
                this.lockTracker.untrack(config.serviceDefinitionName);
                lockHandle = undefined;
                this.logger?.info?.('Service definition unlocked');
            }
            // 5. Final check (no stateful needed)
            this.logger?.info?.('Step 5: Final check');
            await (0, check_1.checkServiceDefinition)(this.connection, config.serviceDefinitionName, 'inactive');
            this.logger?.info?.('Final check passed');
            // 6. Activate (if requested, no stateful needed - uses same session/cookies)
            if (options?.activateOnUpdate) {
                this.logger?.info?.('Step 6: Activating service definition');
                const activateResponse = await (0, activation_1.activateServiceDefinition)(this.connection, config.serviceDefinitionName);
                this.logger?.info?.('Service definition activated, status:', activateResponse.status);
                // 6.5. Read with long polling (wait for object to be ready after activation)
                this.logger?.info?.('read (wait for object ready after activation)');
                try {
                    await this.read({ serviceDefinitionName: config.serviceDefinitionName }, 'active', { withLongPolling: true });
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
            const readResponse = await (0, read_1.getServiceDefinitionSource)(this.connection, config.serviceDefinitionName);
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
                    this.logger?.warn?.('Unlocking service definition during error cleanup');
                    this.connection.setSessionType('stateful');
                    await (0, unlock_1.unlockServiceDefinition)(this.connection, config.serviceDefinitionName, lockHandle);
                    this.connection.setSessionType('stateless');
                    this.lockTracker.untrack(config.serviceDefinitionName);
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
                    this.logger?.warn?.('Deleting service definition after failure');
                    // No stateful needed - delete doesn't use lock/unlock
                    await (0, delete_1.deleteServiceDefinition)(this.connection, {
                        service_definition_name: config.serviceDefinitionName,
                        transport_request: config.transportRequest,
                    });
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete service definition after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
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
     * Delete service definition
     */
    async delete(config) {
        const state = { errors: [] };
        if (!config.serviceDefinitionName) {
            const error = new Error('Service definition name is required');
            state.errors.push({ method: 'delete', error, timestamp: new Date() });
            throw error;
        }
        try {
            // Check for deletion (no stateful needed)
            this.logger?.info?.('Checking service definition for deletion');
            const deletionCheck = await (0, delete_1.checkDeletion)(this.connection, {
                service_definition_name: config.serviceDefinitionName,
                transport_request: config.transportRequest,
            });
            // ADT already said whether this may be deleted; refusing to read that
            // answer is how a delete came to report success while the object
            // stayed. Throws on isDeletable=false or a message of type E; a W
            // is a warning and passes.
            (0, deletionCheck_1.assertDeletable)(deletionCheck.data);
            this.logger?.info?.('Deletion check passed');
            // Delete (no stateful needed - no lock/unlock)
            this.logger?.info?.('Deleting service definition');
            const result = await (0, delete_1.deleteServiceDefinition)(this.connection, {
                service_definition_name: config.serviceDefinitionName,
                transport_request: config.transportRequest,
            });
            this.logger?.info?.('Service definition deleted');
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
     * Activate service definition
     * No stateful needed - uses same session/cookies
     */
    async activate(config) {
        const state = { errors: [] };
        if (!config.serviceDefinitionName) {
            const error = new Error('Service definition name is required');
            state.errors.push({ method: 'activate', error, timestamp: new Date() });
            throw error;
        }
        try {
            const result = await (0, activation_1.activateServiceDefinition)(this.connection, config.serviceDefinitionName);
            state.activateResult = result;
            return state;
        }
        catch (error) {
            this.logger?.error('Activate failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Check service definition
     */
    async check(config, status) {
        const state = { errors: [] };
        if (!config.serviceDefinitionName) {
            const error = new Error('Service definition name is required');
            state.errors.push({ method: 'check', error, timestamp: new Date() });
            throw error;
        }
        // Map status to version
        const version = status === 'active' ? 'active' : 'inactive';
        state.checkResult = await (0, check_1.checkServiceDefinition)(this.connection, config.serviceDefinitionName, version);
        return state;
    }
    /**
     * Lock service definition for modification
     */
    async lock(config) {
        const lockHandle = await this.lockCap.lock(config);
        this.lockTracker.track(config.serviceDefinitionName, lockHandle);
        return lockHandle;
    }
    /**
     * Unlock service definition
     */
    async unlock(config, lockHandle) {
        const state = await this.lockCap.unlock(config, lockHandle);
        this.lockTracker.untrack(config.serviceDefinitionName);
        return state;
    }
    getVersions(config) {
        return this.versionsCap.getVersions(config);
    }
    getVersionSource(contentUri) {
        return this.versionsCap.getVersionSource(contentUri);
    }
}
exports.AdtServiceDefinition = AdtServiceDefinition;
