"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtInterfaceLegacy = void 0;
const criticalSection_1 = require("../../utils/criticalSection");
/**
 * AdtInterfaceLegacy - Interface handler for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides delete() to use direct DELETE instead of /sap/bc/adt/deletion/ API.
 */
const internalUtils_1 = require("../../utils/internalUtils");
const deleteLegacy_1 = require("../shared/deleteLegacy");
const AdtInterface_1 = require("./AdtInterface");
const lock_1 = require("./lock");
const unlock_1 = require("./unlock");
class AdtInterfaceLegacy extends AdtInterface_1.AdtInterface {
    async delete(config) {
        if (!config.interfaceName) {
            throw new Error('Interface name is required');
        }
        const state = { errors: [] };
        let lockHandle;
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            this.logger?.info?.('Locking interface for deletion');
            this.connection.setSessionType('stateful');
            const lockResult = await (0, lock_1.lockInterface)(this.connection, config.interfaceName);
            lockHandle = lockResult.lockHandle;
            this.logger?.info?.('Deleting interface (direct DELETE)');
            const objectUrl = `/sap/bc/adt/oo/interfaces/${(0, internalUtils_1.encodeSapObjectName)(config.interfaceName).toLowerCase()}`;
            state.deleteResult = await (0, deleteLegacy_1.deleteObjectDirect)(this.connection, objectUrl, lockHandle, config.transportRequest);
            this.logger?.info?.('Interface deleted');
            return state;
        }
        catch (error) {
            this.logger?.error?.('Delete failed:', (0, internalUtils_1.safeErrorMessage)(error));
            if (lockHandle) {
                try {
                    await (0, unlock_1.unlockInterface)(this.connection, config.interfaceName, lockHandle);
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
exports.AdtInterfaceLegacy = AdtInterfaceLegacy;
