"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtClassLegacy = void 0;
const criticalSection_1 = require("../../utils/criticalSection");
const internalUtils_1 = require("../../utils/internalUtils");
const deleteLegacy_1 = require("../shared/deleteLegacy");
const AdtClass_1 = require("./AdtClass");
const activation_1 = require("./activation");
const check_1 = require("./check");
const lock_1 = require("./lock");
const unlock_1 = require("./unlock");
const update_1 = require("./update");
class AdtClassLegacy extends AdtClass_1.AdtClass {
    /**
     * Update class — legacy override.
     *
     * Keeps lock→check→update→unlock in a single stateful session so the
     * lock handle remains valid (legacy stores locks in ABAP session memory).
     */
    async update(config, options) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        // Low-level mode: caller owns the session
        if (options?.lockHandle) {
            return super.update(config, options);
        }
        let lockHandle;
        const state = { errors: [] };
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            // Enter stateful session for the entire lock→update→unlock chain
            this.connection.setSessionType('stateful');
            // 1. Lock
            this.logger?.info?.('Legacy update step 1: Locking class');
            lockHandle = await (0, lock_1.lockClass)(this.connection, config.className);
            state.lockHandle = lockHandle;
            this.logger?.info?.('Class locked, handle:', lockHandle);
            // 2. Check inactive with source code
            const codeToUpdate = options?.sourceCode || config.sourceCode;
            if (codeToUpdate) {
                this.logger?.info?.('Legacy update step 2: Checking inactive version');
                state.checkResult = await (0, check_1.checkClass)(this.connection, config.className, 'inactive', codeToUpdate, this.contentTypes?.sourceArtifactContentType());
                this.logger?.info?.('Check passed');
            }
            // 3. Update
            if (codeToUpdate && lockHandle) {
                this.logger?.info?.('Legacy update step 3: Updating class');
                state.updateResult = await (0, update_1.updateClass)(this.connection, config.className, codeToUpdate, lockHandle, config.transportRequest, this.contentTypes?.sourceArtifactContentType());
                this.logger?.info?.('Class updated');
            }
            // 4. Unlock (still within the same stateful session)
            if (lockHandle) {
                this.logger?.info?.('Legacy update step 4: Unlocking class');
                state.unlockResult = await (0, unlock_1.unlockClass)(this.connection, config.className, lockHandle);
                lockHandle = undefined;
                this.logger?.info?.('Class unlocked');
            }
        }
        catch (error) {
            // Cleanup: try to unlock if still locked (within same session)
            if (lockHandle) {
                try {
                    this.logger?.warn?.('Unlocking class during error cleanup');
                    await (0, unlock_1.unlockClass)(this.connection, config.className, lockHandle);
                }
                catch (unlockError) {
                    this.logger?.warn?.('Failed to unlock during cleanup:', (0, internalUtils_1.safeErrorMessage)(unlockError));
                }
            }
            throw error;
        }
        finally {
            // Always return to stateless after the chain
            this.connection.setSessionType('stateless');
            endCriticalSection();
        }
        // Post-lock operations (stateless is fine)
        // 5. Final check
        this.logger?.info?.('Legacy update step 5: Final check');
        state.checkResult = await (0, check_1.checkClass)(this.connection, config.className, 'inactive');
        this.logger?.info?.('Final check passed');
        // 6. Activate (if requested)
        if (options?.activateOnUpdate) {
            this.logger?.info?.('Legacy update step 6: Activating class');
            const activateResult = await (0, activation_1.activateClass)(this.connection, config.className);
            state.activateResult = activateResult;
            this.logger?.info?.('Class activated, status:', activateResult.status);
            // Read with long polling to ensure object is ready after activation
            this.logger?.info?.('Read (wait for object ready after activation)');
            try {
                const readState = await this.read({ className: config.className }, 'active', { withLongPolling: true });
                if (readState) {
                    state.readResult = readState.readResult;
                }
                this.logger?.info?.('Object is ready after activation');
            }
            catch (readError) {
                this.logger?.warn?.('Read with long polling failed after activation:', (0, internalUtils_1.safeErrorMessage)(readError));
            }
        }
        return state;
    }
    async delete(config) {
        if (!config.className) {
            throw new Error('Class name is required');
        }
        const state = { errors: [] };
        let lockHandle;
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            this.logger?.info?.('Locking class for deletion');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockClass)(this.connection, config.className);
            this.logger?.info?.(`Lock obtained: ${lockHandle}`);
            this.logger?.info?.('Deleting class (direct DELETE)');
            const objectUrl = `/sap/bc/adt/oo/classes/${(0, internalUtils_1.encodeSapObjectName)(config.className).toLowerCase()}`;
            state.deleteResult = await (0, deleteLegacy_1.deleteObjectDirect)(this.connection, objectUrl, lockHandle, config.transportRequest);
            this.logger?.info?.('Class deleted');
            return state;
        }
        catch (error) {
            const e = error;
            const responseData = e.response?.data;
            const responseStatus = e.response?.status;
            this.logger?.error?.(`Delete failed: status=${responseStatus}, body=${typeof responseData === 'string' ? responseData.substring(0, 500) : JSON.stringify(responseData)?.substring(0, 500)}`);
            if (lockHandle) {
                try {
                    await (0, unlock_1.unlockClass)(this.connection, config.className, lockHandle);
                }
                catch (unlockError) {
                    this.logger?.error?.('Unlock after delete failure also failed:', (0, internalUtils_1.safeErrorMessage)(unlockError));
                }
            }
            throw error;
        }
        finally {
            this.connection.setSessionType('stateless');
            endCriticalSection();
        }
    }
}
exports.AdtClassLegacy = AdtClassLegacy;
