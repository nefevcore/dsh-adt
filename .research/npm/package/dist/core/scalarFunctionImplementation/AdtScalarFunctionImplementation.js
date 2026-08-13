"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtScalarFunctionImplementation = void 0;
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
const updateMetadata_1 = require("./updateMetadata");
const validation_1 = require("./validation");
const VALIDATION_UNSUPPORTED_STATUSES = new Set([404, 405, 501]);
const versions_1 = require("./versions");
class AdtScalarFunctionImplementation {
    connection;
    logger;
    systemContext;
    lockTracker;
    objectType = 'ScalarFunctionImplementation';
    constructor(connection, logger, systemContext, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
        this.lockTracker = (0, LockRegistry_1.createLockTracker)(lockRegistry, this.objectType, (name, lockHandle) => (0, unlock_1.unlockScalarFunctionImplementation)(this.connection, name, lockHandle));
    }
    async validate(config) {
        const state = { errors: [] };
        if (!config.implementationName) {
            const error = new Error('Implementation name is required for validation');
            state.errors.push({ method: 'validate', error, timestamp: new Date() });
            throw error;
        }
        try {
            state.validationResponse = await (0, validation_1.validateScalarFunctionImplementationName)(this.connection, config.implementationName, config.description);
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
        if (!config.implementationName)
            throw new Error('Implementation name is required');
        if (!config.scalarFunctionName)
            throw new Error('Scalar function name is required');
        if (!config.packageName)
            throw new Error('Package name is required');
        if (!config.description)
            throw new Error('Description is required');
        try {
            state.createResult = await (0, create_1.create)(this.connection, {
                implementation_name: config.implementationName,
                scalar_function_name: config.scalarFunctionName,
                engine_value: config.engineValue,
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
        if (!config.implementationName)
            throw new Error('Implementation name is required');
        try {
            const response = await (0, read_1.getScalarFunctionImplementationSource)(this.connection, config.implementationName, version, options, this.logger);
            return { readResult: response, errors: [] };
        }
        catch (error) {
            if (error.response?.status === 404)
                return undefined;
            throw error;
        }
    }
    async readMetadata(config, options) {
        if (!config.implementationName)
            throw new Error('Implementation name is required');
        const response = await (0, read_1.getScalarFunctionImplementation)(this.connection, config.implementationName, 'inactive', options, this.logger);
        return { metadataResult: response, errors: [] };
    }
    async readTransport(config, options) {
        if (!config.implementationName)
            throw new Error('Implementation name is required');
        const response = await (0, read_1.getScalarFunctionImplementationTransport)(this.connection, config.implementationName, options?.withLongPolling !== undefined
            ? { withLongPolling: options.withLongPolling }
            : undefined);
        return { transportResult: response, errors: [] };
    }
    /**
     * Update the implementation source (JSON) via PUT /source/main.
     * No check/long-poll/auto-activate — those don't apply to DSFI.
     * Trio activation (DSFD+AMDP+DSFI) is the consumer's responsibility.
     */
    async update(config, options) {
        if (!config.implementationName)
            throw new Error('Implementation name is required');
        const sourceCode = options?.sourceCode ?? config.sourceCode;
        if (!sourceCode)
            throw new Error('Source code is required for update');
        if (options?.lockHandle) {
            const updateResult = await (0, update_1.updateScalarFunctionImplementation)(this.connection, {
                implementation_name: config.implementationName,
                source_code: sourceCode,
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
            lockHandle = await (0, lock_1.lockScalarFunctionImplementation)(this.connection, config.implementationName);
            this.lockTracker.track(config.implementationName, lockHandle);
            const updateResult = await (0, update_1.updateScalarFunctionImplementation)(this.connection, {
                implementation_name: config.implementationName,
                source_code: sourceCode,
                transport_request: config.transportRequest,
            }, lockHandle);
            await (0, unlock_1.unlockScalarFunctionImplementation)(this.connection, config.implementationName, lockHandle);
            this.lockTracker.untrack(config.implementationName);
            lockHandle = undefined;
            return { updateResult, errors: [] };
        }
        catch (error) {
            if (lockHandle) {
                try {
                    await (0, unlock_1.unlockScalarFunctionImplementation)(this.connection, config.implementationName, lockHandle);
                    this.lockTracker.untrack(config.implementationName);
                }
                catch (unlockError) {
                    this.logger?.warn?.('Failed to unlock during cleanup:', (0, internalUtils_1.safeErrorMessage)(unlockError));
                }
            }
            this.logger?.error('Update failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
        finally {
            this.connection.setSessionType('stateless');
            endCriticalSection();
        }
    }
    /**
     * Update the metadata (blues v2 XML) via PUT /dsfi/{name}.
     * Same lock/unlock/finally-stateless hardening as update().
     */
    async updateMetadata(config, options) {
        if (!config.implementationName)
            throw new Error('Implementation name is required');
        const sourceCode = options?.sourceCode ?? config.sourceCode;
        if (!sourceCode)
            throw new Error('Source code is required for updateMetadata');
        if (options?.lockHandle) {
            const updateResult = await (0, updateMetadata_1.updateScalarFunctionImplementationMetadata)(this.connection, {
                implementation_name: config.implementationName,
                source_code: sourceCode,
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
            lockHandle = await (0, lock_1.lockScalarFunctionImplementation)(this.connection, config.implementationName);
            this.lockTracker.track(config.implementationName, lockHandle);
            const updateResult = await (0, updateMetadata_1.updateScalarFunctionImplementationMetadata)(this.connection, {
                implementation_name: config.implementationName,
                source_code: sourceCode,
                transport_request: config.transportRequest,
            }, lockHandle);
            await (0, unlock_1.unlockScalarFunctionImplementation)(this.connection, config.implementationName, lockHandle);
            this.lockTracker.untrack(config.implementationName);
            lockHandle = undefined;
            return { updateResult, errors: [] };
        }
        catch (error) {
            if (lockHandle) {
                try {
                    await (0, unlock_1.unlockScalarFunctionImplementation)(this.connection, config.implementationName, lockHandle);
                    this.lockTracker.untrack(config.implementationName);
                }
                catch (unlockError) {
                    this.logger?.warn?.('Failed to unlock during cleanup:', (0, internalUtils_1.safeErrorMessage)(unlockError));
                }
            }
            this.logger?.error('UpdateMetadata failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
        finally {
            this.connection.setSessionType('stateless');
            endCriticalSection();
        }
    }
    async delete(config) {
        if (!config.implementationName)
            throw new Error('Implementation name is required');
        try {
            const deletionCheck = await (0, delete_1.checkDeletion)(this.connection, {
                implementation_name: config.implementationName,
                transport_request: config.transportRequest,
            });
            // ADT already said whether this may be deleted; refusing to read that
            // answer is how a delete came to report success while the object
            // stayed. Throws on isDeletable=false or a message of type E; a W
            // is a warning and passes.
            (0, deletionCheck_1.assertDeletable)(deletionCheck.data);
            const deleteResult = await (0, delete_1.deleteScalarFunctionImplementation)(this.connection, {
                implementation_name: config.implementationName,
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
        if (!config.implementationName)
            throw new Error('Implementation name is required');
        const result = await (0, activation_1.activateScalarFunctionImplementation)(this.connection, config.implementationName);
        return { activateResult: result, errors: [] };
    }
    async check(config, status) {
        if (!config.implementationName)
            throw new Error('Implementation name is required');
        const version = status === 'active' ? 'active' : 'inactive';
        const checkResult = await (0, check_1.checkScalarFunctionImplementation)(this.connection, config.implementationName, version);
        return { checkResult, errors: [] };
    }
    async lock(config) {
        if (!config.implementationName)
            throw new Error('Implementation name is required');
        this.connection.setSessionType('stateful');
        const lockHandle = await (0, lock_1.lockScalarFunctionImplementation)(this.connection, config.implementationName);
        this.lockTracker.track(config.implementationName, lockHandle);
        return lockHandle;
    }
    async unlock(config, lockHandle) {
        if (!config.implementationName)
            throw new Error('Implementation name is required');
        this.connection.setSessionType('stateful');
        try {
            const unlockResult = await (0, unlock_1.unlockScalarFunctionImplementation)(this.connection, config.implementationName, lockHandle);
            this.lockTracker.untrack(config.implementationName);
            return { unlockResult, errors: [] };
        }
        finally {
            this.connection.setSessionType('stateless');
        }
    }
    getVersions(config) {
        return (0, versions_1.getScalarFunctionImplementationVersions)(this.connection, config);
    }
    getVersionSource(contentUri) {
        return (0, versions_1.getScalarFunctionImplementationVersionSource)(this.connection, contentUri);
    }
}
exports.AdtScalarFunctionImplementation = AdtScalarFunctionImplementation;
