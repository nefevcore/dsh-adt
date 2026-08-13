"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtFunctionGroupLegacy = void 0;
const criticalSection_1 = require("../../utils/criticalSection");
/**
 * AdtFunctionGroupLegacy - FunctionGroup handler for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides delete() to use direct DELETE instead of /sap/bc/adt/deletion/ API.
 */
const internalUtils_1 = require("../../utils/internalUtils");
const deleteLegacy_1 = require("../shared/deleteLegacy");
const AdtFunctionGroup_1 = require("./AdtFunctionGroup");
const lock_1 = require("./lock");
const unlock_1 = require("./unlock");
class AdtFunctionGroupLegacy extends AdtFunctionGroup_1.AdtFunctionGroup {
    async delete(config) {
        if (!config.functionGroupName) {
            throw new Error('Function group name is required');
        }
        const state = { errors: [] };
        let lockHandle;
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            this.logger?.info?.('Locking function group for deletion');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockFunctionGroup)(this.connection, config.functionGroupName);
            this.logger?.info?.('Deleting function group (direct DELETE)');
            const objectUrl = `/sap/bc/adt/functions/groups/${config.functionGroupName.toLowerCase()}`;
            state.deleteResult = await (0, deleteLegacy_1.deleteObjectDirect)(this.connection, objectUrl, lockHandle, config.transportRequest);
            this.logger?.info?.('Function group deleted');
            return state;
        }
        catch (error) {
            this.logger?.error?.('Delete failed:', (0, internalUtils_1.safeErrorMessage)(error));
            if (lockHandle) {
                try {
                    await (0, unlock_1.unlockFunctionGroup)(this.connection, config.functionGroupName, lockHandle);
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
exports.AdtFunctionGroupLegacy = AdtFunctionGroupLegacy;
