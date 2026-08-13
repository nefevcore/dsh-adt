"use strict";
/**
 * AdtLocalMacros - High-level CRUD operations for Local Macros
 *
 * Local macros are defined in the macros include of an ABAP class.
 * Note: Macros are supported in older ABAP versions but not in newer ones.
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
exports.AdtLocalMacros = void 0;
const internalUtils_1 = require("../../utils/internalUtils");
const AdtClass_1 = require("./AdtClass");
const check_1 = require("./check");
const includes_1 = require("./includes");
class AdtLocalMacros extends AdtClass_1.AdtClass {
    objectType = 'LocalMacros';
    /**
     * Validate local macros code
     */
    async validate(config) {
        if (!config.className) {
            throw new Error('Class name is required for validation');
        }
        if (!config.macrosCode) {
            throw new Error('Macros code is required for validation');
        }
        const checkResponse = await (0, check_1.checkClassMacros)(this.connection, config.className, config.macrosCode, 'inactive', this.contentTypes?.sourceArtifactContentType());
        return {
            validationResponse: checkResponse,
            errors: [],
        };
    }
    /**
     * Create local macros with full operation chain
     * Requires parent class to be locked
     */
    async create(config, options) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        if (!config.macrosCode) {
            throw new Error('Macros code is required');
        }
        let lockHandle;
        const state = {
            errors: [],
        };
        try {
            // 1. Lock parent class (stateful only for lock)
            this.logger?.info?.('Step 1: Locking parent class');
            lockHandle = await super.lock({ className: config.className });
            state.lockHandle = lockHandle;
            this.logger?.info?.('Parent class locked, handle:', lockHandle);
            // 2. Check local macros code
            const codeToCheck = options?.sourceCode || config.macrosCode;
            if (codeToCheck) {
                this.logger?.info?.('Step 2: Checking local macros code');
                const checkResponse = await (0, check_1.checkClassMacros)(this.connection, config.className, codeToCheck, 'inactive', this.contentTypes?.sourceArtifactContentType());
                state.checkResult = checkResponse;
                this.logger?.info?.('Local macros check passed');
            }
            // 3. Update local macros
            this.logger?.info?.('Step 3: Creating local macros');
            const updateResponse = await (0, includes_1.updateClassMacros)(this.connection, config.className, codeToCheck, lockHandle, config.transportRequest, this.contentTypes?.sourceArtifactContentType());
            state.updateResult = updateResponse;
            this.logger?.info?.('Local macros created');
            // 4. Unlock parent class (obligatory stateless after unlock)
            this.logger?.info?.('Step 4: Unlocking parent class');
            const unlockState = await super.unlock({ className: config.className }, lockHandle);
            state.unlockResult = unlockState.unlockResult;
            lockHandle = undefined;
            return state;
        }
        catch (error) {
            // Cleanup on error
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking parent class during error cleanup');
                    await super.unlock({ className: config.className }, lockHandle);
                }
                catch (unlockError) {
                    this.logger?.warn?.('Failed to unlock parent class after error:', (0, internalUtils_1.safeErrorMessage)(unlockError));
                }
            }
            this.logger?.error('Create LocalMacros failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Read local macros code
     */
    async read(config, version = 'active', options) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        try {
            const { getClassMacrosInclude } = await Promise.resolve().then(() => __importStar(require('./read')));
            const response = await getClassMacrosInclude(this.connection, config.className, version, this.logger, options);
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
            this.logger?.error('Read LocalMacros failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Update local macros with full operation chain
     * Requires parent class to be locked
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    async update(config, options) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        if (!config.macrosCode) {
            throw new Error('Macros code is required');
        }
        // Low-level mode: if lockHandle is provided, perform only update operation
        if (options?.lockHandle) {
            const codeToUpdate = options?.sourceCode || config.macrosCode;
            if (!codeToUpdate) {
                throw new Error('Macros code is required for update');
            }
            this.logger?.info?.('Low-level update: performing update only (lockHandle provided)');
            const updateResponse = await (0, includes_1.updateClassMacros)(this.connection, config.className, codeToUpdate, options.lockHandle, config.transportRequest, this.contentTypes?.sourceArtifactContentType());
            this.logger?.info?.('Local macros updated (low-level)');
            return {
                updateResult: updateResponse,
                errors: [],
            };
        }
        let lockHandle;
        const state = {
            errors: [],
        };
        try {
            // 1. Lock parent class (stateful only for lock)
            this.logger?.info?.('Step 1: Locking parent class');
            lockHandle = await super.lock({ className: config.className });
            state.lockHandle = lockHandle;
            this.logger?.info?.('Parent class locked, handle:', lockHandle);
            // 2. Check local macros code
            const codeToCheck = options?.sourceCode || config.macrosCode;
            if (codeToCheck) {
                this.logger?.info?.('Step 2: Checking local macros code');
                const checkResponse = await (0, check_1.checkClassMacros)(this.connection, config.className, codeToCheck, 'inactive', this.contentTypes?.sourceArtifactContentType());
                state.checkResult = checkResponse;
                this.logger?.info?.('Local macros check passed');
            }
            // 3. Update local macros
            this.logger?.info?.('Step 3: Updating local macros');
            const updateResponse = await (0, includes_1.updateClassMacros)(this.connection, config.className, codeToCheck, lockHandle, config.transportRequest, this.contentTypes?.sourceArtifactContentType());
            state.updateResult = updateResponse;
            this.logger?.info?.('Local macros updated');
            // 4. Unlock parent class (obligatory stateless after unlock)
            this.logger?.info?.('Step 4: Unlocking parent class');
            const unlockState = await super.unlock({ className: config.className }, lockHandle);
            state.unlockResult = unlockState.unlockResult;
            lockHandle = undefined;
            return state;
        }
        catch (error) {
            // Cleanup on error
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking parent class during error cleanup');
                    await super.unlock({ className: config.className }, lockHandle);
                }
                catch (unlockError) {
                    this.logger?.warn?.('Failed to unlock parent class after error:', (0, internalUtils_1.safeErrorMessage)(unlockError));
                }
            }
            this.logger?.error('Update LocalMacros failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Delete local macros
     * Performs update with empty code to remove the local macros
     */
    async delete(config) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        // Delete by updating with empty code
        return await this.update({
            ...config,
            macrosCode: '',
        });
    }
    /**
     * Activate parent class (local macros are activated with parent class)
     */
    async activate(config) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        return await super.activate({ className: config.className });
    }
    /**
     * Check local macros code
     */
    async check(config, version = 'inactive') {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        if (!config.macrosCode) {
            throw new Error('Macros code is required');
        }
        const checkResponse = await (0, check_1.checkClassMacros)(this.connection, config.className, config.macrosCode, version, this.contentTypes?.sourceArtifactContentType());
        return {
            checkResult: checkResponse,
            errors: [],
        };
    }
    // TODO: Investigate lock/unlock/delete operations for local macros
    // - Currently uses parent class lock (lockClass) for all operations
    // - Eclipse ADT logs show parent class lock is used before updating local includes
    // - Delete operation currently uses update() with empty code, but validation prevents empty strings
    // - Consider: Should delete() bypass validation or use a different approach?
    getVersions(config) {
        if (!config.className)
            throw new Error('className is required');
        return this.getIncludeVersions(config.className, 'macros');
    }
}
exports.AdtLocalMacros = AdtLocalMacros;
