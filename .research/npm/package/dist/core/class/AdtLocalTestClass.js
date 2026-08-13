"use strict";
/**
 * AdtLocalTestClass - High-level CRUD operations for Local Test Classes
 *
 * Local test classes are defined in the testclasses include of an ABAP class.
 * All operations require the parent class to be locked.
 */
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
exports.AdtLocalTestClass = void 0;
const internalUtils_1 = require("../../utils/internalUtils");
const AdtClass_1 = require("./AdtClass");
const check_1 = require("./check");
const testclasses_1 = require("./testclasses");
class AdtLocalTestClass extends AdtClass_1.AdtClass {
    objectType = 'LocalTestClass';
    /**
     * Validate local test class code
     */
    async validate(config) {
        if (!config.className) {
            throw new Error('Class name is required for validation');
        }
        if (!config.testClassCode) {
            throw new Error('Test class code is required for validation');
        }
        const checkResponse = await (0, check_1.checkClassLocalTestClass)(this.connection, config.className, config.testClassCode, 'inactive', this.contentTypes?.sourceArtifactContentType());
        return {
            validationResponse: checkResponse,
            errors: [],
        };
    }
    /**
     * Create local test class with full operation chain
     * Requires parent class to be locked
     */
    async create(config, options) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        if (!config.testClassCode) {
            throw new Error('Test class code is required');
        }
        let parentLockHandle;
        const state = {
            errors: [],
        };
        try {
            // 1. Lock parent class (stateful only for lock)
            // Lock handle from parent class is sufficient for updating testclasses include
            this.logger?.info?.('Step 1: Locking parent class');
            parentLockHandle = await this.lock({ className: config.className });
            state.lockHandle = parentLockHandle;
            this.logger?.info?.('Parent class locked, handle:', parentLockHandle);
            // 2. Check test class code
            if (config.testClassCode) {
                this.logger?.info?.('Step 2: Checking test class code');
                const checkResponse = await (0, check_1.checkClassLocalTestClass)(this.connection, config.className, config.testClassCode, 'inactive', this.contentTypes?.sourceArtifactContentType());
                state.checkResult = checkResponse;
                this.logger?.info?.('Test class check passed');
            }
            // 3. Update test classes (uses parent class lock handle)
            this.logger?.info?.('Step 3: Creating test class');
            const updateResponse = await (0, testclasses_1.updateClassTestInclude)(this.connection, config.className, config.testClassCode, parentLockHandle, config.transportRequest, this.contentTypes?.sourceArtifactContentType());
            state.updateResult = updateResponse;
            this.logger?.info?.('Test class created');
            // 4. Unlock parent class (obligatory stateless after unlock)
            if (parentLockHandle) {
                this.logger?.info?.('Step 4: Unlocking parent class');
                const unlockState = await super.unlock({ className: config.className }, parentLockHandle);
                state.unlockResult = unlockState.unlockResult;
                parentLockHandle = undefined;
            }
            // 5. Activate parent class (if requested)
            if (options?.activateOnCreate) {
                this.logger?.info?.('Step 5: Activating parent class');
                const activateState = await this.activate({
                    className: config.className,
                });
                state.activateResult = activateState.activateResult;
                this.logger?.info?.('Parent class activated');
            }
            return state;
        }
        catch (error) {
            // Cleanup on error
            if (parentLockHandle) {
                try {
                    this.logger?.warn?.('Unlocking parent class during error cleanup');
                    await super.unlock({ className: config.className }, parentLockHandle);
                }
                catch (unlockError) {
                    this.logger?.warn?.('Failed to unlock parent class after error:', (0, internalUtils_1.safeErrorMessage)(unlockError));
                }
            }
            this.logger?.error('Create LocalTestClass failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read local test class code
     */
    async read(config, version = 'active', options) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        try {
            const { getClassTestClassesInclude } = await Promise.resolve().then(() => __importStar(require('./read')));
            const response = await getClassTestClassesInclude(this.connection, config.className, version, this.logger, options);
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
            this.logger?.error('Read LocalTestClass failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Update local test class with full operation chain
     * Requires parent class to be locked
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    async update(config, options) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        if (!config.testClassCode) {
            throw new Error('Test class code is required');
        }
        // Low-level mode: if lockHandle is provided, perform only update operation
        if (options?.lockHandle) {
            const codeToUpdate = options?.sourceCode || config.testClassCode;
            if (!codeToUpdate) {
                throw new Error('Test class code is required for update');
            }
            this.logger?.info?.('Low-level update: performing update only (lockHandle provided)');
            const updateResponse = await (0, testclasses_1.updateClassTestInclude)(this.connection, config.className, codeToUpdate, options.lockHandle, config.transportRequest, this.contentTypes?.sourceArtifactContentType());
            this.logger?.info?.('Test class updated (low-level)');
            return {
                updateResult: updateResponse,
                errors: [],
            };
        }
        let parentLockHandle;
        const state = {
            errors: [],
        };
        try {
            // 1. Lock parent class (stateful only for lock)
            // Lock handle from parent class is sufficient for updating testclasses include
            this.logger?.info?.('Step 1: Locking parent class');
            parentLockHandle = await this.lock({ className: config.className });
            state.lockHandle = parentLockHandle;
            this.logger?.info?.('Parent class locked, handle:', parentLockHandle);
            // 2. Check test class code
            const codeToCheck = options?.sourceCode || config.testClassCode;
            if (codeToCheck) {
                this.logger?.info?.('Step 2: Checking test class code');
                const checkResponse = await (0, check_1.checkClassLocalTestClass)(this.connection, config.className, codeToCheck, 'inactive', this.contentTypes?.sourceArtifactContentType());
                state.checkResult = checkResponse;
                this.logger?.info?.('Test class check passed');
            }
            // 3. Update test classes (uses parent class lock handle)
            this.logger?.info?.('Step 3: Updating test class');
            const updateResponse = await (0, testclasses_1.updateClassTestInclude)(this.connection, config.className, codeToCheck, parentLockHandle, config.transportRequest, this.contentTypes?.sourceArtifactContentType());
            state.updateResult = updateResponse;
            this.logger?.info?.('Test class updated');
            // 4. Unlock parent class (obligatory stateless after unlock)
            if (parentLockHandle) {
                this.logger?.info?.('Step 4: Unlocking parent class');
                const unlockState = await super.unlock({ className: config.className }, parentLockHandle);
                state.unlockResult = unlockState.unlockResult;
                parentLockHandle = undefined;
            }
            // 5. Activate parent class (if requested)
            if (options?.activateOnUpdate) {
                this.logger?.info?.('Step 5: Activating parent class');
                const activateState = await this.activate({
                    className: config.className,
                });
                state.activateResult = activateState.activateResult;
                this.logger?.info?.('Parent class activated');
            }
            return state;
        }
        catch (error) {
            // Cleanup on error
            if (parentLockHandle) {
                try {
                    this.logger?.warn?.('Unlocking parent class during error cleanup');
                    await super.unlock({ className: config.className }, parentLockHandle);
                }
                catch (unlockError) {
                    this.logger?.warn?.('Failed to unlock parent class after error:', (0, internalUtils_1.safeErrorMessage)(unlockError));
                }
            }
            this.logger?.error('Update LocalTestClass failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Delete local test class
     * Performs update with empty code to remove the test class
     */
    async delete(config) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        // Delete by updating with empty code
        return await this.update({
            ...config,
            testClassCode: '',
        });
    }
    /**
     * Check local test class code
     * Override to use local test class specific check function
     */
    async check(config, status = 'inactive') {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        if (!config.testClassCode) {
            throw new Error('Test class code is required');
        }
        const checkResponse = await (0, check_1.checkClassLocalTestClass)(this.connection, config.className, config.testClassCode, status, this.contentTypes?.sourceArtifactContentType());
        return {
            checkResult: checkResponse,
            errors: [],
        };
    }
    // TODO: Investigate lock/unlock/delete operations for local test classes
    // - Currently uses parent class lock (lockClass) for update operations
    // - There is a separate lockClassTestClasses() function that locks /includes/testclasses endpoint
    // - Eclipse ADT logs show parent class lock is used before updating local includes
    // - Need to verify if /includes/testclasses?_action=LOCK endpoint exists in ADT discovery
    // - Delete operation currently uses update() with empty code, but validation prevents empty strings
    // - Consider: Should delete() bypass validation or use a different approach?
    getVersions(config) {
        if (!config.className)
            throw new Error('className is required');
        return this.getIncludeVersions(config.className, 'testclasses');
    }
}
exports.AdtLocalTestClass = AdtLocalTestClass;
