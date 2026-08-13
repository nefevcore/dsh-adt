"use strict";
/**
 * AdtBehaviorImplementation - High-level CRUD operations for Behavior Implementation objects
 *
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 *
 * Behavior Implementation is a special form of class (CLAS/OC) with:
 * - Empty main class source
 * - Special implementations include (local handler class)
 *
 * Uses composition with AdtClass for most operations, overriding only
 * methods that work with implementations include (update, read).
 *
 * Session management:
 * - stateful: only when doing lock/update/unlock operations
 * - stateless: obligatory after unlock
 * - If no lock/unlock, no stateful needed
 * - activate uses same session/cookies (no stateful needed)
 *
 * Operation chains:
 * - Create: validate → create (via AdtClass) → check → lock → check(inactive) → update (implementations) → unlock → check → activate
 * - Update: lock → check(inactive) → update (implementations) → unlock → check → activate
 * - Delete: check(deletion) → delete (via AdtClass)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtBehaviorImplementation = void 0;
const internalUtils_1 = require("../../utils/internalUtils");
const systemInfo_1 = require("../../utils/systemInfo");
const class_1 = require("../class");
const update_1 = require("../class/update");
const read_1 = require("./read");
const update_2 = require("./update");
const validation_1 = require("./validation");
const versions_1 = require("./versions");
class AdtBehaviorImplementation {
    connection;
    logger;
    class;
    objectType = 'BehaviorImplementation';
    constructor(connection, logger, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        // Behavior implementation locks are class locks delegated to this internal
        // AdtClass — pass the session registry so those locks are tracked too.
        this.class = new class_1.AdtClass(connection, logger, undefined, undefined, lockRegistry);
    }
    /**
     * Validate behavior implementation configuration before creation
     */
    async validate(config) {
        const state = { errors: [] };
        if (!config.className) {
            const error = new Error('Class name is required for validation');
            state.errors.push({ method: 'validate', error, timestamp: new Date() });
            throw error;
        }
        if (!config.behaviorDefinition) {
            const error = new Error('Behavior definition is required for validation');
            state.errors.push({ method: 'validate', error, timestamp: new Date() });
            throw error;
        }
        try {
            const response = await (0, validation_1.validateBehaviorImplementationName)(this.connection, config.className, config.packageName, config.description, config.behaviorDefinition);
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
     * Create behavior implementation with full operation chain
     */
    async create(config, _options) {
        const state = { errors: [] };
        if (!config.className) {
            throw new Error('Class name is required');
        }
        if (!config.packageName) {
            throw new Error('Package name is required');
        }
        if (!config.description) {
            throw new Error('Description is required');
        }
        if (!config.behaviorDefinition) {
            throw new Error('Behavior definition is required');
        }
        let _objectCreated = false;
        const systemInfo = await (0, systemInfo_1.getSystemInformation)(this.connection);
        const username = systemInfo?.userName || '';
        const masterSystem = systemInfo?.systemID;
        try {
            // Create behavior implementation class
            this.logger?.info?.('Creating behavior implementation class');
            const createState = await this.class.create({
                className: config.className,
                packageName: config.packageName,
                transportRequest: config.transportRequest,
                description: config.description,
                masterSystem: masterSystem,
                responsible: username,
            }, { activateOnCreate: false });
            state.createResult = createState.createResult;
            _objectCreated = true;
            this.logger?.info?.('Behavior implementation class created');
            return state;
        }
        catch (error) {
            this.logger?.error('Create failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read behavior implementation
     */
    async read(config, version, options) {
        const state = { errors: [] };
        if (!config.className) {
            const error = new Error('Class name is required');
            state.errors.push({ method: 'read', error, timestamp: new Date() });
            throw error;
        }
        try {
            const response = await (0, read_1.getBehaviorImplementationSource)(this.connection, config.className, version, options, this.logger);
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
            this.logger?.error('read', (0, internalUtils_1.safeErrorMessage)(err));
            throw err;
        }
    }
    /**
     * Read behavior implementation metadata (object characteristics: package, responsible, description, etc.)
     */
    async readMetadata(config, options) {
        const state = { errors: [] };
        if (!config.className) {
            const error = new Error('Class name is required');
            state.errors.push({
                method: 'readMetadata',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getBehaviorImplementationMetadata)(this.connection, config.className, options, this.logger);
            state.metadataResult = response;
            this.logger?.info?.('Behavior implementation metadata read successfully');
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
     * Read transport request information for the behavior implementation
     */
    async readTransport(config, options) {
        const state = { errors: [] };
        if (!config.className) {
            const error = new Error('Class name is required');
            state.errors.push({
                method: 'readTransport',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getBehaviorImplementationTransport)(this.connection, config.className, options?.withLongPolling !== undefined
                ? { withLongPolling: options.withLongPolling }
                : undefined);
            state.transportResult = response;
            this.logger?.info?.('Behavior implementation transport request read successfully');
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
     * Update behavior implementation with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    async update(config, options) {
        const state = { errors: [] };
        if (!config.className) {
            const error = new Error('Class name is required');
            state.errors.push({ method: 'update', error, timestamp: new Date() });
            throw error;
        }
        // Low-level mode: if lockHandle is provided, perform only update operation
        if (options?.lockHandle) {
            const codeToUpdate = options?.sourceCode || config.implementationCode || config.sourceCode;
            if (!codeToUpdate) {
                throw new Error('Implementation code is required for update');
            }
            if (!config.behaviorDefinition) {
                throw new Error('behaviorDefinition is required for update');
            }
            this.logger?.info?.('Low-level update: performing update only (lockHandle provided)');
            // Update main source with "FOR BEHAVIOR OF" clause
            const mainSource = `CLASS ${config.className} DEFINITION PUBLIC ABSTRACT FINAL FOR BEHAVIOR OF ${config.behaviorDefinition}.

ENDCLASS.

CLASS ${config.className} IMPLEMENTATION.

ENDCLASS.`;
            await (0, update_1.updateClass)(this.connection, config.className, mainSource, options.lockHandle, config.transportRequest);
            // Update implementations include
            const updateResponse = await (0, update_2.updateBehaviorImplementation)(this.connection, config.className, codeToUpdate, options.lockHandle, config.transportRequest);
            this.logger?.info?.('Behavior implementation updated (low-level)');
            return {
                updateResult: updateResponse,
                errors: [],
            };
        }
        let lockHandle;
        try {
            // 1. Lock (update always starts with lock, stateful set inside lock method)
            this.logger?.info?.('Step 1: Locking behavior implementation class');
            lockHandle = await this.class.lock({ className: config.className });
            state.lockHandle = lockHandle;
            this.logger?.info?.('Behavior implementation class locked, handle:', lockHandle);
            // 2. Get code for update (from options or config)
            const codeToCheck = options?.sourceCode || config.implementationCode || config.sourceCode;
            // 3. Check inactive version (without sourceCode - implementations include code is not full class code)
            // Note: We don't check with implementations include code because it's not the full class code
            // The implementations include code will be validated when we update it
            this.logger?.info?.('Step 2: Checking inactive version');
            const checkInactiveState = await this.class.check({ className: config.className }, 'inactive');
            state.checkResult = checkInactiveState.checkResult;
            this.logger?.info?.('Check inactive passed');
            // 4. Update main source with "FOR BEHAVIOR OF" clause (required before updating implementations)
            if (!config.behaviorDefinition) {
                throw new Error('behaviorDefinition is required for update');
            }
            if (lockHandle) {
                this.logger?.info?.('Step 3: Updating main source with FOR BEHAVIOR OF clause');
                const mainSource = `CLASS ${config.className} DEFINITION PUBLIC ABSTRACT FINAL FOR BEHAVIOR OF ${config.behaviorDefinition}.

ENDCLASS.

CLASS ${config.className} IMPLEMENTATION.

ENDCLASS.`;
                const _mainSourceUpdateResponse = await (0, update_1.updateClass)(this.connection, config.className, mainSource, lockHandle, config.transportRequest);
                this.logger?.info?.('Main source updated with FOR BEHAVIOR OF clause');
            }
            // 5. Update implementations include
            if (codeToCheck && lockHandle) {
                this.logger?.info?.('Step 4: Updating behavior implementation implementations include');
                const updateResponse = await (0, update_2.updateBehaviorImplementation)(this.connection, config.className, codeToCheck, lockHandle, config.transportRequest);
                state.updateResult = updateResponse;
                this.logger?.info?.('Behavior implementation implementations include updated');
                // Poll the inactive version: the write above produced it; the active version may not exist yet.
                // 5.5. Read with long polling (wait for object to be ready after update)
                this.logger?.info?.('read (wait for object ready after update)');
                try {
                    await this.read({ className: config.className }, 'inactive', {
                        withLongPolling: true,
                    });
                    this.logger?.info?.('object is ready after update');
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed (object may not be ready yet):', (0, internalUtils_1.safeErrorMessage)(readError));
                    // Continue anyway - unlock might still work
                }
            }
            // 6. Unlock (obligatory stateless after unlock)
            if (lockHandle) {
                this.logger?.info?.('Step 5: Unlocking behavior implementation class');
                const unlockState = await this.class.unlock({ className: config.className }, lockHandle);
                state.unlockResult = unlockState.unlockResult;
                this.connection.setSessionType('stateless');
                lockHandle = undefined;
                this.logger?.info?.('Behavior implementation class unlocked');
            }
            // 7. Final check (no stateful needed)
            this.logger?.info?.('Step 6: Final check');
            const finalCheckState = await this.class.check({ className: config.className }, 'inactive');
            state.checkResult = finalCheckState.checkResult;
            this.logger?.info?.('Final check passed');
            // 8. Activate (if requested, no stateful needed - uses same session/cookies)
            if (options?.activateOnUpdate) {
                this.logger?.info?.('Step 7: Activating behavior implementation class');
                const activateState = await this.class.activate({
                    className: config.className,
                });
                state.activateResult = activateState.activateResult;
                this.logger?.info?.('Behavior implementation class activated, status:', activateState.activateResult?.status);
                // 6.5. Read with long polling (wait for object to be ready after activation)
                this.logger?.info?.('read (wait for object ready after activation)');
                try {
                    await this.read({ className: config.className }, 'active', {
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
            const readResponse = await (0, read_1.getBehaviorImplementationSource)(this.connection, config.className);
            state.readResult = readResponse;
            return state;
        }
        catch (error) {
            // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking behavior implementation class during error cleanup');
                    await this.class.unlock({ className: config.className }, lockHandle);
                    this.connection.setSessionType('stateless');
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
                    this.logger?.warn?.('Deleting behavior implementation class after failure');
                    await this.class.delete({
                        className: config.className,
                        transportRequest: config.transportRequest,
                    });
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete behavior implementation class after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
                }
            }
            this.logger?.error('Update failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Delete behavior implementation
     */
    async delete(config) {
        const state = { errors: [] };
        if (!config.className) {
            const error = new Error('Class name is required');
            state.errors.push({ method: 'delete', error, timestamp: new Date() });
            throw error;
        }
        try {
            // Delete via AdtClass (handles check and delete)
            this.logger?.info?.('Deleting behavior implementation class');
            const deleteState = await this.class.delete({
                className: config.className,
                transportRequest: config.transportRequest,
            });
            state.deleteResult = deleteState.deleteResult;
            this.logger?.info?.('Behavior implementation class deleted');
            return state;
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
     * Activate behavior implementation
     * No stateful needed - uses same session/cookies
     */
    async activate(config) {
        const state = { errors: [] };
        if (!config.className) {
            const error = new Error('Class name is required');
            state.errors.push({ method: 'activate', error, timestamp: new Date() });
            throw error;
        }
        try {
            const activateState = await this.class.activate({
                className: config.className,
            });
            state.activateResult = activateState.activateResult;
            return state;
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
     * Check behavior implementation
     */
    async check(config, status) {
        const state = { errors: [] };
        if (!config.className) {
            const error = new Error('Class name is required');
            state.errors.push({ method: 'check', error, timestamp: new Date() });
            throw error;
        }
        try {
            const checkState = await this.class.check({ className: config.className }, status);
            state.checkResult = checkState.checkResult;
            return state;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            state.errors.push({ method: 'check', error: err, timestamp: new Date() });
            this.logger?.error('check', (0, internalUtils_1.safeErrorMessage)(err));
            throw err;
        }
    }
    /**
     * Lock behavior implementation for modification
     * Delegates to AdtClass since behavior implementation is a class
     */
    async lock(config) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        return await this.class.lock({ className: config.className });
    }
    /**
     * Unlock behavior implementation
     * Delegates to AdtClass since behavior implementation is a class
     */
    async unlock(config, lockHandle) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        const unlockState = await this.class.unlock({ className: config.className }, lockHandle);
        return {
            unlockResult: unlockState.unlockResult,
            errors: [],
        };
    }
    getVersions(config) {
        return (0, versions_1.getBehaviorImplementationVersions)(this.connection, config);
    }
    getVersionSource(contentUri) {
        return (0, versions_1.getBehaviorImplementationVersionSource)(this.connection, contentUri);
    }
}
exports.AdtBehaviorImplementation = AdtBehaviorImplementation;
