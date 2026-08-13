"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtClass = void 0;
const criticalSection_1 = require("../../utils/criticalSection");
/**
 * AdtClass - High-level CRUD operations for Class objects
 *
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 *
 * Uses low-level functions directly (not Builder classes).
 *
 * Session management:
 * - stateful: only when doing lock operations
 * - stateless: obligatory after unlock
 * - If no lock/unlock, no stateful needed
 *
 * Operation chains:
 * - Create: validate → create → check → lock → check(inactive) → update → unlock → check → activate
 * - Update: lock → check(inactive) → update → unlock → check → activate
 * - Delete: check(deletion) → delete
 */
const interfaces_1 = require("@mcp-abap-adt/interfaces");
const internalUtils_1 = require("../../utils/internalUtils");
const capabilities_1 = require("../shared/capabilities");
const LockRegistry_1 = require("../shared/LockRegistry");
const activation_1 = require("./activation");
const check_1 = require("./check");
const create_1 = require("./create");
const delete_1 = require("./delete");
const lock_1 = require("./lock");
const read_1 = require("./read");
const testclasses_1 = require("./testclasses");
const unlock_1 = require("./unlock");
const update_1 = require("./update");
const validation_1 = require("./validation");
const versions_1 = require("./versions");
class AdtClass {
    connection;
    logger;
    systemContext;
    contentTypes;
    lockTracker;
    objectType = 'Class';
    // LAZY thunk (not a getter that snapshots): captures `this` but reads
    // this.connection/this.logger only when invoked, after the constructor has
    // run — so building the capabilities below as class fields is safe.
    capCtx = () => ({
        connection: this.connection,
        logger: this.logger,
    });
    lockCap = new capabilities_1.LockCapability(this.capCtx, {
        nameOf: (c) => {
            if (!c.className)
                throw new Error('Class name is required');
            return c.className;
        },
        acquire: async (ctx, name) => ({
            lockHandle: await (0, lock_1.lockClass)(ctx.connection, name),
        }),
        release: async (ctx, name, handle) => {
            const result = await (0, unlock_1.unlockClass)(ctx.connection, name, handle);
            return { unlockResult: result, errors: [] };
        },
    });
    versionsCap = new capabilities_1.VersionsCapability(this.capCtx, {
        nameOf: (c) => {
            if (!c.className)
                throw new Error('className is required');
            return c.className;
        },
        list: (ctx, name) => (0, versions_1.getClassIncludeVersions)(ctx.connection, name, 'main'),
        source: (ctx, uri) => (0, versions_1.getClassVersionSource)(ctx.connection, uri),
    });
    constructor(connection, logger, systemContext, contentTypes, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
        this.contentTypes = contentTypes;
        this.lockTracker = (0, LockRegistry_1.createLockTracker)(lockRegistry, this.objectType, (className, lockHandle) => (0, unlock_1.unlockClass)(this.connection, className, lockHandle));
    }
    /**
     * Validate class configuration before creation
     */
    async validate(config) {
        if (!config.className) {
            throw new Error('Class name is required for validation');
        }
        try {
            const validationResponse = await (0, validation_1.validateClassName)(this.connection, config.className, config.packageName, config.description, config.superclass);
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
            this.logger?.error?.(`Validate failed: HTTP ${status || '?'} ${statusText || ''}`, { status, statusText, message: errorMessage });
            if (status && status >= 400 && status < 500) {
                const customError = new interfaces_1.AdtOperationError(`Validation failed for object '${config.className}': ${errorMessage}`);
                customError.code = interfaces_1.AdtObjectErrorCodes.VALIDATION_FAILED;
                customError.status = status;
                customError.statusText = statusText;
                customError.originalError = error;
                throw customError;
            }
            throw error;
        }
    }
    /**
     * Create class with full operation chain
     */
    async create(config, options) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        if (!config.packageName) {
            throw new Error('Package name is required');
        }
        let objectCreated = false;
        const state = {
            errors: [],
        };
        try {
            // Create class (requires stateful)
            this.logger?.info?.('Creating class');
            this.connection.setSessionType('stateful');
            state.createResult = await (0, create_1.create)(this.connection, {
                class_name: config.className,
                package_name: config.packageName,
                transport_request: config.transportRequest,
                description: config.description,
                superclass: config.superclass,
                final: config.final,
                abstract: config.abstract,
                create_protected: config.createProtected,
                master_system: config.masterSystem ?? this.systemContext.masterSystem,
                responsible: config.responsible ?? this.systemContext.responsible,
                masterLanguage: config.masterLanguage ?? this.systemContext.masterLanguage,
                template_xml: config.classTemplate,
            }, this.logger, this.contentTypes);
            objectCreated = true;
            this.connection.setSessionType('stateless');
            this.logger?.info?.('Class created');
            return state;
        }
        catch (error) {
            // Cleanup on error - ensure stateless
            this.connection.setSessionType('stateless');
            if (objectCreated && options?.deleteOnFailure) {
                try {
                    this.logger?.warn?.('Deleting class after failure');
                    this.connection.setSessionType('stateful');
                    await (0, delete_1.deleteClass)(this.connection, {
                        class_name: config.className,
                        transport_request: config.transportRequest,
                    });
                    this.connection.setSessionType('stateless');
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete class after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
                }
            }
            this.logger?.error('Create failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read class
     */
    async read(config, version, options) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        try {
            const response = await (0, read_1.getClassSource)(this.connection, config.className, version, options);
            return {
                readResult: response,
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
            // Log error details
            this.logger?.error?.(`Read failed: HTTP ${status || '?'} ${statusText || ''}`, { status, statusText, message: errorMessage });
            // 404 - object doesn't exist
            if (status === 404) {
                return undefined;
            }
            // 4** errors - throw with error code
            if (status && status >= 400 && status < 500) {
                const customError = new interfaces_1.AdtOperationError(`Failed to read object '${config.className}': ${errorMessage}`);
                customError.code = interfaces_1.AdtObjectErrorCodes.OBJECT_NOT_FOUND;
                customError.status = status;
                customError.statusText = statusText;
                customError.originalError = error;
                throw customError;
            }
            throw error;
        }
    }
    /**
     * Read class metadata (object characteristics: package, responsible, description, etc.)
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
            const readOptions = this.contentTypes
                ? { ...options, accept: this.contentTypes.classRead().accept }
                : options;
            const response = await (0, read_1.getClassMetadata)(this.connection, config.className, readOptions);
            state.metadataResult = response;
            this.logger?.info?.('Class metadata read successfully');
            return state;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            state.errors.push({
                method: 'readMetadata',
                error: err,
                timestamp: new Date(),
            });
            this.logger?.error('Read metadata failed:', (0, internalUtils_1.safeErrorMessage)(err));
            throw err;
        }
    }
    /**
     * Update class with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    async update(config, options) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        // Low-level mode: if lockHandle is provided, perform only update operation
        if (options?.lockHandle) {
            const codeToUpdate = options?.sourceCode || config.sourceCode;
            if (!codeToUpdate) {
                throw new Error('Source code is required for update');
            }
            this.logger?.info?.('Low-level update: performing update only (lockHandle provided)');
            const updateResponse = await (0, update_1.updateClass)(this.connection, config.className, codeToUpdate, options.lockHandle, config.transportRequest, this.contentTypes?.sourceArtifactContentType());
            this.logger?.info?.('Class updated (low-level)');
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
            // 1. Lock — stay stateful for the whole lock→check→update→unlock chain.
            // On older BASIS (#106) the lock handle is only valid inside stateful
            // requests; a stateless write in between fails with 423. unlock() below
            // restores stateless.
            this.logger?.info?.('Step 1: Locking class');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockClass)(this.connection, config.className);
            state.lockHandle = lockHandle;
            this.lockTracker.track(config.className, lockHandle);
            this.logger?.info?.('Class locked, handle:', lockHandle);
            // 2. Check inactive with code/xml for update (from options or config)
            const codeToCheck = options?.sourceCode || config.sourceCode;
            if (codeToCheck) {
                this.logger?.info?.('Step 2: Checking inactive version with update content');
                state.checkResult = await (0, check_1.checkClass)(this.connection, config.className, 'inactive', codeToCheck, this.contentTypes?.sourceArtifactContentType());
                this.logger?.info?.('Check inactive with update content passed');
            }
            // 3. Update
            if (codeToCheck && lockHandle) {
                this.logger?.info?.('Step 3: Updating class');
                state.updateResult = await (0, update_1.updateClass)(this.connection, config.className, codeToCheck, lockHandle, config.transportRequest, this.contentTypes?.sourceArtifactContentType());
                this.logger?.info?.('Class updated');
                // Poll the inactive version: the write above produced it; the active version may not exist yet.
                // 3.5. Read with long polling to ensure object is ready after update
                this.logger?.info?.('read (wait for object ready after update)');
                try {
                    await this.read({ className: config.className }, 'inactive', {
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
                this.logger?.info?.('Step 4: Unlocking class');
                this.connection.setSessionType('stateful');
                state.unlockResult = await (0, unlock_1.unlockClass)(this.connection, config.className, lockHandle);
                this.connection.setSessionType('stateless');
                this.lockTracker.untrack(config.className);
                lockHandle = undefined;
                this.logger?.info?.('Class unlocked');
            }
            // 5. Final check (no stateful needed)
            this.logger?.info?.('Step 5: Final check');
            state.checkResult = await (0, check_1.checkClass)(this.connection, config.className, 'inactive');
            this.logger?.info?.('Final check passed');
            // 6. Activate (if requested, no stateful needed - uses same session/cookies)
            if (options?.activateOnUpdate) {
                this.logger?.info?.('Step 6: Activating class');
                const activateResult = await (0, activation_1.activateClass)(this.connection, config.className);
                state.activateResult = activateResult;
                this.logger?.info?.('Class activated, status:', activateResult.status);
                // 6.5. Read with long polling to ensure object is ready after activation
                this.logger?.info?.('read (wait for object ready after activation)');
                try {
                    const readState = await this.read({ className: config.className }, 'active', { withLongPolling: true });
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
                    this.logger?.warn?.('Unlocking class during error cleanup');
                    this.connection.setSessionType('stateful');
                    await (0, unlock_1.unlockClass)(this.connection, config.className, lockHandle);
                    this.connection.setSessionType('stateless');
                    this.lockTracker.untrack(config.className);
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
                    this.logger?.warn?.('Deleting class after failure');
                    this.connection.setSessionType('stateful');
                    await (0, delete_1.deleteClass)(this.connection, {
                        class_name: config.className,
                        transport_request: config.transportRequest,
                    });
                    this.connection.setSessionType('stateless');
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete class after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
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
     * Delete class
     */
    async delete(config) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        const state = {
            errors: [],
        };
        try {
            // Check for deletion (no stateful needed)
            this.logger?.info?.('Checking class for deletion');
            const checkResult = await (0, delete_1.checkDeletion)(this.connection, {
                class_name: config.className,
                transport_request: config.transportRequest,
            });
            state.checkResult = checkResult;
            this.logger?.info?.('Deletion check passed');
            // Delete (requires stateful, but no lock)
            this.logger?.info?.('Deleting class');
            this.connection.setSessionType('stateful');
            const deleteResult = await (0, delete_1.deleteClass)(this.connection, {
                class_name: config.className,
                transport_request: config.transportRequest,
            });
            state.deleteResult = deleteResult;
            this.logger?.info?.('Class deleted');
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
            this.logger?.error?.(`Delete failed: HTTP ${status || '?'} ${statusText || ''}`, { status, statusText, message: errorMessage });
            if (status && status >= 400 && status < 500) {
                const customError = new interfaces_1.AdtOperationError(`Deletion failed for object '${config.className}': ${errorMessage}`);
                customError.code = interfaces_1.AdtObjectErrorCodes.DELETE_FAILED;
                customError.status = status;
                customError.statusText = statusText;
                customError.originalError = error;
                throw customError;
            }
            throw error;
        }
        finally {
            this.connection.setSessionType('stateless');
        }
    }
    /**
     * Activate class
     * No stateful needed - uses same session/cookies
     */
    async activate(config) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        const state = {
            errors: [],
        };
        try {
            const activateResult = await (0, activation_1.activateClass)(this.connection, config.className);
            state.activateResult = activateResult;
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
            this.logger?.error?.(`Activate failed: HTTP ${status || '?'} ${statusText || ''}`, { status, statusText, message: errorMessage });
            if (status && status >= 400 && status < 500) {
                const customError = new interfaces_1.AdtOperationError(`Activation failed for object '${config.className}': ${errorMessage}`);
                customError.code = interfaces_1.AdtObjectErrorCodes.ACTIVATE_FAILED;
                customError.status = status;
                customError.statusText = statusText;
                customError.originalError = error;
                throw customError;
            }
            throw error;
        }
    }
    /**
     * Check class
     */
    async check(config, status) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        try {
            // Map status to version
            const version = status === 'active' ? 'active' : 'inactive';
            const response = await (0, check_1.checkClass)(this.connection, config.className, version, config.sourceCode, this.contentTypes?.sourceArtifactContentType());
            // Parse response to check for type E errors
            const { parseCheckRunResponse } = await Promise.resolve().then(() => __importStar(require('../../utils/checkRun')));
            const checkResult = parseCheckRunResponse(response);
            // If there are errors (type E), throw error
            if (checkResult.has_errors) {
                const errorMessages = checkResult.errors
                    .map((e) => e.text || '')
                    .join('; ');
                const customError = new interfaces_1.AdtOperationError(`Check failed for object '${config.className}': ${errorMessages || checkResult.message}`);
                customError.code = interfaces_1.AdtObjectErrorCodes.CHECK_FAILED;
                customError.status = response.status;
                customError.statusText = response.statusText;
                customError.checkResult = checkResult;
                throw customError;
            }
            const state = {
                checkResult: response,
                errors: [],
            };
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
            this.logger?.error?.(`Check failed: HTTP ${status || '?'} ${statusText || ''}`, { status, statusText, message: errorMessage });
            // If error already has code (from checkResult parsing), rethrow
            if (error.code) {
                throw error;
            }
            // 4** errors - throw with error code
            if (status && status >= 400 && status < 500) {
                const customError = new interfaces_1.AdtOperationError(`Check failed for object '${config.className}': ${errorMessage}`);
                customError.code = interfaces_1.AdtObjectErrorCodes.CHECK_FAILED;
                customError.status = status;
                customError.statusText = statusText;
                customError.originalError = error;
                throw customError;
            }
            throw error;
        }
    }
    /**
     * Lock class
     */
    async lock(config) {
        const handle = await this.lockCap.lock(config);
        this.lockTracker.track(config.className, handle);
        return handle;
    }
    /**
     * Unlock class
     */
    async unlock(config, lockHandle) {
        const state = await this.lockCap.unlock(config, lockHandle);
        this.lockTracker.untrack(config.className);
        return state;
    }
    /**
     * Lock test classes (local classes) for modification
     * Uses parent class lock - sufficient for updating testclasses include
     */
    async lockTestClasses(config) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        // Stay stateful while the lock is held (see lock()); unlockTestClasses()
        // restores stateless. Avoids 423 on older BASIS (#106).
        this.connection.setSessionType('stateful');
        return await (0, lock_1.lockClass)(this.connection, config.className);
    }
    /**
     * Unlock test classes (local classes)
     * Uses parent class unlock
     */
    async unlockTestClasses(config, lockHandle) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        this.connection.setSessionType('stateful');
        const result = await (0, unlock_1.unlockClass)(this.connection, config.className, lockHandle);
        this.connection.setSessionType('stateless');
        return result;
    }
    /**
     * Check test class code (local class)
     */
    async checkTestClass(config, version = 'inactive') {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        if (!config.testClassCode) {
            throw new Error('Test class code is required');
        }
        return await (0, check_1.checkClassLocalTestClass)(this.connection, config.className, config.testClassCode, version, this.contentTypes?.sourceArtifactContentType());
    }
    /**
     * Update test classes (local classes) with full operation chain
     * Always starts with lock of parent class
     */
    async updateTestClasses(config) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        if (!config.testClassCode) {
            throw new Error('Test class code is required');
        }
        let lockHandle;
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            // 1. Lock parent class (stateful only for lock)
            // Lock handle from parent class is sufficient for updating testclasses include
            this.logger?.info?.('Step 1: Locking parent class');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockClass)(this.connection, config.className);
            this.lockTracker.track(config.className, lockHandle);
            this.logger?.info?.('Parent class locked, handle:', lockHandle);
            // 2. Update test classes (uses parent class lock handle)
            this.logger?.info?.('Step 2: Updating test classes');
            const response = await (0, testclasses_1.updateClassTestInclude)(this.connection, config.className, config.testClassCode, lockHandle, config.transportRequest, this.contentTypes?.sourceArtifactContentType());
            // 3. Unlock parent class (switch to stateless after unlock)
            this.logger?.info?.('Step 3: Unlocking parent class');
            this.connection.setSessionType('stateful');
            await (0, unlock_1.unlockClass)(this.connection, config.className, lockHandle);
            this.connection.setSessionType('stateless');
            this.lockTracker.untrack(config.className);
            lockHandle = undefined;
            return response;
        }
        catch (error) {
            // Cleanup: unlock on error
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking parent class after error');
                    this.connection.setSessionType('stateful');
                    await (0, unlock_1.unlockClass)(this.connection, config.className, lockHandle);
                    this.connection.setSessionType('stateless');
                    this.lockTracker.untrack(config.className);
                }
                catch (unlockError) {
                    this.logger?.warn?.('Failed to unlock parent class after error:', (0, internalUtils_1.safeErrorMessage)(unlockError));
                }
            }
            throw error;
        }
        finally {
            endCriticalSection();
        }
    }
    /**
     * Activate test classes (local classes)
     */
    async activateTestClasses(config) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        if (!config.testClassName) {
            throw new Error('Test class name is required');
        }
        return await (0, testclasses_1.activateClassTestClasses)(this.connection, config.className, config.testClassName);
    }
    /**
     * Read transport request information for the class
     */
    async readTransport(config, options) {
        const state = {
            errors: [],
        };
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
            const response = await (0, read_1.getClassTransport)(this.connection, config.className, options);
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
            this.logger?.error('Read transport failed:', (0, internalUtils_1.safeErrorMessage)(err));
            throw err;
        }
    }
    getVersions(config) {
        return this.versionsCap.getVersions(config);
    }
    getVersionSource(contentUri) {
        return this.versionsCap.getVersionSource(contentUri);
    }
    /** Shared by local-include subclasses to target their own include. */
    getIncludeVersions(className, includeType) {
        return (0, versions_1.getClassIncludeVersions)(this.connection, className, includeType);
    }
}
exports.AdtClass = AdtClass;
