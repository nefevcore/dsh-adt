"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtProgramLegacy = void 0;
const criticalSection_1 = require("../../utils/criticalSection");
/**
 * AdtProgramLegacy - Program handler for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides delete() to use direct DELETE instead of /sap/bc/adt/deletion/ API.
 */
const internalUtils_1 = require("../../utils/internalUtils");
const deleteLegacy_1 = require("../shared/deleteLegacy");
const AdtProgram_1 = require("./AdtProgram");
const lock_1 = require("./lock");
const unlock_1 = require("./unlock");
class AdtProgramLegacy extends AdtProgram_1.AdtProgram {
    async delete(config) {
        if (!config.programName) {
            throw new Error('Program name is required');
        }
        const state = { errors: [] };
        let lockHandle;
        // This try is a LOCK…UNLOCK window; a timeout in the middle releases
        // the lock but leaves the work half-done.
        const endCriticalSection = (0, criticalSection_1.beginCriticalSection)(this.connection);
        try {
            this.logger?.info?.('Locking program for deletion');
            this.connection.setSessionType('stateful');
            lockHandle = await (0, lock_1.lockProgram)(this.connection, config.programName);
            this.logger?.info?.('Deleting program (direct DELETE)');
            const objectUrl = `/sap/bc/adt/programs/programs/${(0, internalUtils_1.encodeSapObjectName)(config.programName).toLowerCase()}`;
            state.deleteResult = await (0, deleteLegacy_1.deleteObjectDirect)(this.connection, objectUrl, lockHandle, config.transportRequest);
            this.logger?.info?.('Program deleted');
            return state;
        }
        catch (error) {
            this.logger?.error?.('Delete failed:', (0, internalUtils_1.safeErrorMessage)(error));
            if (lockHandle) {
                try {
                    await (0, unlock_1.unlockProgram)(this.connection, config.programName, lockHandle);
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
exports.AdtProgramLegacy = AdtProgramLegacy;
