"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtDdlLegacy = void 0;
const criticalSection_1 = require("../../utils/criticalSection");
/**
 * AdtDdlLegacy - View handler for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides delete() to use direct DELETE instead of /sap/bc/adt/deletion/ API.
 */
const internalUtils_1 = require("../../utils/internalUtils");
const deleteLegacy_1 = require("../shared/deleteLegacy");
const AdtDdl_1 = require("./AdtDdl");
const lock_1 = require("./lock");
const unlock_1 = require("./unlock");
class AdtDdlLegacy extends AdtDdl_1.AdtDdl {
    async delete(config) {
        if (!config.ddlName) {
            throw new Error('View name is required');
        }
        const state = { errors: [] };
        let lockHandle;
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            this.logger?.info?.('Locking view for deletion');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockDDLS)(this.connection, config.ddlName);
            this.logger?.info?.('Deleting view (direct DELETE)');
            const objectUrl = `/sap/bc/adt/ddic/ddl/sources/${(0, internalUtils_1.encodeSapObjectName)(config.ddlName).toLowerCase()}`;
            state.deleteResult = await (0, deleteLegacy_1.deleteObjectDirect)(this.connection, objectUrl, lockHandle, config.transportRequest);
            this.logger?.info?.('View deleted');
            return state;
        }
        catch (error) {
            this.logger?.error?.('Delete failed:', (0, internalUtils_1.safeErrorMessage)(error));
            if (lockHandle) {
                try {
                    await (0, unlock_1.unlockDDLS)(this.connection, config.ddlName, lockHandle);
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
exports.AdtDdlLegacy = AdtDdlLegacy;
