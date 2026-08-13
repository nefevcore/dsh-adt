"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtFunctionInclude = void 0;
const criticalSection_1 = require("../../utils/criticalSection");
const deletionCheck_1 = require("../../utils/deletionCheck");
const internalUtils_1 = require("../../utils/internalUtils");
const activation_1 = require("./activation");
const check_1 = require("./check");
const create_1 = require("./create");
const delete_1 = require("./delete");
const lock_1 = require("./lock");
const read_1 = require("./read");
const readSource_1 = require("./readSource");
const unlock_1 = require("./unlock");
const update_1 = require("./update");
const updateSource_1 = require("./updateSource");
const validation_1 = require("./validation");
const versions_1 = require("./versions");
class AdtFunctionInclude {
    connection;
    logger;
    systemContext;
    contentTypes;
    lockRegistry;
    objectType = 'FunctionInclude';
    constructor(connection, logger, systemContext, contentTypes, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
        this.contentTypes = contentTypes;
        this.lockRegistry = lockRegistry;
    }
    /** Registry key for a held lock (nested: group + include). */
    lockKey(group, includeName) {
        return `${this.objectType}/${group.toUpperCase()}/${includeName.toUpperCase()}`;
    }
    /** Record a held lock; the unlock thunk needs the parent function group. */
    trackLock(group, includeName, lockHandle) {
        if (!group || !includeName)
            return;
        // Raw unlock — LockRegistry.unlockAll() manages the session for the batch.
        this.lockRegistry?.track(this.lockKey(group, includeName), () => (0, unlock_1.unlockFunctionInclude)(this.connection, group, includeName, lockHandle));
    }
    /** Drop a lock from the registry after a clean unlock. */
    untrackLock(group, includeName) {
        if (!group || !includeName)
            return;
        this.lockRegistry?.untrack(this.lockKey(group, includeName));
    }
    /**
     * Map camelCase config to the snake_case low-level params.
     */
    buildCreateParams(config) {
        return {
            function_group_name: config.functionGroupName,
            include_name: config.includeName,
            description: config.description,
            transport_request: config.transportRequest,
            master_system: config.masterSystem ?? this.systemContext.masterSystem,
            responsible: config.responsible ?? this.systemContext.responsible,
        };
    }
    buildDeleteParams(config) {
        return {
            function_group_name: config.functionGroupName ?? '',
            include_name: config.includeName ?? '',
            transport_request: config.transportRequest,
        };
    }
    /**
     * Resolve source artifact content type — used both for the source-aware
     * checkrun payload and for the unicode flag of the source upload.
     */
    sourceArtifactContentType() {
        return this.contentTypes?.sourceArtifactContentType() ?? 'text/plain';
    }
    isUnicode() {
        return this.sourceArtifactContentType().includes('utf-8');
    }
    /**
     * Validate by probing parent function group's existence.
     */
    async validate(config) {
        if (!config.functionGroupName) {
            throw new Error('Function group name is required for function include validation');
        }
        if (!config.includeName) {
            throw new Error('Include name is required for function include validation');
        }
        const validationResponse = await (0, validation_1.validateFunctionIncludeName)(this.connection, config.functionGroupName, config.includeName);
        return {
            validationResponse,
            errors: [],
        };
    }
    /**
     * Create function include (optionally uploading source and activating).
     */
    async create(config, options) {
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        if (!config.includeName) {
            throw new Error('Include name is required');
        }
        if (!config.description) {
            throw new Error('Description is required');
        }
        let objectCreated = false;
        let lockHandle;
        const state = { errors: [] };
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            // 0. Validate parent group existence
            this.logger?.info?.('Validating parent function group');
            await (0, validation_1.validateFunctionIncludeName)(this.connection, config.functionGroupName, config.includeName);
            // 1. Create include metadata
            this.logger?.info?.('Creating function include');
            const createResponse = await (0, create_1.create)(this.connection, this.buildCreateParams(config));
            state.createResult = createResponse;
            objectCreated = true;
            this.logger?.info?.('Function include created');
            // 2. Upload source (if provided)
            const sourceCode = options?.sourceCode || config.sourceCode;
            if (sourceCode) {
                this.logger?.info?.('Step 2: Locking function include for source upload');
                this.connection.setSessionType('stateful');
                lockHandle = await (0, lock_1.lockFunctionInclude)(this.connection, config.functionGroupName, config.includeName, this.logger);
                this.trackLock(config.functionGroupName, config.includeName, lockHandle);
                state.lockHandle = lockHandle;
                config.onLock?.(lockHandle);
                this.logger?.info?.('Step 3: Uploading function include source');
                await (0, updateSource_1.uploadFunctionIncludeSource)(this.connection, config.functionGroupName, config.includeName, sourceCode, lockHandle, this.isUnicode(), config.transportRequest);
                this.logger?.info?.('Step 4: Unlocking function include');
                this.connection.setSessionType('stateful');
                await (0, unlock_1.unlockFunctionInclude)(this.connection, config.functionGroupName, config.includeName, lockHandle);
                this.connection.setSessionType('stateless');
                this.untrackLock(config.functionGroupName, config.includeName);
                lockHandle = undefined;
                this.logger?.info?.('Step 5: Activating function include');
                const activateResponse = await (0, activation_1.activateFunctionInclude)(this.connection, config.functionGroupName, config.includeName);
                state.activateResult = activateResponse;
            }
            return state;
        }
        catch (error) {
            // Error cleanup: unlock if still locked, then ensure stateless
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking function include during error cleanup');
                    this.connection.setSessionType('stateful');
                    await (0, unlock_1.unlockFunctionInclude)(this.connection, config.functionGroupName, config.includeName, lockHandle);
                    this.connection.setSessionType('stateless');
                    this.untrackLock(config.functionGroupName, config.includeName);
                }
                catch (unlockError) {
                    this.logger?.warn?.('Failed to unlock during cleanup:', (0, internalUtils_1.safeErrorMessage)(unlockError));
                }
            }
            else {
                this.connection.setSessionType('stateless');
            }
            if (objectCreated && options?.deleteOnFailure) {
                try {
                    this.logger?.warn?.('Deleting function include after failure');
                    await (0, delete_1.deleteFunctionInclude)(this.connection, this.buildDeleteParams(config));
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete function include after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
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
     * Read function include SOURCE code.
     *
     * Per the IAdtObject contract, `read()` returns source for objects that have
     * it (metadata is available via `readMetadata()`). This object has source, so
     * `read()` is an alias of `readSource()`. (Historically it returned metadata,
     * which was inconsistent with class/program/function-module `read()`.)
     */
    async read(config, version, _options) {
        return this.readSource(config, version);
    }
    /**
     * Low-level metadata read (the object's `finclude` XML), with 404 -> undefined.
     * Used by readMetadata() and by the create/update readiness polling, which
     * need metadata semantics and long-polling options (the source endpoint does
     * not take them).
     */
    async readMetadataRaw(config, version, options) {
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        if (!config.includeName) {
            throw new Error('Include name is required');
        }
        try {
            const response = await (0, read_1.readFunctionInclude)(this.connection, config.functionGroupName, config.includeName, version ?? 'active', options);
            return { readResult: response, errors: [] };
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
     * Read function include source code.
     */
    async readSource(config, version) {
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        if (!config.includeName) {
            throw new Error('Include name is required');
        }
        try {
            const response = await (0, readSource_1.readFunctionIncludeSource)(this.connection, config.functionGroupName, config.includeName, version ?? 'active');
            return { readResult: response, errors: [] };
        }
        catch (error) {
            const e = error;
            if (e.response?.status === 404) {
                return undefined;
            }
            this.logger?.error('readSource failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read metadata — for this object, read() already returns metadata.
     */
    async readMetadata(config, options) {
        const state = { errors: [] };
        if (!config.functionGroupName) {
            const error = new Error('Function group name is required');
            state.errors.push({
                method: 'readMetadata',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        if (!config.includeName) {
            const error = new Error('Include name is required');
            state.errors.push({
                method: 'readMetadata',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const readState = await this.readMetadataRaw(config, options?.version ?? 'active', options);
            if (readState) {
                state.metadataResult = readState.readResult;
                state.readResult = readState.readResult;
            }
            else {
                const error = new Error(`Function include '${config.includeName}' not found in group '${config.functionGroupName}'`);
                state.errors.push({
                    method: 'readMetadata',
                    error,
                    timestamp: new Date(),
                });
                throw error;
            }
            this.logger?.info?.('Function include metadata read successfully');
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
     * Update function include with full operation chain.
     */
    async update(config, options) {
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        if (!config.includeName) {
            throw new Error('Include name is required');
        }
        const fullConfig = {
            ...config,
        };
        const params = this.buildCreateParams(fullConfig);
        // Low-level mode: if lockHandle is provided, perform only update operation
        if (options?.lockHandle) {
            const codeToUpdate = options?.sourceCode || config.sourceCode;
            this.logger?.info?.('Low-level update: performing update only (lockHandle provided)');
            await (0, update_1.updateFunctionInclude)(this.connection, params, options.lockHandle, this.logger);
            if (codeToUpdate) {
                await (0, updateSource_1.uploadFunctionIncludeSource)(this.connection, fullConfig.functionGroupName, fullConfig.includeName, codeToUpdate, options.lockHandle, this.isUnicode(), fullConfig.transportRequest);
            }
            this.logger?.info?.('Function include updated (low-level)');
            return { errors: [] };
        }
        let lockHandle;
        const state = { errors: [] };
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            // 1. Lock
            this.logger?.info?.('Step 1: Locking function include');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockFunctionInclude)(this.connection, fullConfig.functionGroupName, fullConfig.includeName, this.logger);
            state.lockHandle = lockHandle;
            this.trackLock(fullConfig.functionGroupName, fullConfig.includeName, lockHandle);
            fullConfig.onLock?.(lockHandle);
            this.logger?.info?.('Function include locked, handle:', lockHandle);
            // 2. Check inactive with source code for update (if provided)
            const codeToCheck = options?.sourceCode || fullConfig.sourceCode;
            if (codeToCheck) {
                this.logger?.info?.('Step 2: Checking inactive version with update content');
                const deletionCheck = await (0, check_1.checkFunctionInclude)(this.connection, fullConfig.functionGroupName, fullConfig.includeName, 'inactive', codeToCheck, this.sourceArtifactContentType());
                state.checkResult = deletionCheck;
                this.logger?.info?.('Check inactive with update content passed');
            }
            // 3. Update metadata
            this.logger?.info?.('Step 3: Updating function include metadata');
            await (0, update_1.updateFunctionInclude)(this.connection, params, lockHandle, this.logger);
            // 3.5. Upload source if provided
            if (codeToCheck) {
                this.logger?.info?.('Step 3b: Uploading function include source');
                await (0, updateSource_1.uploadFunctionIncludeSource)(this.connection, fullConfig.functionGroupName, fullConfig.includeName, codeToCheck, lockHandle, this.isUnicode(), fullConfig.transportRequest);
                // Poll the inactive version: the write above produced it; the active version may not exist yet.
                // Wait for object to be ready after update
                this.logger?.info?.('read (wait for object ready after update)');
                try {
                    await this.readMetadataRaw({
                        functionGroupName: fullConfig.functionGroupName,
                        includeName: fullConfig.includeName,
                    }, 'inactive', { withLongPolling: true });
                    this.logger?.info?.('object is ready after update');
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed after update:', (0, internalUtils_1.safeErrorMessage)(readError));
                }
            }
            // 4. Unlock
            this.logger?.info?.('Step 4: Unlocking function include');
            this.connection.setSessionType('stateful');
            await (0, unlock_1.unlockFunctionInclude)(this.connection, fullConfig.functionGroupName, fullConfig.includeName, lockHandle);
            this.connection.setSessionType('stateless');
            this.untrackLock(fullConfig.functionGroupName, fullConfig.includeName);
            lockHandle = undefined;
            // 5. Final check
            this.logger?.info?.('Step 5: Final check');
            const finalCheck = await (0, check_1.checkFunctionInclude)(this.connection, fullConfig.functionGroupName, fullConfig.includeName, 'inactive');
            state.checkResult = finalCheck;
            // 6. Activate (optional)
            if (options?.activateOnUpdate) {
                this.logger?.info?.('Step 6: Activating function include');
                const activateResponse = await (0, activation_1.activateFunctionInclude)(this.connection, fullConfig.functionGroupName, fullConfig.includeName);
                state.activateResult = activateResponse;
                try {
                    const readState = await this.readMetadataRaw({
                        functionGroupName: fullConfig.functionGroupName,
                        includeName: fullConfig.includeName,
                    }, 'active', { withLongPolling: true });
                    if (readState) {
                        state.readResult = readState.readResult;
                    }
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed after activation:', (0, internalUtils_1.safeErrorMessage)(readError));
                }
            }
            else {
                // No activation happened: return the version just written (inactive),
                // not the stale active one.
                const readResponse = await (0, read_1.readFunctionInclude)(this.connection, fullConfig.functionGroupName, fullConfig.includeName, 'inactive');
                state.readResult = readResponse;
            }
            return state;
        }
        catch (error) {
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking function include during error cleanup');
                    this.connection.setSessionType('stateful');
                    await (0, unlock_1.unlockFunctionInclude)(this.connection, fullConfig.functionGroupName, fullConfig.includeName, lockHandle);
                    this.connection.setSessionType('stateless');
                    this.untrackLock(fullConfig.functionGroupName, fullConfig.includeName);
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
                    this.logger?.warn?.('Deleting function include after failure');
                    await (0, delete_1.deleteFunctionInclude)(this.connection, this.buildDeleteParams(fullConfig));
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete function include after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
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
     * Delete function include.
     */
    async delete(config) {
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        if (!config.includeName) {
            throw new Error('Include name is required');
        }
        const state = { errors: [] };
        try {
            this.logger?.info?.('Checking function include for deletion');
            const deletionCheck = await (0, delete_1.checkDeletion)(this.connection, this.buildDeleteParams(config));
            // ADT already said whether this may be deleted; refusing to read that
            // answer is how a delete came to report success while the object
            // stayed. Throws on isDeletable=false or a message of type E; a W
            // is a warning and passes.
            (0, deletionCheck_1.assertDeletable)(deletionCheck.data);
            state.checkResult = deletionCheck;
            this.logger?.info?.('Deletion check passed');
            this.logger?.info?.('Deleting function include');
            const deleteResponse = await (0, delete_1.deleteFunctionInclude)(this.connection, this.buildDeleteParams(config));
            state.deleteResult = deleteResponse;
            this.logger?.info?.('Function include deleted');
            return state;
        }
        catch (error) {
            this.logger?.error('Delete failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Activate function include.
     */
    async activate(config) {
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        if (!config.includeName) {
            throw new Error('Include name is required');
        }
        const state = { errors: [] };
        try {
            const activateResponse = await (0, activation_1.activateFunctionInclude)(this.connection, config.functionGroupName, config.includeName);
            state.activateResult = activateResponse;
            return state;
        }
        catch (error) {
            this.logger?.error('Activate failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Check function include.
     */
    async check(config, status) {
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        if (!config.includeName) {
            throw new Error('Include name is required');
        }
        const version = status === 'active' ? 'active' : 'inactive';
        const deletionCheck = await (0, check_1.checkFunctionInclude)(this.connection, config.functionGroupName, config.includeName, version, config.sourceCode, this.sourceArtifactContentType());
        return { checkResult: deletionCheck, errors: [] };
    }
    /**
     * Read transport info — not supported for FUGR/I (transport tracked at group level).
     *
     * @deprecated Not part of this handler's capability set; throws. Removed in a later major.
     */
    async readTransport() {
        const error = new Error('readTransport is not supported for function includes (tracked at function group level)');
        return {
            errors: [{ method: 'readTransport', error, timestamp: new Date() }],
        };
    }
    /**
     * Lock function include for modification.
     */
    async lock(config) {
        if (!config.functionGroupName || !config.includeName) {
            throw new Error('Function group name and include name are required');
        }
        this.connection.setSessionType('stateful');
        const lockHandle = await (0, lock_1.lockFunctionInclude)(this.connection, config.functionGroupName, config.includeName, this.logger);
        this.trackLock(config.functionGroupName, config.includeName, lockHandle);
        return lockHandle;
    }
    /**
     * Unlock function include.
     */
    async unlock(config, lockHandle) {
        if (!config.functionGroupName || !config.includeName) {
            throw new Error('Function group name and include name are required');
        }
        this.connection.setSessionType('stateful');
        await (0, unlock_1.unlockFunctionInclude)(this.connection, config.functionGroupName, config.includeName, lockHandle);
        this.connection.setSessionType('stateless');
        this.untrackLock(config.functionGroupName, config.includeName);
        return { errors: [] };
    }
    getVersions(config) {
        return (0, versions_1.getFunctionIncludeVersions)(this.connection, config);
    }
    getVersionSource(contentUri) {
        return (0, versions_1.getFunctionIncludeVersionSource)(this.connection, contentUri);
    }
}
exports.AdtFunctionInclude = AdtFunctionInclude;
