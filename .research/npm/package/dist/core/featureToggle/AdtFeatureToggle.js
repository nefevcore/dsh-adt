"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtFeatureToggle = void 0;
const criticalSection_1 = require("../../utils/criticalSection");
const deletionCheck_1 = require("../../utils/deletionCheck");
const internalUtils_1 = require("../../utils/internalUtils");
const LockRegistry_1 = require("../shared/LockRegistry");
const versions_1 = require("../shared/versions");
const activation_1 = require("./activation");
const check_1 = require("./check");
const checkState_1 = require("./checkState");
const create_1 = require("./create");
const delete_1 = require("./delete");
const getState_1 = require("./getState");
const lock_1 = require("./lock");
const read_1 = require("./read");
const readSource_1 = require("./readSource");
const switch_1 = require("./switch");
const unlock_1 = require("./unlock");
const update_1 = require("./update");
const updateSource_1 = require("./updateSource");
const validation_1 = require("./validation");
class AdtFeatureToggle {
    connection;
    logger;
    systemContext;
    lockTracker;
    objectType = 'FeatureToggle';
    constructor(connection, logger, systemContext, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
        this.lockTracker = (0, LockRegistry_1.createLockTracker)(lockRegistry, this.objectType, (featureToggleName, lockHandle) => (0, unlock_1.unlockFeatureToggle)(this.connection, featureToggleName, lockHandle));
    }
    /**
     * Map camelCase config to the snake_case low-level params.
     * `source` is passed through unchanged (it is a structured JSON object,
     * not a snake_case DTO).
     */
    buildCreateParams(config) {
        return {
            feature_toggle_name: config.featureToggleName,
            package_name: config.packageName ?? '',
            description: config.description,
            transport_request: config.transportRequest,
            master_system: config.masterSystem ?? this.systemContext.masterSystem,
            responsible: config.responsible ?? this.systemContext.responsible,
            source: config.source,
        };
    }
    buildDeleteParams(config) {
        return {
            feature_toggle_name: config.featureToggleName ?? '',
            transport_request: config.transportRequest,
        };
    }
    /**
     * Validate feature toggle name against SAP naming rules.
     */
    async validate(config) {
        if (!config.featureToggleName) {
            throw new Error('Feature toggle name is required for validation');
        }
        const validationResponse = await (0, validation_1.validateFeatureToggleName)(this.connection, config.featureToggleName, config.packageName, config.description);
        return {
            validationResponse,
            errors: [],
        };
    }
    /**
     * Create feature toggle. If config.source is provided, follows up with a
     * source-upload sub-chain (lock → upload → unlock → activate).
     */
    async create(config, options) {
        if (!config.featureToggleName) {
            throw new Error('Feature toggle name is required');
        }
        if (!config.packageName) {
            throw new Error('Package name is required');
        }
        if (!config.description) {
            throw new Error('Description is required');
        }
        let objectCreated = false;
        let lockHandle;
        const state = { errors: [] };
        const params = this.buildCreateParams(config);
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            this.logger?.info?.('Creating feature toggle');
            const createResponse = await (0, create_1.create)(this.connection, params);
            state.createResult = createResponse;
            objectCreated = true;
            this.logger?.info?.('Feature toggle created');
            if (config.source) {
                this.logger?.info?.('Source provided — running source-upload sub-chain');
                // 1. Lock
                this.connection.setSessionType('stateful');
                lockHandle = await (0, lock_1.lockFeatureToggle)(this.connection, config.featureToggleName, this.logger);
                state.lockHandle = lockHandle;
                this.lockTracker.track(config.featureToggleName, lockHandle);
                config.onLock?.(lockHandle);
                this.logger?.info?.('Feature toggle locked, handle:', lockHandle);
                // 2. Upload source
                await (0, updateSource_1.uploadFeatureToggleSource)(this.connection, config.featureToggleName, config.source, lockHandle, config.transportRequest);
                this.logger?.info?.('Source uploaded');
                // 3. Unlock
                this.connection.setSessionType('stateful');
                await (0, unlock_1.unlockFeatureToggle)(this.connection, config.featureToggleName, lockHandle);
                this.connection.setSessionType('stateless');
                this.lockTracker.untrack(config.featureToggleName);
                lockHandle = undefined;
                this.logger?.info?.('Feature toggle unlocked');
                // 4. Activate
                const activateResponse = await (0, activation_1.activateFeatureToggle)(this.connection, config.featureToggleName);
                state.activateResult = activateResponse;
                this.logger?.info?.('Feature toggle activated, status:', activateResponse.status);
            }
            return state;
        }
        catch (error) {
            // Error cleanup: try to unlock (if captured), then stateless
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking feature toggle during create error cleanup');
                    this.connection.setSessionType('stateful');
                    await (0, unlock_1.unlockFeatureToggle)(this.connection, config.featureToggleName, lockHandle);
                    this.lockTracker.untrack(config.featureToggleName);
                }
                catch (unlockError) {
                    this.logger?.warn?.('Failed to unlock during cleanup:', (0, internalUtils_1.safeErrorMessage)(unlockError));
                }
            }
            this.connection.setSessionType('stateless');
            if (objectCreated && options?.deleteOnFailure) {
                try {
                    this.logger?.warn?.('Deleting feature toggle after failure');
                    await (0, delete_1.deleteFeatureToggle)(this.connection, this.buildDeleteParams(config));
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete feature toggle after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
                }
            }
            this.logger?.error('Create failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
        finally {
            endCriticalSection();
        }
    }
    /**
     * Read feature toggle metadata XML.
     */
    async read(config, version, 
    // withLongPolling accepted per IAdtObject, but not forwarded: SFW readiness
    // is a plain GET (endpoint support unverified — on-prem only).
    options) {
        if (!config.featureToggleName) {
            throw new Error('Feature toggle name is required');
        }
        try {
            const response = await (0, read_1.readFeatureToggle)(this.connection, config.featureToggleName, version ?? 'active');
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
            this.logger?.error('Read failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read metadata — feature-toggle GET returns the full metadata XML,
     * so this delegates to read().
     */
    async readMetadata(config, options) {
        const state = { errors: [] };
        if (!config.featureToggleName) {
            const error = new Error('Feature toggle name is required');
            state.errors.push({
                method: 'readMetadata',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const readState = await this.read(config, options?.version ?? 'active', options);
            if (readState) {
                state.metadataResult = readState.readResult;
                state.readResult = readState.readResult;
            }
            else {
                const error = new Error(`Feature toggle '${config.featureToggleName}' not found`);
                state.errors.push({
                    method: 'readMetadata',
                    error,
                    timestamp: new Date(),
                });
                throw error;
            }
            this.logger?.info?.('Feature toggle metadata read successfully');
            return state;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            // Avoid duplicate push if we already pushed above
            if (!state.errors.some((e) => e.error === err)) {
                state.errors.push({
                    method: 'readMetadata',
                    error: err,
                    timestamp: new Date(),
                });
            }
            this.logger?.error('readMetadata', (0, internalUtils_1.safeErrorMessage)(err));
            throw err;
        }
    }
    /**
     * Update feature toggle with full operation chain.
     * When config.source is provided, uploads JSON source after metadata PUT.
     */
    async update(config, options) {
        if (!config.featureToggleName) {
            throw new Error('Feature toggle name is required');
        }
        if (!config.packageName) {
            throw new Error('Package name is required for update');
        }
        const fullConfig = {
            ...config,
        };
        const params = this.buildCreateParams(fullConfig);
        // Low-level mode: if lockHandle is provided, perform only update + optional source upload
        if (options?.lockHandle) {
            this.logger?.info?.('Low-level update: performing update only (lockHandle provided)');
            await (0, update_1.updateFeatureToggle)(this.connection, params, options.lockHandle, this.logger);
            if (fullConfig.source) {
                await (0, updateSource_1.uploadFeatureToggleSource)(this.connection, fullConfig.featureToggleName, fullConfig.source, options.lockHandle, fullConfig.transportRequest);
            }
            this.logger?.info?.('Feature toggle updated (low-level)');
            return { errors: [] };
        }
        let lockHandle;
        const state = { errors: [] };
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            // 1. Lock
            this.logger?.info?.('Step 1: Locking feature toggle');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockFeatureToggle)(this.connection, fullConfig.featureToggleName, this.logger);
            state.lockHandle = lockHandle;
            this.lockTracker.track(fullConfig.featureToggleName, lockHandle);
            fullConfig.onLock?.(lockHandle);
            this.logger?.info?.('Feature toggle locked, handle:', lockHandle);
            // 2. Check inactive with XML for update (if provided)
            const xmlToCheck = options?.xmlContent;
            if (xmlToCheck) {
                this.logger?.info?.('Step 2: Checking inactive version with update content');
                const deletionCheck = await (0, check_1.checkFeatureToggle)(this.connection, fullConfig.featureToggleName, 'inactive', xmlToCheck);
                state.checkResult = deletionCheck;
                this.logger?.info?.('Check inactive with update content passed');
            }
            // 3. Update metadata
            this.logger?.info?.('Step 3: Updating feature toggle metadata');
            await (0, update_1.updateFeatureToggle)(this.connection, params, lockHandle, this.logger);
            this.logger?.info?.('Feature toggle metadata updated');
            // 3.1. Upload source if provided
            if (fullConfig.source) {
                this.logger?.info?.('Step 3.1: Uploading feature toggle source');
                await (0, updateSource_1.uploadFeatureToggleSource)(this.connection, fullConfig.featureToggleName, fullConfig.source, lockHandle, fullConfig.transportRequest);
                this.logger?.info?.('Feature toggle source uploaded');
            }
            // Poll the inactive version: the write above produced it; the active version may not exist yet.
            // 3.5. Read with long polling to ensure object is ready after update
            this.logger?.info?.('read (wait for object ready after update)');
            try {
                const readState = await this.read({ featureToggleName: fullConfig.featureToggleName }, 'inactive');
                if (readState) {
                    state.readResult = readState.readResult;
                }
                this.logger?.info?.('object is ready after update');
            }
            catch (readError) {
                this.logger?.warn?.('read with long polling failed after update:', (0, internalUtils_1.safeErrorMessage)(readError));
            }
            // 4. Unlock
            this.logger?.info?.('Step 4: Unlocking feature toggle');
            this.connection.setSessionType('stateful');
            await (0, unlock_1.unlockFeatureToggle)(this.connection, fullConfig.featureToggleName, lockHandle);
            this.connection.setSessionType('stateless');
            this.lockTracker.untrack(fullConfig.featureToggleName);
            lockHandle = undefined;
            this.logger?.info?.('Feature toggle unlocked');
            // 5. Final check
            this.logger?.info?.('Step 5: Final check');
            const finalCheck = await (0, check_1.checkFeatureToggle)(this.connection, fullConfig.featureToggleName, 'inactive');
            state.checkResult = finalCheck;
            this.logger?.info?.('Final check passed');
            // 6. Activate (optional)
            if (options?.activateOnUpdate && state.errors.length === 0) {
                this.logger?.info?.('Step 6: Activating feature toggle');
                const activateResponse = await (0, activation_1.activateFeatureToggle)(this.connection, fullConfig.featureToggleName);
                state.activateResult = activateResponse;
                this.logger?.info?.('Feature toggle activated, status:', activateResponse.status);
                try {
                    const readState = await this.read({ featureToggleName: fullConfig.featureToggleName }, 'active');
                    if (readState) {
                        state.readResult = readState.readResult;
                    }
                    this.logger?.info?.('object is ready after activation');
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed after activation:', (0, internalUtils_1.safeErrorMessage)(readError));
                }
            }
            return state;
        }
        catch (error) {
            // Error cleanup: try to unlock (lockHandle preserved for force unlock),
            // then make sure the session is stateless.
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking feature toggle during error cleanup');
                    this.connection.setSessionType('stateful');
                    await (0, unlock_1.unlockFeatureToggle)(this.connection, fullConfig.featureToggleName, lockHandle);
                    this.connection.setSessionType('stateless');
                    this.lockTracker.untrack(fullConfig.featureToggleName);
                }
                catch (unlockError) {
                    this.logger?.warn?.('Failed to unlock during cleanup:', (0, internalUtils_1.safeErrorMessage)(unlockError));
                }
            }
            else {
                this.connection.setSessionType('stateless');
            }
            if (options?.deleteOnFailure) {
                try {
                    this.logger?.warn?.('Deleting feature toggle after failure');
                    await (0, delete_1.deleteFeatureToggle)(this.connection, this.buildDeleteParams(fullConfig));
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete feature toggle after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
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
     * Delete feature toggle.
     */
    async delete(config) {
        if (!config.featureToggleName) {
            throw new Error('Feature toggle name is required');
        }
        const state = { errors: [] };
        try {
            this.logger?.info?.('Checking feature toggle for deletion');
            const deletionCheck = await (0, delete_1.checkDeletion)(this.connection, this.buildDeleteParams(config));
            // ADT already said whether this may be deleted; refusing to read that
            // answer is how a delete came to report success while the object
            // stayed. Throws on isDeletable=false or a message of type E; a W
            // is a warning and passes.
            (0, deletionCheck_1.assertDeletable)(deletionCheck.data);
            state.checkResult = deletionCheck;
            this.logger?.info?.('Deletion check passed');
            this.logger?.info?.('Deleting feature toggle');
            const deleteResponse = await (0, delete_1.deleteFeatureToggle)(this.connection, this.buildDeleteParams(config));
            state.deleteResult = deleteResponse;
            this.logger?.info?.('Feature toggle deleted');
            return state;
        }
        catch (error) {
            this.logger?.error('Delete failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Activate feature toggle.
     */
    async activate(config) {
        if (!config.featureToggleName) {
            throw new Error('Feature toggle name is required');
        }
        const state = { errors: [] };
        try {
            const activateResponse = await (0, activation_1.activateFeatureToggle)(this.connection, config.featureToggleName);
            state.activateResult = activateResponse;
            return state;
        }
        catch (error) {
            this.logger?.error('Activate failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Check feature toggle.
     */
    async check(config, status) {
        if (!config.featureToggleName) {
            throw new Error('Feature toggle name is required');
        }
        const version = status === 'active' ? 'active' : 'inactive';
        const deletionCheck = await (0, check_1.checkFeatureToggle)(this.connection, config.featureToggleName, version);
        return {
            checkResult: deletionCheck,
            errors: [],
        };
    }
    /**
     * Read transport info — not supported for feature toggles.
     */
    async readTransport(_config, _options) {
        return {
            errors: [
                {
                    method: 'readTransport',
                    error: new Error('readTransport is not supported for feature toggles'),
                    timestamp: new Date(),
                },
            ],
        };
    }
    /**
     * Lock feature toggle for modification.
     */
    async lock(config) {
        if (!config.featureToggleName) {
            throw new Error('Feature toggle name is required');
        }
        this.connection.setSessionType('stateful');
        const lockHandle = await (0, lock_1.lockFeatureToggle)(this.connection, config.featureToggleName, this.logger);
        this.lockTracker.track(config.featureToggleName, lockHandle);
        return lockHandle;
    }
    /**
     * Unlock feature toggle.
     */
    async unlock(config, lockHandle) {
        if (!config.featureToggleName) {
            throw new Error('Feature toggle name is required');
        }
        this.connection.setSessionType('stateful');
        await (0, unlock_1.unlockFeatureToggle)(this.connection, config.featureToggleName, lockHandle);
        this.connection.setSessionType('stateless');
        this.lockTracker.untrack(config.featureToggleName);
        return { errors: [] };
    }
    // ---------------------------------------------------------------------------
    // Domain methods — beyond IAdtObject surface
    // ---------------------------------------------------------------------------
    async switchOn(config, opts) {
        return this.switchTo(config, opts, 'on');
    }
    async switchOff(config, opts) {
        return this.switchTo(config, opts, 'off');
    }
    async switchTo(config, opts, targetState) {
        const name = this.requireName(config);
        const state = { errors: [] };
        try {
            await (0, switch_1.toggleFeatureToggle)(this.connection, {
                feature_toggle_name: name,
                state: targetState,
                is_user_specific: Boolean(opts.userSpecific),
                transport_request: opts.transportRequest,
            });
            state.runtimeState = await (0, getState_1.getFeatureToggleState)(this.connection, name);
        }
        catch (error) {
            state.errors.push({
                method: targetState === 'on' ? 'switchOn' : 'switchOff',
                error: error,
                timestamp: new Date(),
            });
            throw error;
        }
        return state;
    }
    async getRuntimeState(config) {
        const name = this.requireName(config);
        const state = { errors: [] };
        try {
            state.runtimeState = await (0, getState_1.getFeatureToggleState)(this.connection, name);
        }
        catch (error) {
            state.errors.push({
                method: 'getRuntimeState',
                error: error,
                timestamp: new Date(),
            });
            throw error;
        }
        return state;
    }
    async checkState(config, opts) {
        const name = this.requireName(config);
        const state = { errors: [] };
        try {
            state.checkStateResult = await (0, checkState_1.checkFeatureToggleState)(this.connection, name, opts);
        }
        catch (error) {
            state.errors.push({
                method: 'checkState',
                error: error,
                timestamp: new Date(),
            });
            throw error;
        }
        return state;
    }
    async readSource(config, version = 'active') {
        const name = this.requireName(config);
        const state = { errors: [] };
        try {
            const resp = await (0, readSource_1.readFeatureToggleSource)(this.connection, name, version);
            state.readResult = resp;
            const parsed = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
            state.sourceResult = parsed;
        }
        catch (error) {
            state.errors.push({
                method: 'readSource',
                error: error,
                timestamp: new Date(),
            });
            throw error;
        }
        return state;
    }
    requireName(config) {
        if (!config.featureToggleName) {
            throw new Error('Feature toggle name is required');
        }
        return config.featureToggleName;
    }
    async getVersions(_config) {
        (0, versions_1.throwUnsupportedVersions)('feature toggle');
    }
    async getVersionSource(_contentUri) {
        (0, versions_1.throwUnsupportedVersions)('feature toggle');
    }
}
exports.AdtFeatureToggle = AdtFeatureToggle;
