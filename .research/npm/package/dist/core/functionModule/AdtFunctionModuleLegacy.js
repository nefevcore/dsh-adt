"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtFunctionModuleLegacy = void 0;
const criticalSection_1 = require("../../utils/criticalSection");
/**
 * AdtFunctionModuleLegacy - FunctionModule handler for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides delete() to use direct DELETE instead of /sap/bc/adt/deletion/ API.
 */
const internalUtils_1 = require("../../utils/internalUtils");
const deleteLegacy_1 = require("../shared/deleteLegacy");
const AdtFunctionModule_1 = require("./AdtFunctionModule");
const lock_1 = require("./lock");
const unlock_1 = require("./unlock");
class AdtFunctionModuleLegacy extends AdtFunctionModule_1.AdtFunctionModule {
    async delete(config) {
        if (!config.functionModuleName) {
            throw new Error('Function module name is required');
        }
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        const state = { errors: [] };
        let lockHandle;
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            this.logger?.info?.('Locking function module for deletion');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockFunctionModule)(this.connection, config.functionModuleName, config.functionGroupName);
            this.logger?.info?.('Deleting function module (direct DELETE)');
            const encodedGroup = (0, internalUtils_1.encodeSapObjectName)(config.functionGroupName).toLowerCase();
            const encodedModule = (0, internalUtils_1.encodeSapObjectName)(config.functionModuleName).toLowerCase();
            const objectUrl = `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedModule}`;
            state.deleteResult = await (0, deleteLegacy_1.deleteObjectDirect)(this.connection, objectUrl, lockHandle, config.transportRequest);
            this.logger?.info?.('Function module deleted');
            return state;
        }
        catch (error) {
            this.logger?.error?.('Delete failed:', (0, internalUtils_1.safeErrorMessage)(error));
            if (lockHandle) {
                try {
                    await (0, unlock_1.unlockFunctionModule)(this.connection, config.functionModuleName, config.functionGroupName, lockHandle);
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
exports.AdtFunctionModuleLegacy = AdtFunctionModuleLegacy;
