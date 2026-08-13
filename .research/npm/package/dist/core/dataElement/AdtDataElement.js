"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtDataElement = void 0;
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
class AdtDataElement {
    connection;
    logger;
    systemContext;
    lockTracker;
    objectType = 'DataElement';
    constructor(connection, logger, systemContext, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
        this.lockTracker = (0, LockRegistry_1.createLockTracker)(lockRegistry, this.objectType, (name, lockHandle) => (0, unlock_1.unlockDataElement)(this.connection, name, lockHandle));
    }
    /**
     * Validate data element configuration before creation
     */
    async validate(config) {
        if (!config.dataElementName) {
            throw new Error('Data element name is required for validation');
        }
        const validationResponse = await (0, validation_1.validateDataElementName)(this.connection, config.dataElementName, config.packageName, config.description);
        return {
            validationResponse: validationResponse,
            errors: [],
        };
    }
    /**
     * Create data element with full operation chain
     */
    async create(config, options) {
        if (!config.dataElementName) {
            throw new Error('Data element name is required');
        }
        if (!config.packageName) {
            throw new Error('Package name is required');
        }
        if (!config.description) {
            throw new Error('Description is required');
        }
        if (!config.typeKind) {
            throw new Error('Type kind is required');
        }
        let objectCreated = false;
        const state = {
            errors: [],
        };
        try {
            // Create data element
            this.logger?.info?.('Creating data element');
            const createResponse = await (0, create_1.create)(this.connection, {
                data_element_name: config.dataElementName,
                package_name: config.packageName,
                transport_request: config.transportRequest,
                description: config.description,
                type_kind: config.typeKind,
                type_name: config.typeName,
                data_type: config.dataType,
                length: config.length,
                decimals: config.decimals,
                short_label: config.shortLabel,
                medium_label: config.mediumLabel,
                long_label: config.longLabel,
                heading_label: config.headingLabel,
                search_help: config.searchHelp,
                search_help_parameter: config.searchHelpParameter,
                set_get_parameter: config.setGetParameter,
                masterSystem: this.systemContext.masterSystem,
                responsible: this.systemContext.responsible,
                masterLanguage: config.masterLanguage ?? this.systemContext.masterLanguage,
            });
            state.createResult = createResponse;
            objectCreated = true;
            this.logger?.info?.('Data element created');
            return state;
        }
        catch (error) {
            // Cleanup on error - ensure stateless
            this.connection.setSessionType('stateless');
            if (objectCreated && options?.deleteOnFailure) {
                try {
                    this.logger?.warn?.('Deleting data element after failure');
                    // No stateful needed - delete doesn't use lock/unlock
                    await (0, delete_1.deleteDataElement)(this.connection, {
                        data_element_name: config.dataElementName,
                        transport_request: config.transportRequest,
                    });
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete data element after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
                }
            }
            this.logger?.error('Create failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read data element
     */
    async read(config, _version, options) {
        if (!config.dataElementName) {
            throw new Error('Data element name is required');
        }
        try {
            const response = await (0, read_1.getDataElement)(this.connection, config.dataElementName, options?.withLongPolling !== undefined
                ? { withLongPolling: options.withLongPolling }
                : undefined);
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
     * Read data element metadata (object characteristics: package, responsible, description, etc.)
     * For data elements, read() already returns metadata since there's no source code.
     */
    async readMetadata(config, options) {
        const state = { errors: [] };
        if (!config.dataElementName) {
            const error = new Error('Data element name is required');
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
                const error = new Error(`Data element '${config.dataElementName}' not found`);
                state.errors.push({
                    method: 'readMetadata',
                    error,
                    timestamp: new Date(),
                });
                throw error;
            }
            this.logger?.info?.('Data element metadata read successfully');
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
     * Update data element with full operation chain
     * Always starts with lock
     * If options.low is true, performs only low-level update without lock/check/unlock chain
     */
    async update(config, options) {
        if (!config.dataElementName) {
            throw new Error('Data element name is required');
        }
        if (!config.packageName) {
            throw new Error('Package name is required for update');
        }
        if (!config.typeKind) {
            throw new Error('Type kind is required for update');
        }
        // Low-level mode: if lockHandle is provided, perform only update operation
        if (options?.lockHandle) {
            this.logger?.info?.('Low-level update: performing update only (lockHandle provided)');
            const _domainInfo = {
                dataType: config.dataType || '',
                length: config.length || 0,
                decimals: config.decimals || 0,
            };
            const updateResponse = await (0, update_1.updateDataElement)(this.connection, {
                data_element_name: config.dataElementName,
                package_name: config.packageName,
                transport_request: config.transportRequest,
                description: config.description,
                type_kind: config.typeKind,
                type_name: config.typeName,
                data_type: config.dataType,
                length: config.length,
                decimals: config.decimals,
                short_label: config.shortLabel,
                medium_label: config.mediumLabel,
                long_label: config.longLabel,
                heading_label: config.headingLabel,
                search_help: config.searchHelp,
                search_help_parameter: config.searchHelpParameter,
                set_get_parameter: config.setGetParameter,
            }, options.lockHandle, this.logger);
            this.logger?.info?.('Data element updated (low-level)');
            return {
                updateResult: updateResponse,
                errors: [],
            };
        }
        let lockHandle;
        const state = {
            errors: [],
        };
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            // 1. Lock (update always starts with lock, stateful ONLY before lock)
            this.logger?.info?.('Step 1: Locking data element');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockDataElement)(this.connection, config.dataElementName);
            state.lockHandle = lockHandle;
            this.lockTracker.track(config.dataElementName, lockHandle);
            this.logger?.info?.('Data element locked, handle:', lockHandle);
            // 2. Check inactive with XML for update (if provided)
            const xmlToCheck = options?.xmlContent;
            if (xmlToCheck) {
                this.logger?.info?.('Step 2: Checking inactive version with update content');
                const deletionCheck = await (0, check_1.checkDataElement)(this.connection, config.dataElementName, 'inactive', xmlToCheck);
                state.checkResult = deletionCheck;
                this.logger?.info?.('Check inactive with update content passed');
            }
            // 3. Update
            if (lockHandle) {
                this.logger?.info?.('Step 3: Updating data element');
                await (0, update_1.updateDataElement)(this.connection, {
                    data_element_name: config.dataElementName,
                    package_name: config.packageName,
                    transport_request: config.transportRequest,
                    description: config.description,
                    type_kind: config.typeKind,
                    type_name: config.typeName,
                    data_type: config.dataType,
                    length: config.length,
                    decimals: config.decimals,
                    short_label: config.shortLabel,
                    medium_label: config.mediumLabel,
                    long_label: config.longLabel,
                    heading_label: config.headingLabel,
                    search_help: config.searchHelp,
                    search_help_parameter: config.searchHelpParameter,
                    set_get_parameter: config.setGetParameter,
                }, lockHandle, this.logger);
                // updateDataElement returns void, so we don't store it in state
                this.logger?.info?.('Data element updated');
                // 3.5. Read with long polling to ensure object is ready after update
                this.logger?.info?.('read (wait for object ready after update)');
                try {
                    await this.read({ dataElementName: config.dataElementName }, 'active', { withLongPolling: true });
                    this.logger?.info?.('object is ready after update');
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed after update:', (0, internalUtils_1.safeErrorMessage)(readError));
                    // Continue anyway - unlock might still work
                }
            }
            // 4. Unlock (obligatory stateless after unlock)
            if (lockHandle) {
                this.logger?.info?.('Step 4: Unlocking data element');
                this.connection.setSessionType('stateful');
                const unlockResponse = await (0, unlock_1.unlockDataElement)(this.connection, config.dataElementName, lockHandle);
                state.unlockResult = unlockResponse;
                this.connection.setSessionType('stateless');
                this.lockTracker.untrack(config.dataElementName);
                lockHandle = undefined;
                this.logger?.info?.('Data element unlocked');
            }
            // 5. Final check (no stateful needed)
            this.logger?.info?.('Step 5: Final check');
            const checkResponse2 = await (0, check_1.checkDataElement)(this.connection, config.dataElementName, 'inactive');
            state.checkResult = checkResponse2;
            this.logger?.info?.('Final check passed');
            // 6. Activate (if requested, no stateful needed - uses same session/cookies)
            if (options?.activateOnUpdate) {
                this.logger?.info?.('Step 6: Activating data element');
                const activateResponse = await (0, activation_1.activateDataElement)(this.connection, config.dataElementName);
                state.activateResult = activateResponse;
                this.logger?.info?.('Data element activated, status:', activateResponse.status);
                // 6.5. Read with long polling to ensure object is ready after activation
                this.logger?.info?.('read (wait for object ready after activation)');
                try {
                    const readState = await this.read({ dataElementName: config.dataElementName }, 'active', { withLongPolling: true });
                    if (readState) {
                        state.readResult = readState.readResult;
                    }
                    this.logger?.info?.('object is ready after activation');
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed after activation:', (0, internalUtils_1.safeErrorMessage)(readError));
                    // Continue anyway - activation was successful
                }
            }
            else {
                // Read if not activated
                const readResponse = await (0, read_1.getDataElement)(this.connection, config.dataElementName, undefined);
                state.readResult = readResponse;
            }
            return state;
        }
        catch (error) {
            // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking data element during error cleanup');
                    this.connection.setSessionType('stateful');
                    await (0, unlock_1.unlockDataElement)(this.connection, config.dataElementName, lockHandle);
                    this.connection.setSessionType('stateless');
                    this.lockTracker.untrack(config.dataElementName);
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
                    this.logger?.warn?.('Deleting data element after failure');
                    // No stateful needed - delete doesn't use lock/unlock
                    await (0, delete_1.deleteDataElement)(this.connection, {
                        data_element_name: config.dataElementName,
                        transport_request: config.transportRequest,
                    });
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete data element after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
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
     * Delete data element
     */
    async delete(config) {
        if (!config.dataElementName) {
            throw new Error('Data element name is required');
        }
        const state = {
            errors: [],
        };
        try {
            // Check for deletion (no stateful needed)
            this.logger?.info?.('Checking data element for deletion');
            const deletionCheck = await (0, delete_1.checkDeletion)(this.connection, {
                data_element_name: config.dataElementName,
                transport_request: config.transportRequest,
            });
            // ADT already said whether this may be deleted; refusing to read that
            // answer is how a delete came to report success while the object
            // stayed. Throws on isDeletable=false or a message of type E; a W
            // is a warning and passes.
            (0, deletionCheck_1.assertDeletable)(deletionCheck.data);
            state.checkResult = deletionCheck;
            this.logger?.info?.('Deletion check passed');
            // Delete (no stateful needed - no lock/unlock)
            this.logger?.info?.('Deleting data element');
            const deleteResponse = await (0, delete_1.deleteDataElement)(this.connection, {
                data_element_name: config.dataElementName,
                transport_request: config.transportRequest,
            });
            state.deleteResult = deleteResponse;
            this.logger?.info?.('Data element deleted');
            return state;
        }
        catch (error) {
            this.logger?.error('Delete failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Activate data element
     * No stateful needed - uses same session/cookies
     */
    async activate(config) {
        if (!config.dataElementName) {
            throw new Error('Data element name is required');
        }
        const state = {
            errors: [],
        };
        try {
            const activateResponse = await (0, activation_1.activateDataElement)(this.connection, config.dataElementName);
            state.activateResult = activateResponse;
            return state;
        }
        catch (error) {
            this.logger?.error('Activate failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Check data element
     */
    async check(config, status) {
        if (!config.dataElementName) {
            throw new Error('Data element name is required');
        }
        const state = {
            errors: [],
        };
        // Map status to version
        const version = status === 'active' ? 'active' : 'inactive';
        const deletionCheck = await (0, check_1.checkDataElement)(this.connection, config.dataElementName, version);
        state.checkResult = deletionCheck;
        return state;
    }
    /**
     * Read transport request information for the data element
     */
    async readTransport(config, options) {
        const state = {
            errors: [],
        };
        if (!config.dataElementName) {
            const error = new Error('Data element name is required');
            state.errors.push({
                method: 'readTransport',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getDataElementTransport)(this.connection, config.dataElementName, options?.withLongPolling !== undefined
                ? { withLongPolling: options.withLongPolling }
                : undefined);
            state.transportResult = response;
            this.logger?.info?.('Transport request read successfully');
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
     * Lock data element for modification
     */
    async lock(config) {
        if (!config.dataElementName) {
            throw new Error('Data element name is required');
        }
        this.connection.setSessionType('stateful');
        const lockHandle = await (0, lock_1.lockDataElement)(this.connection, config.dataElementName);
        this.lockTracker.track(config.dataElementName, lockHandle);
        return lockHandle;
    }
    /**
     * Unlock data element
     */
    async unlock(config, lockHandle) {
        if (!config.dataElementName) {
            throw new Error('Data element name is required');
        }
        this.connection.setSessionType('stateful');
        const result = await (0, unlock_1.unlockDataElement)(this.connection, config.dataElementName, lockHandle);
        this.connection.setSessionType('stateless');
        this.lockTracker.untrack(config.dataElementName);
        return {
            unlockResult: result,
            errors: [],
        };
    }
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    async getVersions(_config) {
        (0, versions_1.throwUnsupportedVersions)('data element');
    }
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    async getVersionSource(_contentUri) {
        (0, versions_1.throwUnsupportedVersions)('data element');
    }
}
exports.AdtDataElement = AdtDataElement;
