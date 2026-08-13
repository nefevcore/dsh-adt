"use strict";
/**
 * Factory function that auto-detects SAP system version
 * and returns the appropriate ADT client.
 *
 * - Modern systems (BASIS >= 7.50): AdtClient with full CRUD
 * - Legacy systems (BASIS < 7.50): AdtClientLegacy with limited CRUD
 *
 * The client type depends on the system version (which ADT endpoints exist),
 * NOT on the connection type (HTTP vs RFC). Connection type is orthogonal:
 * - HTTP works for modern systems and read-only on legacy
 * - RFC works for both (and is the only way to get CRUD on legacy)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdtClient = createAdtClient;
const systemInfo_1 = require("../utils/systemInfo");
const AdtClient_1 = require("./AdtClient");
const AdtClientLegacy_1 = require("./AdtClientLegacy");
async function createAdtClient(connection, logger, options) {
    const isModern = await (0, systemInfo_1.isModernAdtSystem)(connection);
    return isModern
        ? new AdtClient_1.AdtClient(connection, logger, options)
        : new AdtClientLegacy_1.AdtClientLegacy(connection, logger, options);
}
