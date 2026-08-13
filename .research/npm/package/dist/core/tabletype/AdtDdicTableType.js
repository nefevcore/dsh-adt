"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtDdicTableType = void 0;
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
class AdtDdicTableType {
    connection;
    logger;
    systemContext;
    lockTracker;
    objectType = 'TableType';
    constructor(connection, logger, systemContext, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
        this.lockTracker = (0, LockRegistry_1.createLockTracker)(lockRegistry, this.objectType, (name, lockHandle) => (0, unlock_1.unlockTableType)(this.connection, name, lockHandle));
    }
    /**
     * Validate table type configuration before creation
     */
    async validate(config) {
        if (!config.tableTypeName) {
            throw new Error('Table type name is required for validation');
        }
        const validationResponse = await (0, validation_1.validateTableTypeName)(this.connection, config.tableTypeName, config.description);
        return { validationResponse, errors: [] };
    }
    /**
     * Create table type with full operation chain
     */
    async create(config, options) {
        if (!config.tableTypeName) {
            throw new Error('Table type name is required');
        }
        if (!config.packageName) {
            throw new Error('Package name is required');
        }
        let objectCreated = false;
        const state = {
            errors: [],
        };
        try {
            // Create empty table type (XML-based entity like Domain/DataElement)
            // rowType is added via update() method
            this.logger?.info?.('Creating table type');
            const createResponse = await (0, create_1.createTableType)(this.connection, {
                tabletype_name: config.tableTypeName,
                package_name: config.packageName,
                description: config.description,
                transport_request: config.transportRequest,
                masterSystem: this.systemContext.masterSystem,
                responsible: this.systemContext.responsible,
                masterLanguage: config.masterLanguage ?? this.systemContext.masterLanguage,
            });
            objectCreated = true;
            state.createResult = createResponse;
            this.logger?.info?.('Table type created');
            return state;
        }
        catch (error) {
            // Cleanup on error - ensure stateless
            this.connection.setSessionType('stateless');
            if (objectCreated && options?.deleteOnFailure) {
                try {
                    this.logger?.warn?.('Deleting table type after failure');
                    await (0, delete_1.deleteTableType)(this.connection, {
                        tabletype_name: config.tableTypeName,
                        transport_request: config.transportRequest,
                    });
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete table type after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
                }
            }
            this.logger?.error('Create failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read table type metadata (TableType is XML-based entity like Domain/DataElement)
     */
    async read(config, _version, options) {
        if (!config.tableTypeName) {
            throw new Error('Table type name is required');
        }
        // TableType is XML-based, read metadata
        try {
            const readResult = await (0, read_1.getTableTypeMetadata)(this.connection, config.tableTypeName, options, this.logger);
            return { readResult, errors: [] };
        }
        catch (error) {
            const e = error;
            // If metadata read fails with 404, return empty result
            if (e.response?.status === 404) {
                return { readResult: undefined, errors: [] };
            }
            throw error;
        }
    }
    /**
     * Read table type metadata (object characteristics: package, responsible, description, etc.)
     */
    async readMetadata(config, options) {
        const state = { errors: [] };
        if (!config.tableTypeName) {
            const error = new Error('Table type name is required');
            state.errors.push({
                method: 'readMetadata',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getTableTypeMetadata)(this.connection, config.tableTypeName, options, this.logger);
            state.metadataResult = response;
            this.logger?.info?.('Table type metadata read successfully');
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
     * Read transport request information for the table type
     */
    async readTransport(config, options) {
        const state = { errors: [] };
        if (!config.tableTypeName) {
            const error = new Error('Table type name is required');
            state.errors.push({
                method: 'readTransport',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getTableTypeTransport)(this.connection, config.tableTypeName, options?.withLongPolling !== undefined
                ? { withLongPolling: options.withLongPolling }
                : undefined);
            state.transportResult = response;
            this.logger?.info?.('Table type transport request read successfully');
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
     * Update table type with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    async update(config, options) {
        if (!config.tableTypeName) {
            throw new Error('Table type name is required');
        }
        // Low-level mode: if lockHandle is provided, perform only update operation
        if (options?.lockHandle) {
            const hasRowType = config.rowTypeName && config.rowTypeName.trim().length > 0;
            if (!hasRowType || !config.rowTypeName) {
                throw new Error('rowTypeName is required for update');
            }
            this.logger?.info?.('Low-level update: performing update only (lockHandle provided)');
            const updateResponse = await (0, update_1.updateTableType)(this.connection, {
                tabletype_name: config.tableTypeName,
                description: config.description,
                row_type_name: config.rowTypeName,
                row_type_kind: config.rowTypeKind || 'dictionaryType',
                access_type: config.accessType || 'standard',
                primary_key_definition: config.primaryKeyDefinition || 'standard',
                primary_key_kind: config.primaryKeyKind || 'nonUnique',
                transport_request: config.transportRequest,
            }, options.lockHandle, this.logger);
            this.logger?.info?.('Table type updated (low-level)');
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
            this.logger?.info?.('Step 1: Locking table type');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.acquireTableTypeLockHandle)(this.connection, config.tableTypeName);
            this.lockTracker.track(config.tableTypeName, lockHandle);
            this.logger?.info?.('Table type locked, handle:', lockHandle);
            // 2. Check inactive (TableType is XML-based, no source code check needed)
            // Skip check step for XML-based TableType
            // 3. Update
            // TableType is XML-based entity (like Domain/DataElement)
            const hasRowType = config.rowTypeName && config.rowTypeName.trim().length > 0;
            if (hasRowType && lockHandle && config.rowTypeName) {
                this.logger?.info?.('Step 3: Updating table type');
                try {
                    await (0, update_1.updateTableType)(this.connection, {
                        tabletype_name: config.tableTypeName,
                        description: config.description,
                        row_type_name: config.rowTypeName, // TypeScript now knows this is defined
                        row_type_kind: config.rowTypeKind || 'dictionaryType',
                        access_type: config.accessType || 'standard',
                        primary_key_definition: config.primaryKeyDefinition || 'standard',
                        primary_key_kind: config.primaryKeyKind || 'nonUnique',
                        transport_request: config.transportRequest,
                    }, lockHandle, this.logger);
                    this.logger?.info?.('Table type updated');
                }
                catch (updateError) {
                    const updateErr = updateError;
                    // Log update error details before rethrowing
                    this.logger?.error?.('Update failed with error:', (0, internalUtils_1.safeErrorMessage)(updateError));
                    if (updateErr.message) {
                        this.logger?.error?.('Error message:', updateErr.message);
                    }
                    throw updateError;
                }
                // 3.5. Read with long polling to ensure object is ready after update
                this.logger?.info?.('read (wait for object ready after update)');
                try {
                    await this.read({ tableTypeName: config.tableTypeName }, 'active', {
                        withLongPolling: true,
                    });
                    this.logger?.info?.('object is ready after update');
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed after update:', (0, internalUtils_1.safeErrorMessage)(readError));
                    // Continue anyway - unlock might still work
                }
            }
            // 4. Unlock (obligatory stateless after unlock)
            if (lockHandle) {
                this.logger?.info?.('Step 4: Unlocking table type');
                this.connection.setSessionType('stateful');
                await (0, unlock_1.unlockTableType)(this.connection, config.tableTypeName, lockHandle);
                this.connection.setSessionType('stateless');
                this.lockTracker.untrack(config.tableTypeName);
                lockHandle = undefined;
                this.logger?.info?.('Table type unlocked');
            }
            // 5. Final check (no stateful needed)
            this.logger?.info?.('Step 5: Final check');
            await (0, check_1.runTableTypeCheckRun)(this.connection, 'abapCheckRun', config.tableTypeName, undefined, 'inactive');
            this.logger?.info?.('Final check passed');
            // 6. Activate (if requested, no stateful needed - uses same session/cookies)
            if (options?.activateOnUpdate) {
                this.logger?.info?.('Step 6: Activating table type');
                const activateResponse = await (0, activation_1.activateTableType)(this.connection, config.tableTypeName);
                this.logger?.info?.('Table type activated, status:', activateResponse.status);
                // 6.5. Read with long polling to ensure object is ready after activation
                this.logger?.info?.('read (wait for object ready after activation)');
                try {
                    const readState = await this.read({ tableTypeName: config.tableTypeName }, 'active', { withLongPolling: true });
                    if (readState) {
                        return {
                            activateResult: activateResponse,
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
                    activateResult: activateResponse,
                    errors: [],
                };
            }
            // Read and return result (no stateful needed)
            // TableType is XML-based, read metadata
            try {
                const readResponse = await (0, read_1.getTableTypeMetadata)(this.connection, config.tableTypeName);
                return {
                    readResult: readResponse,
                    errors: [],
                };
            }
            catch (error) {
                const e = error;
                // If metadata read fails with 404, return empty result
                if (e.response?.status === 404) {
                    return {
                        readResult: undefined,
                        errors: [],
                    };
                }
                throw error;
            }
        }
        catch (error) {
            // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking table type during error cleanup');
                    this.connection.setSessionType('stateful');
                    await (0, unlock_1.unlockTableType)(this.connection, config.tableTypeName, lockHandle);
                    this.connection.setSessionType('stateless');
                    this.lockTracker.untrack(config.tableTypeName);
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
                    this.logger?.warn?.('Deleting table type after failure');
                    // No stateful needed - delete doesn't use lock/unlock
                    await (0, delete_1.deleteTableType)(this.connection, {
                        tabletype_name: config.tableTypeName,
                        transport_request: config.transportRequest,
                    });
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete table type after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
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
     * Delete table type
     */
    async delete(config) {
        if (!config.tableTypeName) {
            throw new Error('Table type name is required');
        }
        try {
            // Check for deletion (no stateful needed)
            this.logger?.info?.('Checking table type for deletion');
            const deletionCheck = await (0, delete_1.checkDeletion)(this.connection, {
                tabletype_name: config.tableTypeName,
                transport_request: config.transportRequest,
            });
            // ADT already said whether this may be deleted; refusing to read that
            // answer is how a delete came to report success while the object
            // stayed. Throws on isDeletable=false or a message of type E; a W
            // is a warning and passes.
            (0, deletionCheck_1.assertDeletable)(deletionCheck.data);
            this.logger?.info?.('Deletion check passed');
            // Delete (no stateful needed - no lock/unlock)
            this.logger?.info?.('Deleting table type');
            const result = await (0, delete_1.deleteTableType)(this.connection, {
                tabletype_name: config.tableTypeName,
                transport_request: config.transportRequest,
            });
            this.logger?.info?.('Table type deleted');
            return { deleteResult: result, errors: [] };
        }
        catch (error) {
            this.logger?.error('Delete failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Activate table type
     * No stateful needed - uses same session/cookies
     */
    async activate(config) {
        if (!config.tableTypeName) {
            throw new Error('Table type name is required');
        }
        try {
            const result = await (0, activation_1.activateTableType)(this.connection, config.tableTypeName);
            return { activateResult: result, errors: [] };
        }
        catch (error) {
            this.logger?.error('Activate failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Check table type
     */
    async check(config, status) {
        if (!config.tableTypeName) {
            throw new Error('Table type name is required');
        }
        // Map status to version
        const version = status === 'active' ? 'active' : 'inactive';
        return {
            checkResult: await (0, check_1.runTableTypeCheckRun)(this.connection, 'abapCheckRun', config.tableTypeName, undefined, version),
            errors: [],
        };
    }
    /**
     * Lock table type for modification
     */
    async lock(config) {
        if (!config.tableTypeName) {
            throw new Error('Table type name is required');
        }
        this.connection.setSessionType('stateful');
        const lockHandle = await (0, lock_1.acquireTableTypeLockHandle)(this.connection, config.tableTypeName);
        this.lockTracker.track(config.tableTypeName, lockHandle);
        return lockHandle;
    }
    /**
     * Unlock table type
     */
    async unlock(config, lockHandle) {
        if (!config.tableTypeName) {
            throw new Error('Table type name is required');
        }
        this.connection.setSessionType('stateful');
        const result = await (0, unlock_1.unlockTableType)(this.connection, config.tableTypeName, lockHandle);
        this.connection.setSessionType('stateless');
        this.lockTracker.untrack(config.tableTypeName);
        return {
            unlockResult: result,
            errors: [],
        };
    }
    getVersions(config) {
        return (0, versions_1.getTableTypeVersions)(this.connection, config);
    }
    getVersionSource(contentUri) {
        return (0, versions_1.getTableTypeVersionSource)(this.connection, contentUri);
    }
}
exports.AdtDdicTableType = AdtDdicTableType;
