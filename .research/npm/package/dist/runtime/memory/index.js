"use strict";
/**
 * Runtime Memory Analysis - Exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSnapshots = exports.getSnapshotReferences = exports.getSnapshotRankingList = exports.getSnapshotOverview = exports.getSnapshotDeltaReferences = exports.getSnapshotDeltaRankingList = exports.getSnapshotDeltaOverview = exports.getSnapshotDeltaChildren = exports.getSnapshotChildren = exports.getSnapshot = exports.MemorySnapshots = void 0;
var MemorySnapshots_1 = require("./MemorySnapshots");
Object.defineProperty(exports, "MemorySnapshots", { enumerable: true, get: function () { return MemorySnapshots_1.MemorySnapshots; } });
var snapshots_1 = require("./snapshots");
Object.defineProperty(exports, "getSnapshot", { enumerable: true, get: function () { return snapshots_1.getSnapshot; } });
Object.defineProperty(exports, "getSnapshotChildren", { enumerable: true, get: function () { return snapshots_1.getSnapshotChildren; } });
Object.defineProperty(exports, "getSnapshotDeltaChildren", { enumerable: true, get: function () { return snapshots_1.getSnapshotDeltaChildren; } });
Object.defineProperty(exports, "getSnapshotDeltaOverview", { enumerable: true, get: function () { return snapshots_1.getSnapshotDeltaOverview; } });
Object.defineProperty(exports, "getSnapshotDeltaRankingList", { enumerable: true, get: function () { return snapshots_1.getSnapshotDeltaRankingList; } });
Object.defineProperty(exports, "getSnapshotDeltaReferences", { enumerable: true, get: function () { return snapshots_1.getSnapshotDeltaReferences; } });
Object.defineProperty(exports, "getSnapshotOverview", { enumerable: true, get: function () { return snapshots_1.getSnapshotOverview; } });
Object.defineProperty(exports, "getSnapshotRankingList", { enumerable: true, get: function () { return snapshots_1.getSnapshotRankingList; } });
Object.defineProperty(exports, "getSnapshotReferences", { enumerable: true, get: function () { return snapshots_1.getSnapshotReferences; } });
Object.defineProperty(exports, "listSnapshots", { enumerable: true, get: function () { return snapshots_1.listSnapshots; } });
