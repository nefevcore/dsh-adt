"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtAuthorizationField = void 0;
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
const unlock_1 = require("./unlock");
const update_1 = require("./update");
const validation_1 = require("./validation");
class AdtAuthorizationField {
    connection;
    logger;
    systemContext;
    lockTracker;
    objectType = 'AuthorizationField';
    constructor(connection, logger, systemContext, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
        this.lockTracker = (0, LockRegistry_1.createLockTracker)(lockRegistry, this.objectType, (name, lockHandle) => (0, unlock_1.unlockAuthorizationField)(this.connection, name, lockHandle));
    }
    /**
     * Map camelCase config to the snake_case low-level params the functions expect.
     * Kept private — callers should always go through the handler.
     */
    buildCreateParams(config) {
        return {
            authorization_field_name: config.authorizationFieldName,
            description: config.description,
            package_name: config.packageName ?? '',
            transport_request: config.transportRequest,
            master_system: config.masterSystem ?? this.systemContext.masterSystem,
            responsible: config.responsible ?? this.systemContext.responsible,
            field_name: config.fieldName,
            roll_name: config.rollName,
            check_table: config.checkTable,
            exit_fb: config.exitFb,
            abap_language_version: config.abapLanguageVersion,
            search: config.search,
            objexit: config.objexit,
            domname: config.domname,
            outputlen: config.outputlen,
            convexit: config.convexit,
            orglvlinfo: config.orglvlinfo,
            col_searchhelp: config.colSearchhelp,
            col_searchhelp_name: config.colSearchhelpName,
            col_searchhelp_descr: config.colSearchhelpDescr,
        };
    }
    buildDeleteParams(config) {
        return {
            authorization_field_name: config.authorizationFieldName ?? '',
            transport_request: config.transportRequest,
        };
    }
    /**
     * Validate authorization field name against SAP naming rules.
     */
    async validate(config) {
        if (!config.authorizationFieldName) {
            throw new Error('Authorization field name is required for validation');
        }
        const validationResponse = await (0, validation_1.validateAuthorizationFieldName)(this.connection, config.authorizationFieldName, config.packageName, config.description);
        return {
            validationResponse,
            errors: [],
        };
    }
    /**
     * Create authorization field.
     */
    async create(config, options) {
        if (!config.authorizationFieldName) {
            throw new Error('Authorization field name is required');
        }
        if (!config.packageName) {
            throw new Error('Package name is required');
        }
        if (!config.description) {
            throw new Error('Description is required');
        }
        let objectCreated = false;
        const state = { errors: [] };
        try {
            this.logger?.info?.('Creating authorization field');
            const createResponse = await (0, create_1.create)(this.connection, this.buildCreateParams(config));
            state.createResult = createResponse;
            objectCreated = true;
            this.logger?.info?.('Authorization field created');
            return state;
        }
        catch (error) {
            this.connection.setSessionType('stateless');
            if (objectCreated && options?.deleteOnFailure) {
                try {
                    this.logger?.warn?.('Deleting authorization field after failure');
                    await (0, delete_1.deleteAuthorizationField)(this.connection, this.buildDeleteParams(config));
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete authorization field after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
                }
            }
            this.logger?.error('Create failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read authorization field metadata.
     */
    async read(config, version, options) {
        if (!config.authorizationFieldName) {
            throw new Error('Authorization field name is required');
        }
        try {
            const response = await (0, read_1.readAuthorizationField)(this.connection, config.authorizationFieldName, version ?? 'active', options);
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
     * Read metadata — for metadata-only objects, read() already returns it.
     */
    async readMetadata(config, options) {
        const state = { errors: [] };
        if (!config.authorizationFieldName) {
            const error = new Error('Authorization field name is required');
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
                const error = new Error(`Authorization field '${config.authorizationFieldName}' not found`);
                state.errors.push({
                    method: 'readMetadata',
                    error,
                    timestamp: new Date(),
                });
                throw error;
            }
            this.logger?.info?.('Authorization field metadata read successfully');
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
     * Update authorization field with full operation chain.
     */
    async update(config, options) {
        if (!config.authorizationFieldName) {
            throw new Error('Authorization field name is required');
        }
        if (!config.packageName) {
            throw new Error('Package name is required for update');
        }
        const fullConfig = {
            ...config,
        };
        const params = this.buildCreateParams(fullConfig);
        // Low-level mode: if lockHandle is provided, perform only update
        if (options?.lockHandle) {
            this.logger?.info?.('Low-level update: performing update only (lockHandle provided)');
            await (0, update_1.updateAuthorizationField)(this.connection, params, options.lockHandle, this.logger);
            this.logger?.info?.('Authorization field updated (low-level)');
            return { errors: [] };
        }
        let lockHandle;
        const state = { errors: [] };
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            // 1. Lock
            this.logger?.info?.('Step 1: Locking authorization field');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockAuthorizationField)(this.connection, fullConfig.authorizationFieldName, this.logger);
            state.lockHandle = lockHandle;
            this.lockTracker.track(fullConfig.authorizationFieldName, lockHandle);
            fullConfig.onLock?.(lockHandle);
            this.logger?.info?.('Authorization field locked, handle:', lockHandle);
            // 2. Check inactive with XML for update (if provided)
            const xmlToCheck = options?.xmlContent;
            if (xmlToCheck) {
                this.logger?.info?.('Step 2: Checking inactive version with update content');
                const deletionCheck = await (0, check_1.checkAuthorizationField)(this.connection, fullConfig.authorizationFieldName, 'inactive', xmlToCheck);
                state.checkResult = deletionCheck;
                this.logger?.info?.('Check inactive with update content passed');
            }
            // 3. Update
            this.logger?.info?.('Step 3: Updating authorization field');
            await (0, update_1.updateAuthorizationField)(this.connection, params, lockHandle, this.logger);
            this.logger?.info?.('Authorization field updated');
            // Poll the inactive version: the write above produced it; the active version may not exist yet.
            // 3.5. Read with long polling to ensure object is ready after update
            this.logger?.info?.('read (wait for object ready after update)');
            try {
                await this.read({ authorizationFieldName: fullConfig.authorizationFieldName }, 'inactive', { withLongPolling: true });
                this.logger?.info?.('object is ready after update');
            }
            catch (readError) {
                this.logger?.warn?.('read with long polling failed after update:', (0, internalUtils_1.safeErrorMessage)(readError));
            }
            // 4. Unlock
            this.logger?.info?.('Step 4: Unlocking authorization field');
            this.connection.setSessionType('stateful');
            await (0, unlock_1.unlockAuthorizationField)(this.connection, fullConfig.authorizationFieldName, lockHandle);
            this.connection.setSessionType('stateless');
            this.lockTracker.untrack(fullConfig.authorizationFieldName);
            lockHandle = undefined;
            this.logger?.info?.('Authorization field unlocked');
            // 5. Final check
            this.logger?.info?.('Step 5: Final check');
            const finalCheck = await (0, check_1.checkAuthorizationField)(this.connection, fullConfig.authorizationFieldName, 'inactive');
            state.checkResult = finalCheck;
            this.logger?.info?.('Final check passed');
            // 6. Activate (optional)
            if (options?.activateOnUpdate) {
                this.logger?.info?.('Step 6: Activating authorization field');
                const activateResponse = await (0, activation_1.activateAuthorizationField)(this.connection, fullConfig.authorizationFieldName);
                state.activateResult = activateResponse;
                this.logger?.info?.('Authorization field activated, status:', activateResponse.status);
                try {
                    const readState = await this.read({ authorizationFieldName: fullConfig.authorizationFieldName }, 'active', { withLongPolling: true });
                    if (readState) {
                        state.readResult = readState.readResult;
                    }
                    this.logger?.info?.('object is ready after activation');
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed after activation:', (0, internalUtils_1.safeErrorMessage)(readError));
                }
            }
            else {
                // No activation happened: return the version just written (inactive),
                // not the stale active one.
                const readResponse = await (0, read_1.readAuthorizationField)(this.connection, fullConfig.authorizationFieldName, 'inactive');
                state.readResult = readResponse;
            }
            return state;
        }
        catch (error) {
            // Error cleanup: try to unlock (lockHandle preserved for force unlock),
            // then make sure the session is stateless.
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking authorization field during error cleanup');
                    this.connection.setSessionType('stateful');
                    await (0, unlock_1.unlockAuthorizationField)(this.connection, fullConfig.authorizationFieldName, lockHandle);
                    this.connection.setSessionType('stateless');
                    this.lockTracker.untrack(fullConfig.authorizationFieldName);
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
                    this.logger?.warn?.('Deleting authorization field after failure');
                    await (0, delete_1.deleteAuthorizationField)(this.connection, this.buildDeleteParams(fullConfig));
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete authorization field after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
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
     * Delete authorization field.
     */
    async delete(config) {
        if (!config.authorizationFieldName) {
            throw new Error('Authorization field name is required');
        }
        const state = { errors: [] };
        try {
            this.logger?.info?.('Checking authorization field for deletion');
            const deletionCheck = await (0, delete_1.checkDeletion)(this.connection, this.buildDeleteParams(config));
            // ADT already said whether this may be deleted; refusing to read that
            // answer is how a delete came to report success while the object
            // stayed. Throws on isDeletable=false or a message of type E; a W
            // is a warning and passes.
            (0, deletionCheck_1.assertDeletable)(deletionCheck.data);
            state.checkResult = deletionCheck;
            this.logger?.info?.('Deletion check passed');
            this.logger?.info?.('Deleting authorization field');
            const deleteResponse = await (0, delete_1.deleteAuthorizationField)(this.connection, this.buildDeleteParams(config));
            state.deleteResult = deleteResponse;
            this.logger?.info?.('Authorization field deleted');
            return state;
        }
        catch (error) {
            this.logger?.error('Delete failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Activate authorization field.
     */
    async activate(config) {
        if (!config.authorizationFieldName) {
            throw new Error('Authorization field name is required');
        }
        const state = { errors: [] };
        try {
            const activateResponse = await (0, activation_1.activateAuthorizationField)(this.connection, config.authorizationFieldName);
            state.activateResult = activateResponse;
            return state;
        }
        catch (error) {
            this.logger?.error('Activate failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Check authorization field.
     */
    async check(config, status) {
        if (!config.authorizationFieldName) {
            throw new Error('Authorization field name is required');
        }
        const version = status === 'active' ? 'active' : 'inactive';
        const deletionCheck = await (0, check_1.checkAuthorizationField)(this.connection, config.authorizationFieldName, version);
        return {
            checkResult: deletionCheck,
            errors: [],
        };
    }
    /**
     * Read transport info — not supported by the APS IAM endpoint yet.
     *
     * @deprecated Not part of this handler's capability set; throws. Removed in a later major.
     */
    async readTransport() {
        const error = new Error('readTransport is not supported for authorization fields');
        return {
            errors: [{ method: 'readTransport', error, timestamp: new Date() }],
        };
    }
    /**
     * Lock authorization field for modification.
     */
    async lock(config) {
        if (!config.authorizationFieldName) {
            throw new Error('Authorization field name is required');
        }
        this.connection.setSessionType('stateful');
        const lockHandle = await (0, lock_1.lockAuthorizationField)(this.connection, config.authorizationFieldName, this.logger);
        this.lockTracker.track(config.authorizationFieldName, lockHandle);
        return lockHandle;
    }
    /**
     * Unlock authorization field.
     */
    async unlock(config, lockHandle) {
        if (!config.authorizationFieldName) {
            throw new Error('Authorization field name is required');
        }
        this.connection.setSessionType('stateful');
        await (0, unlock_1.unlockAuthorizationField)(this.connection, config.authorizationFieldName, lockHandle);
        this.connection.setSessionType('stateless');
        this.lockTracker.untrack(config.authorizationFieldName);
        return { errors: [] };
    }
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    async getVersions(_config) {
        (0, versions_1.throwUnsupportedVersions)('authorization field');
    }
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    async getVersionSource(_contentUri) {
        (0, versions_1.throwUnsupportedVersions)('authorization field');
    }
}
exports.AdtAuthorizationField = AdtAuthorizationField;
