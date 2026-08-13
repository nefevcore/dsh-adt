"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtProgram = void 0;
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
class AdtProgram {
    connection;
    logger;
    systemContext;
    contentTypes;
    lockTracker;
    objectType = 'Program';
    constructor(connection, logger, systemContext, contentTypes, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
        this.contentTypes = contentTypes;
        this.lockTracker = (0, LockRegistry_1.createLockTracker)(lockRegistry, this.objectType, (programName, lockHandle) => (0, unlock_1.unlockProgram)(this.connection, programName, lockHandle));
    }
    /**
     * Validate program configuration before creation
     */
    async validate(config) {
        if (!config.programName) {
            throw new Error('Program name is required for validation');
        }
        try {
            const validationResponse = await (0, validation_1.validateProgramName)(this.connection, config.programName, config.description, config.packageName);
            return {
                validationResponse: validationResponse,
                errors: [],
            };
        }
        catch (error) {
            const e = error;
            const status = e.response?.status;
            const statusText = e.response?.statusText;
            const errorMessage = e.response?.data
                ? typeof e.response.data === 'string'
                    ? e.response.data.substring(0, 500)
                    : (0, internalUtils_1.safeStringify)(e.response.data).substring(0, 500)
                : e.message || 'Unknown error';
            this.logger?.error?.(`Validation failed: HTTP ${status} ${statusText} - ${errorMessage}`);
            if (status && (status === 400 || (status >= 400 && status < 500))) {
                throw new Error(`Validation failed: ${errorMessage}`);
            }
            throw error;
        }
    }
    /**
     * Create program with full operation chain
     */
    async create(config, options) {
        if (!config.programName) {
            throw new Error('Program name is required');
        }
        if (!config.packageName) {
            throw new Error('Package name is required');
        }
        let objectCreated = false;
        const _sessionId = this.connection.getSessionId?.() || '';
        const state = {
            errors: [],
        };
        try {
            // Create program (requires stateful)
            this.logger?.info?.('Creating program');
            this.connection.setSessionType('stateful');
            const createResponse = await (0, create_1.create)(this.connection, {
                programName: config.programName,
                packageName: config.packageName,
                transportRequest: config.transportRequest,
                description: config.description,
                programType: config.programType,
                application: config.application,
                sourceCode: options?.sourceCode || config.sourceCode,
                masterSystem: this.systemContext.masterSystem,
                responsible: this.systemContext.responsible,
                masterLanguage: config.masterLanguage ?? this.systemContext.masterLanguage,
            }, this.contentTypes);
            state.createResult = createResponse;
            objectCreated = true;
            this.connection.setSessionType('stateless');
            this.logger?.info?.('Program created');
            return state;
        }
        catch (error) {
            // Cleanup on error - ensure stateless
            this.connection.setSessionType('stateless');
            if (objectCreated && options?.deleteOnFailure) {
                try {
                    this.logger?.warn?.('Deleting program after failure');
                    this.connection.setSessionType('stateful');
                    await (0, delete_1.deleteProgram)(this.connection, {
                        programName: config.programName,
                        transportRequest: config.transportRequest,
                    });
                    this.connection.setSessionType('stateless');
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete program after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
                }
            }
            this.logger?.error('Create failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read program
     */
    async read(config, version, options) {
        if (!config.programName) {
            throw new Error('Program name is required');
        }
        try {
            const response = await (0, read_1.getProgramSource)(this.connection, config.programName, version, options);
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
            throw error;
        }
    }
    /**
     * Read program metadata (object characteristics: package, responsible, description, etc.)
     */
    async readMetadata(config, options) {
        const state = { errors: [] };
        if (!config.programName) {
            const error = new Error('Program name is required');
            state.errors.push({
                method: 'readMetadata',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getProgramMetadata)(this.connection, config.programName, options);
            state.metadataResult = response;
            this.logger?.info?.('Program metadata read successfully');
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
     * Update program with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    async update(config, options) {
        if (!config.programName) {
            throw new Error('Program name is required');
        }
        // Low-level mode: if lockHandle is provided, perform only update operation
        if (options?.lockHandle) {
            const codeToUpdate = options?.sourceCode || config.sourceCode;
            if (!codeToUpdate) {
                throw new Error('Source code is required for update');
            }
            this.logger?.info?.('Low-level update: performing update only (lockHandle provided)');
            const sessionId = this.connection.getSessionId?.() || '';
            const updateResponse = await (0, update_1.uploadProgramSource)(this.connection, config.programName, codeToUpdate, options.lockHandle, sessionId, config.transportRequest);
            this.logger?.info?.('Program updated (low-level)');
            return {
                updateResult: updateResponse,
                errors: [],
            };
        }
        let lockHandle;
        const sessionId = this.connection.getSessionId?.() || '';
        const state = {
            errors: [],
        };
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            // 1. Lock (update always starts with lock, stateful only for lock)
            this.logger?.info?.('Step 1: Locking program');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockProgram)(this.connection, config.programName);
            state.lockHandle = lockHandle;
            this.lockTracker.track(config.programName, lockHandle);
            this.logger?.info?.('Program locked, handle:', lockHandle);
            // 2. Check inactive with code for update (from options or config)
            const codeToCheck = options?.sourceCode || config.sourceCode;
            if (codeToCheck) {
                this.logger?.info?.('Step 2: Checking inactive version with update content');
                const deletionCheck = await (0, check_1.checkProgram)(this.connection, config.programName, 'inactive', codeToCheck, this.contentTypes?.sourceArtifactContentType());
                state.checkResult = deletionCheck;
                this.logger?.info?.('Check inactive with update content passed');
            }
            // 3. Update
            if (codeToCheck && lockHandle) {
                this.logger?.info?.('Step 3: Updating program');
                const updateResponse = await (0, update_1.uploadProgramSource)(this.connection, config.programName, codeToCheck, lockHandle, sessionId, config.transportRequest);
                state.updateResult = updateResponse;
                this.logger?.info?.('Program updated');
                // Poll the inactive version: the write above produced it; the active version may not exist yet.
                // 3.5. Read with long polling to ensure object is ready after update
                this.logger?.info?.('read (wait for object ready after update)');
                try {
                    await this.read({ programName: config.programName }, 'inactive', {
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
                this.logger?.info?.('Step 4: Unlocking program');
                this.connection.setSessionType('stateful');
                const unlockResponse = await (0, unlock_1.unlockProgram)(this.connection, config.programName, lockHandle);
                state.unlockResult = unlockResponse;
                this.connection.setSessionType('stateless');
                this.lockTracker.untrack(config.programName);
                lockHandle = undefined;
                this.logger?.info?.('Program unlocked');
            }
            // 5. Final check (no stateful needed)
            this.logger?.info?.('Step 5: Final check');
            const checkResponse2 = await (0, check_1.checkProgram)(this.connection, config.programName, 'inactive');
            state.checkResult = checkResponse2;
            this.logger?.info?.('Final check passed');
            // 6. Activate (if requested, no stateful needed - uses same session/cookies)
            if (options?.activateOnUpdate) {
                this.logger?.info?.('Step 6: Activating program');
                const activateResponse = await (0, activation_1.activateProgram)(this.connection, config.programName);
                state.activateResult = activateResponse;
                this.logger?.info?.('Program activated, status:', activateResponse.status);
                // 6.5. Read with long polling to ensure object is ready after activation
                this.logger?.info?.('read (wait for object ready after activation)');
                try {
                    const readState = await this.read({ programName: config.programName }, 'active', { withLongPolling: true });
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
            return state;
        }
        catch (error) {
            // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking program during error cleanup');
                    this.connection.setSessionType('stateful');
                    await (0, unlock_1.unlockProgram)(this.connection, config.programName, lockHandle);
                    this.connection.setSessionType('stateless');
                    this.lockTracker.untrack(config.programName);
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
                    this.logger?.warn?.('Deleting program after failure');
                    this.connection.setSessionType('stateful');
                    await (0, delete_1.deleteProgram)(this.connection, {
                        programName: config.programName,
                        transportRequest: config.transportRequest,
                    });
                    this.connection.setSessionType('stateless');
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete program after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
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
     * Delete program
     */
    async delete(config) {
        if (!config.programName) {
            throw new Error('Program name is required');
        }
        const state = {
            errors: [],
        };
        try {
            // Check for deletion (no stateful needed)
            this.logger?.info?.('Checking program for deletion');
            const deletionCheck = await (0, delete_1.checkDeletion)(this.connection, {
                programName: config.programName,
                transportRequest: config.transportRequest,
            });
            // ADT already said whether this may be deleted; refusing to read that
            // answer is how a delete came to report success while the object
            // stayed. Throws on isDeletable=false or a message of type E; a W
            // is a warning and passes.
            (0, deletionCheck_1.assertDeletable)(deletionCheck.data);
            state.checkResult = deletionCheck;
            this.logger?.info?.('Deletion check passed');
            // Delete (requires stateful, but no lock)
            this.logger?.info?.('Deleting program');
            this.connection.setSessionType('stateful');
            const deleteResponse = await (0, delete_1.deleteProgram)(this.connection, {
                programName: config.programName,
                transportRequest: config.transportRequest,
            });
            state.deleteResult = deleteResponse;
            this.logger?.info?.('Program deleted');
            return state;
        }
        catch (error) {
            this.logger?.error('Delete failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
        finally {
            this.connection.setSessionType('stateless');
        }
    }
    /**
     * Activate program
     * No stateful needed - uses same session/cookies
     */
    async activate(config) {
        if (!config.programName) {
            throw new Error('Program name is required');
        }
        const state = {
            errors: [],
        };
        try {
            const activateResponse = await (0, activation_1.activateProgram)(this.connection, config.programName);
            state.activateResult = activateResponse;
            return state;
        }
        catch (error) {
            const e = error;
            const status = e.response?.status;
            const statusText = e.response?.statusText;
            const errorMessage = e.response?.data
                ? typeof e.response.data === 'string'
                    ? e.response.data.substring(0, 500)
                    : (0, internalUtils_1.safeStringify)(e.response.data).substring(0, 500)
                : e.message || 'Unknown error';
            this.logger?.error?.(`Activate failed: HTTP ${status} ${statusText} - ${errorMessage}`);
            this.logger?.error('Activate failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Check program
     */
    async check(config, status) {
        if (!config.programName) {
            throw new Error('Program name is required');
        }
        const state = {
            errors: [],
        };
        try {
            // Map status to version
            const version = status === 'active' ? 'active' : 'inactive';
            const deletionCheck = await (0, check_1.checkProgram)(this.connection, config.programName, version, config.sourceCode, this.contentTypes?.sourceArtifactContentType());
            state.checkResult = deletionCheck;
            return state;
        }
        catch (error) {
            this.logger?.error('Check failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read transport request information for the program
     */
    async readTransport(config, options) {
        const state = {
            errors: [],
        };
        if (!config.programName) {
            const error = new Error('Program name is required');
            state.errors.push({
                method: 'readTransport',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getProgramTransport)(this.connection, config.programName, options?.withLongPolling !== undefined
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
     * Lock program for modification
     */
    async lock(config) {
        if (!config.programName) {
            throw new Error('Program name is required');
        }
        this.connection.setSessionType('stateful');
        const lockHandle = await (0, lock_1.lockProgram)(this.connection, config.programName);
        this.lockTracker.track(config.programName, lockHandle);
        return lockHandle;
    }
    /**
     * Unlock program
     */
    async unlock(config, lockHandle) {
        if (!config.programName) {
            throw new Error('Program name is required');
        }
        this.connection.setSessionType('stateful');
        const result = await (0, unlock_1.unlockProgram)(this.connection, config.programName, lockHandle);
        this.connection.setSessionType('stateless');
        this.lockTracker.untrack(config.programName);
        return {
            unlockResult: result,
            errors: [],
        };
    }
    getVersions(config) {
        return (0, versions_1.getProgramVersions)(this.connection, config);
    }
    getVersionSource(contentUri) {
        return (0, versions_1.getProgramVersionSource)(this.connection, contentUri);
    }
}
exports.AdtProgram = AdtProgram;
