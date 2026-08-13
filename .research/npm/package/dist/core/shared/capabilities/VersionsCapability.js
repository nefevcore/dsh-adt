"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionsCapability = void 0;
/**
 * Shared version history for source-backed objects. Types without a
 * /source/main resource do NOT compose this capability and do not implement
 * IAdtVersionable — absence is expressed structurally, not by throwing.
 */
class VersionsCapability {
    getCtx;
    strategy;
    constructor(
    // LAZY: see LockCapability — read at call time so it can be a class field.
    getCtx, strategy) {
        this.getCtx = getCtx;
        this.strategy = strategy;
    }
    getVersions(config) {
        const name = this.strategy.nameOf(config);
        return this.strategy.list(this.getCtx(), name);
    }
    getVersionSource(contentUri) {
        return this.strategy.source(this.getCtx(), contentUri);
    }
}
exports.VersionsCapability = VersionsCapability;
