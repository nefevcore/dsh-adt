"use strict";
/**
 * AdtPackageLegacy - Package handler for legacy SAP systems (BASIS < 7.50)
 *
 * All package operations are blocked on legacy — the /sap/bc/adt/packages
 * endpoint exists in discovery but does not return usable results via RFC.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtPackageLegacy = void 0;
const AdtPackage_1 = require("./AdtPackage");
const UNSUPPORTED_MSG = 'Package operations are not supported on legacy SAP systems (BASIS < 7.50) via ADT. ' +
    'Use SAP GUI (SE80 or SE21) to manage packages.';
class AdtPackageLegacy extends AdtPackage_1.AdtPackage {
    async create() {
        throw new Error(UNSUPPORTED_MSG);
    }
    async read() {
        throw new Error(UNSUPPORTED_MSG);
    }
    async readMetadata() {
        throw new Error(UNSUPPORTED_MSG);
    }
    async validate() {
        throw new Error(UNSUPPORTED_MSG);
    }
    async update() {
        throw new Error(UNSUPPORTED_MSG);
    }
    async delete(_config) {
        throw new Error(UNSUPPORTED_MSG);
    }
}
exports.AdtPackageLegacy = AdtPackageLegacy;
