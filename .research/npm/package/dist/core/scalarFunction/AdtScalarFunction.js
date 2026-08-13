"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtScalarFunction = void 0;
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
const VALIDATION_UNSUPPORTED_STATUSES = new Set([404, 405, 501]);
const versions_1 = require("./versions");
class AdtScalarFunction {
    connection;
    logger;
    systemContext;
    lockTracker;
    objectType = 'ScalarFunction';
    constructor(connection, logger, systemContext, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
        this.lockTracker = (0, LockRegistry_1.createLockTracker)(lockRegistry, this.objectType, (name, lockHandle) => (0, unlock_1.unlockScalarFunction)(this.connection, name, lockHandle));
    }
    async validate(config) {
        const state = { errors: [] };
        if (!config.scalarFunctionName) {
            const error = new Error('Scalar function name is required for validation');
            state.errors.push({ method: 'validate', error, timestamp: new Date() });
            throw error;
        }
        try {
            state.validationResponse = await (0, validation_1.validateScalarFunctionName)(this.connection, config.scalarFunctionName, config.description);
            state.validationSupported = true;
            return state;
        }
        catch (error) {
            const status = error?.response?.status;
            if (status && VALIDATION_UNSUPPORTED_STATUSES.has(status)) {
                state.validationSupported = false;
                return state;
            }
            const err = error instanceof Error ? error : new Error(String(error));
            this.logger?.error('validate', (0, internalUtils_1.safeErrorMessage)(err));
            throw err;
        }
    }
    async create(config, _options) {
        const state = { errors: [] };
        if (!config.scalarFunctionName)
            throw new Error('Scalar function name is required');
        if (!config.packageName)
            throw new Error('Package name is required');
        if (!config.description)
            throw new Error('Description is required');
        try {
            state.createResult = await (0, create_1.create)(this.connection, {
                scalar_function_name: config.scalarFunctionName,
                package_name: config.packageName,
                transport_request: config.transportRequest,
                description: config.description,
                masterSystem: this.systemContext.masterSystem,
                responsible: this.systemContext.responsible,
                masterLanguage: config.masterLanguage ?? this.systemContext.masterLanguage,
            });
            return state;
        }
        catch (error) {
            this.logger?.error('Create failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    async read(config, version, options) {
        if (!config.scalarFunctionName)
            throw new Error('Scalar function name is required');
        try {
            const response = await (0, read_1.getScalarFunctionSource)(this.connection, config.scalarFunctionName, version, options, this.logger);
            return { readResult: response, errors: [] };
        }
        catch (error) {
            if (error.response?.status === 404)
                return undefined;
            throw error;
        }
    }
    async readMetadata(config, options) {
        if (!config.scalarFunctionName)
            throw new Error('Scalar function name is required');
        const response = await (0, read_1.getScalarFunction)(this.connection, config.scalarFunctionName, 'inactive', options, this.logger);
        return { metadataResult: response, errors: [] };
    }
    async readTransport(config, options) {
        if (!config.scalarFunctionName)
            throw new Error('Scalar function name is required');
        const response = await (0, read_1.getScalarFunctionTransport)(this.connection, config.scalarFunctionName, options?.withLongPolling !== undefined
            ? { withLongPolling: options.withLongPolling }
            : undefined);
        return { transportResult: response, errors: [] };
    }
    async update(config, options) {
        if (!config.scalarFunctionName)
            throw new Error('Scalar function name is required');
        if (options?.lockHandle) {
            const codeToUpdate = options?.sourceCode || config.sourceCode;
            if (!codeToUpdate)
                throw new Error('Source code is required for update');
            const updateResult = await (0, update_1.updateScalarFunction)(this.connection, {
                scalar_function_name: config.scalarFunctionName,
                source_code: codeToUpdate,
                transport_request: config.transportRequest,
            }, options.lockHandle);
            return { updateResult, errors: [] };
        }
        let lockHandle;
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockScalarFunction)(this.connection, config.scalarFunctionName);
            this.lockTracker.track(config.scalarFunctionName, lockHandle);
            const codeToCheck = options?.sourceCode || config.sourceCode;
            if (codeToCheck) {
                await (0, check_1.checkScalarFunction)(this.connection, config.scalarFunctionName, 'inactive', codeToCheck);
                await (0, update_1.updateScalarFunction)(this.connection, {
                    scalar_function_name: config.scalarFunctionName,
                    source_code: codeToCheck,
                    transport_request: config.transportRequest,
                }, lockHandle);
                try {
                    await this.read({ scalarFunctionName: config.scalarFunctionName }, 'active', { withLongPolling: true });
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed (object may not be ready yet):', (0, internalUtils_1.safeErrorMessage)(readError));
                }
            }
            if (lockHandle) {
                this.connection.setSessionType('stateful');
                try {
                    await (0, unlock_1.unlockScalarFunction)(this.connection, config.scalarFunctionName, lockHandle);
                }
                finally {
                    this.connection.setSessionType('stateless');
                }
                this.lockTracker.untrack(config.scalarFunctionName);
                lockHandle = undefined;
            }
            await (0, check_1.checkScalarFunction)(this.connection, config.scalarFunctionName, 'inactive');
            if (options?.activateOnUpdate) {
                const activateResult = await (0, activation_1.activateScalarFunction)(this.connection, config.scalarFunctionName);
                try {
                    await this.read({ scalarFunctionName: config.scalarFunctionName }, 'active', { withLongPolling: true });
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed (object may not be ready yet):', (0, internalUtils_1.safeErrorMessage)(readError));
                }
                return { activateResult, errors: [] };
            }
            const readResult = await (0, read_1.getScalarFunctionSource)(this.connection, config.scalarFunctionName);
            return { readResult, errors: [] };
        }
        catch (error) {
            if (lockHandle) {
                try {
                    this.connection.setSessionType('stateful');
                    await (0, unlock_1.unlockScalarFunction)(this.connection, config.scalarFunctionName, lockHandle);
                    this.lockTracker.untrack(config.scalarFunctionName);
                }
                catch (unlockError) {
                    this.logger?.warn?.('Failed to unlock during cleanup:', (0, internalUtils_1.safeErrorMessage)(unlockError));
                }
                finally {
                    this.connection.setSessionType('stateless');
                }
            }
            else {
                this.connection.setSessionType('stateless');
            }
            if (options?.deleteOnFailure) {
                try {
                    await (0, delete_1.deleteScalarFunction)(this.connection, {
                        scalar_function_name: config.scalarFunctionName,
                        transport_request: config.transportRequest,
                    });
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
                }
            }
            this.logger?.error('Update failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
        finally {
            endCriticalSection();
        }
    }
    async delete(config) {
        if (!config.scalarFunctionName)
            throw new Error('Scalar function name is required');
        try {
            const deletionCheck = await (0, delete_1.checkDeletion)(this.connection, {
                scalar_function_name: config.scalarFunctionName,
                transport_request: config.transportRequest,
            });
            // ADT already said whether this may be deleted; refusing to read that
            // answer is how a delete came to report success while the object
            // stayed. Throws on isDeletable=false or a message of type E; a W
            // is a warning and passes.
            (0, deletionCheck_1.assertDeletable)(deletionCheck.data);
            const deleteResult = await (0, delete_1.deleteScalarFunction)(this.connection, {
                scalar_function_name: config.scalarFunctionName,
                transport_request: config.transportRequest,
            });
            return { deleteResult, errors: [] };
        }
        catch (error) {
            this.logger?.error('Delete failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    async activate(config) {
        if (!config.scalarFunctionName)
            throw new Error('Scalar function name is required');
        const result = await (0, activation_1.activateScalarFunction)(this.connection, config.scalarFunctionName);
        return { activateResult: result, errors: [] };
    }
    async check(config, status) {
        if (!config.scalarFunctionName)
            throw new Error('Scalar function name is required');
        const version = status === 'active' ? 'active' : 'inactive';
        const checkResult = await (0, check_1.checkScalarFunction)(this.connection, config.scalarFunctionName, version);
        return { checkResult, errors: [] };
    }
    async lock(config) {
        if (!config.scalarFunctionName)
            throw new Error('Scalar function name is required');
        this.connection.setSessionType('stateful');
        const lockHandle = await (0, lock_1.lockScalarFunction)(this.connection, config.scalarFunctionName);
        this.lockTracker.track(config.scalarFunctionName, lockHandle);
        return lockHandle;
    }
    async unlock(config, lockHandle) {
        if (!config.scalarFunctionName)
            throw new Error('Scalar function name is required');
        this.connection.setSessionType('stateful');
        try {
            const unlockResult = await (0, unlock_1.unlockScalarFunction)(this.connection, config.scalarFunctionName, lockHandle);
            this.lockTracker.untrack(config.scalarFunctionName);
            return { unlockResult, errors: [] };
        }
        finally {
            this.connection.setSessionType('stateless');
        }
    }
    getVersions(config) {
        return (0, versions_1.getScalarFunctionVersions)(this.connection, config);
    }
    getVersionSource(contentUri) {
        return (0, versions_1.getScalarFunctionVersionSource)(this.connection, contentUri);
    }
}
exports.AdtScalarFunction = AdtScalarFunction;
