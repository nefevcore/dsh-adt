"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtPackage = void 0;
const criticalSection_1 = require("../../utils/criticalSection");
const internalUtils_1 = require("../../utils/internalUtils");
const LockRegistry_1 = require("../shared/LockRegistry");
const versions_1 = require("../shared/versions");
const check_1 = require("./check");
const create_1 = require("./create");
const delete_1 = require("./delete");
const lock_1 = require("./lock");
const read_1 = require("./read");
const unlock_1 = require("./unlock");
const update_1 = require("./update");
const validation_1 = require("./validation");
class AdtPackage {
    connection;
    logger;
    systemContext;
    lockTracker;
    objectType = 'Package';
    constructor(connection, logger, systemContext, lockRegistry) {
        this.connection = connection;
        this.logger = logger;
        this.systemContext = systemContext ?? {};
        this.lockTracker = (0, LockRegistry_1.createLockTracker)(lockRegistry, this.objectType, (packageName, lockHandle) => (0, unlock_1.unlockPackage)(this.connection, packageName, lockHandle));
    }
    /**
     * Validate package configuration before creation
     */
    async validate(config) {
        if (!config.packageName) {
            throw new Error('Package name is required for validation');
        }
        if (!config.superPackage) {
            throw new Error('Super package is required for validation');
        }
        const response = await (0, validation_1.validatePackageBasic)(this.connection, {
            package_name: config.packageName,
            super_package: config.superPackage,
            description: config.description,
            package_type: config.packageType,
            software_component: config.softwareComponent,
            transport_layer: config.transportLayer,
            transport_request: config.transportRequest,
            application_component: config.applicationComponent,
            responsible: config.responsible,
            record_changes: config.recordChanges ?? false,
        });
        return {
            validationResponse: response,
            errors: [],
        };
    }
    /**
     * Create package with full operation chain
     * Note: Packages are containers, so no source code update after create
     */
    async create(config, options) {
        if (!config.packageName) {
            throw new Error('Package name is required');
        }
        if (!config.superPackage) {
            throw new Error('Super package is required');
        }
        if (!config.description) {
            throw new Error('Description is required');
        }
        if (!config.softwareComponent) {
            throw new Error('Software component is required');
        }
        if (!config.responsible && !this.systemContext.responsible) {
            throw new Error('Responsible person is required: provide it in package config or in AdtClient options');
        }
        let objectCreated = false;
        try {
            // 1. Validate (no stateful needed)
            this.logger?.info?.('Step 1: Validating package configuration');
            await (0, validation_1.validatePackageBasic)(this.connection, {
                package_name: config.packageName,
                super_package: config.superPackage,
                description: config.description,
                package_type: config.packageType,
                software_component: config.softwareComponent,
                transport_layer: config.transportLayer,
                transport_request: config.transportRequest,
                application_component: config.applicationComponent,
                responsible: config.responsible,
                record_changes: config.recordChanges ?? false,
            });
            this.logger?.info?.('Validation passed');
            // 2. Create (no stateful needed)
            this.logger?.info?.('Step 2: Creating package');
            await (0, create_1.createPackage)(this.connection, {
                package_name: config.packageName,
                super_package: config.superPackage,
                description: config.description,
                package_type: config.packageType,
                software_component: config.softwareComponent,
                transport_layer: config.transportLayer,
                transport_request: config.transportRequest,
                application_component: config.applicationComponent,
                responsible: config.responsible ?? this.systemContext.responsible,
                master_system: this.systemContext.masterSystem,
                master_language: config.masterLanguage?.trim() ||
                    this.systemContext.masterLanguage?.trim() ||
                    undefined,
                record_changes: config.recordChanges ?? false,
            });
            this.logger?.info?.('Package created');
            // 2.5. Read with long polling (wait for object to be ready)
            this.logger?.info?.('read (wait for object ready)');
            try {
                await this.read({ packageName: config.packageName }, 'active', {
                    withLongPolling: true,
                });
                this.logger?.info?.('object is ready after creation');
            }
            catch (readError) {
                this.logger?.warn?.('read with long polling failed (object may not be ready yet):', (0, internalUtils_1.safeErrorMessage)(readError));
                // Continue anyway - check might still work
            }
            objectCreated = true;
            // Packages are containers — no source code, no activation, no syntax check needed
            return { errors: [] };
        }
        catch (error) {
            // Ensure stateless if needed
            this.connection.setSessionType('stateless');
            if (objectCreated && options?.deleteOnFailure) {
                try {
                    this.logger?.warn?.('Deleting package after failure');
                    // No stateful needed - delete doesn't use lock/unlock
                    await (0, delete_1.deletePackage)(this.connection, {
                        package_name: config.packageName,
                        transport_request: config.transportRequest,
                    });
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete package after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
                }
            }
            this.logger?.error('Create failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read package
     */
    async read(config, version, options) {
        if (!config.packageName) {
            throw new Error('Package name is required');
        }
        try {
            const response = await (0, read_1.getPackage)(this.connection, config.packageName, version, options, this.logger);
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
     * Read package metadata (object characteristics: package, responsible, description, etc.)
     * For packages, read() already returns metadata since there's no source code.
     */
    async readMetadata(config, options) {
        const state = { errors: [] };
        if (!config.packageName) {
            const error = new Error('Package name is required');
            state.errors.push({
                method: 'readMetadata',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            // For objects without source code, read() already returns metadata
            const response = await (0, read_1.getPackage)(this.connection, config.packageName, 'active', options, this.logger);
            state.metadataResult = response;
            state.readResult = response;
            this.logger?.info?.('Package metadata read successfully');
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
     * Read transport request information for the package
     */
    async readTransport(config, options) {
        const state = { errors: [] };
        if (!config.packageName) {
            const error = new Error('Package name is required');
            state.errors.push({
                method: 'readTransport',
                error,
                timestamp: new Date(),
            });
            throw error;
        }
        try {
            const response = await (0, read_1.getPackageTransport)(this.connection, config.packageName, options?.withLongPolling !== undefined
                ? { withLongPolling: options.withLongPolling }
                : undefined);
            state.transportResult = response;
            this.logger?.info?.('Package transport request read successfully');
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
     * Update package with full operation chain
     * Always starts with lock
     * Note: Packages only support metadata updates (description, superPackage, etc.)
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    async update(config, options) {
        if (!config.packageName) {
            throw new Error('Package name is required');
        }
        if (!config.superPackage) {
            throw new Error('Super package is required for update');
        }
        if (!config.softwareComponent) {
            throw new Error('Software component is required for update');
        }
        // Low-level mode: if lockHandle is provided, perform only update operation
        if (options?.lockHandle) {
            this.logger?.info?.('Low-level update: performing update only (lockHandle provided)');
            const updateResponse = await (0, update_1.updatePackage)(this.connection, {
                package_name: config.packageName,
                super_package: config.superPackage,
                software_component: config.softwareComponent,
                transport_layer: config.transportLayer,
                description: config.description,
                package_type: config.packageType,
                responsible: config.responsible,
                record_changes: config.recordChanges ?? false,
            }, options.lockHandle);
            this.logger?.info?.('Package updated (low-level)');
            return {
                updateResult: updateResponse,
                errors: [],
            };
        }
        // TODO: Package update via RFC (SADT_REST_RFC_ENDPOINT) fails with HTTP 400
        // "Package is already locked" on PUT even though LOCK/UNLOCK succeed.
        // Root cause: PAK framework locks are session-scoped. Each call to
        // SADT_REST_RFC_ENDPOINT runs in a new internal ABAP context, so the
        // PUT cannot access the PAK lock created by the LOCK call.
        // DDIC objects are unaffected because their locks live in the DDIC buffer
        // (accessible by lockHandle from any context).
        // This is non-critical for release — HTTP is the primary transport for
        // modern on-premise systems. RFC is used for legacy (BASIS < 7.50) where
        // package CRUD is not supported anyway.
        // Reference: docs/development/RFC_TESTING.md
        let lockHandle;
        let lockCorrNr;
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            // 1. Lock — stateful mode stays active until after unlock
            this.logger?.info?.('Step 1: Locking package');
            this.connection.setSessionType('stateful');
            const lockResult = await (0, lock_1.lockPackage)(this.connection, config.packageName);
            lockHandle = lockResult.lockHandle;
            lockCorrNr = lockResult.corrNr;
            this.lockTracker.track(config.packageName, lockHandle);
            this.logger?.info?.(`Package locked, handle: ${lockHandle}, corrNr: ${lockCorrNr}`);
            // 2. Check inactive with XML for update (if provided)
            const xmlToCheck = options?.xmlContent;
            if (xmlToCheck) {
                this.logger?.info?.('Step 2: Checking inactive version with update content');
                await (0, check_1.checkPackage)(this.connection, config.packageName, 'inactive', xmlToCheck);
                this.logger?.info?.('Check inactive with update content passed');
            }
            // 3. Update metadata
            if (lockHandle) {
                this.logger?.info?.('Step 3: Updating package metadata');
                await (0, update_1.updatePackage)(this.connection, {
                    package_name: config.packageName,
                    super_package: config.superPackage,
                    description: config.updatedDescription ||
                        config.description ||
                        config.packageName,
                    package_type: config.packageType,
                    software_component: config.softwareComponent,
                    transport_layer: config.transportLayer,
                    transport_request: config.transportRequest || lockCorrNr,
                    application_component: config.applicationComponent,
                    responsible: config.responsible ?? this.systemContext.responsible,
                    master_system: config.masterSystem ?? this.systemContext.masterSystem,
                    record_changes: config.recordChanges,
                }, lockHandle);
                this.logger?.info?.('Package updated');
                // Poll the inactive version: the write above produced it; the active version may not exist yet.
                // 3.5. Read with long polling (wait for object to be ready after update)
                this.logger?.info?.('read (wait for object ready after update)');
                try {
                    await this.read({ packageName: config.packageName }, 'inactive', {
                        withLongPolling: true,
                    });
                    this.logger?.info?.('object is ready after update');
                }
                catch (readError) {
                    this.logger?.warn?.('read with long polling failed (object may not be ready yet):', (0, internalUtils_1.safeErrorMessage)(readError));
                    // Continue anyway - unlock might still work
                }
            }
            // 4. Unlock — set stateful before unlock, stateless after (standard pattern)
            if (lockHandle) {
                this.logger?.info?.('Step 4: Unlocking package');
                this.connection.setSessionType('stateful');
                await (0, unlock_1.unlockPackage)(this.connection, config.packageName, lockHandle);
                this.connection.setSessionType('stateless');
                this.lockTracker.untrack(config.packageName);
                lockHandle = undefined;
                this.logger?.info?.('Package unlocked');
            }
            // Note: Packages have no source code — no check or activate needed
            // Read and return result (no stateful needed)
            const readResponse = await (0, read_1.getPackage)(this.connection, config.packageName);
            return {
                updateResult: readResponse,
                errors: [],
            };
        }
        catch (error) {
            // Cleanup on error - unlock if locked (lockHandle saved for force unlock)
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking package during error cleanup');
                    this.connection.setSessionType('stateful');
                    await (0, unlock_1.unlockPackage)(this.connection, config.packageName, lockHandle);
                    this.connection.setSessionType('stateless');
                    this.lockTracker.untrack(config.packageName);
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
                    this.logger?.warn?.('Deleting package after failure');
                    // No stateful needed - delete doesn't use lock/unlock
                    await (0, delete_1.deletePackage)(this.connection, {
                        package_name: config.packageName,
                        transport_request: config.transportRequest,
                    });
                }
                catch (deleteError) {
                    this.logger?.warn?.('Failed to delete package after failure:', (0, internalUtils_1.safeErrorMessage)(deleteError));
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
     * Delete package
     */
    async delete(config) {
        if (!config.packageName) {
            throw new Error('Package name is required');
        }
        try {
            // Check for deletion (no stateful needed)
            this.logger?.info?.('Checking package for deletion');
            await (0, delete_1.checkPackageDeletion)(this.connection, {
                package_name: config.packageName,
                transport_request: config.transportRequest,
            });
            this.logger?.info?.('Deletion check passed');
            // Delete (no stateful needed - no lock/unlock)
            this.logger?.info?.('Deleting package');
            const result = await (0, delete_1.deletePackage)(this.connection, {
                package_name: config.packageName,
                transport_request: config.transportRequest,
            });
            this.logger?.info?.('Package deleted');
            return { deleteResult: result, errors: [] };
        }
        catch (error) {
            this.logger?.error('Delete failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Activate package
     * Note: Packages don't have activate operation - this is a stub
     *
     * @deprecated Not part of this handler's capability set; throws. Removed in a later major.
     */
    async activate(_config) {
        throw new Error('Activate operation is not supported for Package objects in ADT');
    }
    /**
     * Check package
     */
    async check(config, status) {
        if (!config.packageName) {
            throw new Error('Package name is required');
        }
        // Map status to version
        const version = status === 'active' ? 'active' : 'inactive';
        return {
            checkResult: await (0, check_1.checkPackage)(this.connection, config.packageName, version),
            errors: [],
        };
    }
    /**
     * Lock package for modification
     */
    async lock(config) {
        if (!config.packageName) {
            throw new Error('Package name is required');
        }
        this.connection.setSessionType('stateful');
        const lockResult = await (0, lock_1.lockPackage)(this.connection, config.packageName);
        this.lockTracker.track(config.packageName, lockResult.lockHandle);
        return lockResult.lockHandle;
    }
    /**
     * Unlock package
     */
    async unlock(config, lockHandle) {
        if (!config.packageName) {
            throw new Error('Package name is required');
        }
        this.connection.setSessionType('stateful');
        const result = await (0, unlock_1.unlockPackage)(this.connection, config.packageName, lockHandle);
        this.connection.setSessionType('stateless');
        this.lockTracker.untrack(config.packageName);
        return {
            unlockResult: result,
            errors: [],
        };
    }
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    async getVersions(_config) {
        (0, versions_1.throwUnsupportedVersions)('package');
    }
    /** @deprecated Not part of this handler's capability set; throws. Removed in a later major. */
    async getVersionSource(_contentUri) {
        (0, versions_1.throwUnsupportedVersions)('package');
    }
}
exports.AdtPackage = AdtPackage;
