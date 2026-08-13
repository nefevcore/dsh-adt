"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemorySnapshots = void 0;
const snapshots_1 = require("./snapshots");
class MemorySnapshots {
    connection;
    logger;
    kind = 'memorySnapshots';
    constructor(connection, logger) {
        this.connection = connection;
        this.logger = logger;
    }
    async list(options) {
        return (0, snapshots_1.listSnapshots)(this.connection, options?.user, options?.originalUser);
    }
    async getById(snapshotId) {
        return (0, snapshots_1.getSnapshot)(this.connection, snapshotId);
    }
    async getOverview(snapshotId) {
        return (0, snapshots_1.getSnapshotOverview)(this.connection, snapshotId);
    }
    async getRankingList(snapshotId, options) {
        return (0, snapshots_1.getSnapshotRankingList)(this.connection, snapshotId, options);
    }
    /**
     * Get children of a parent object in a snapshot.
     *
     * @param snapshotId - Snapshot ID
     * @param parentKey - Parent object key
     * @param options - Children query options
     */
    async getChildren(snapshotId, parentKey, options) {
        return (0, snapshots_1.getSnapshotChildren)(this.connection, snapshotId, parentKey, options);
    }
    /**
     * Get references to an object in a snapshot.
     *
     * @param snapshotId - Snapshot ID
     * @param objectKey - Object key
     * @param options - References query options
     */
    async getReferences(snapshotId, objectKey, options) {
        return (0, snapshots_1.getSnapshotReferences)(this.connection, snapshotId, objectKey, options);
    }
    /**
     * Get delta overview between two snapshots.
     *
     * @param uri1 - URI of first snapshot
     * @param uri2 - URI of second snapshot
     */
    async getDeltaOverview(uri1, uri2) {
        return (0, snapshots_1.getSnapshotDeltaOverview)(this.connection, uri1, uri2);
    }
    /**
     * Get delta ranking list between two snapshots.
     *
     * @param uri1 - URI of first snapshot
     * @param uri2 - URI of second snapshot
     * @param options - Ranking list options
     */
    async getDeltaRankingList(uri1, uri2, options) {
        return (0, snapshots_1.getSnapshotDeltaRankingList)(this.connection, uri1, uri2, options);
    }
    /**
     * Get delta children between two snapshots for a given parent object.
     *
     * @param uri1 - URI of first snapshot
     * @param uri2 - URI of second snapshot
     * @param parentKey - Parent object key
     * @param options - Children query options
     */
    async getDeltaChildren(uri1, uri2, parentKey, options) {
        return (0, snapshots_1.getSnapshotDeltaChildren)(this.connection, uri1, uri2, parentKey, options);
    }
    /**
     * Get delta references between two snapshots for a given object.
     *
     * @param uri1 - URI of first snapshot
     * @param uri2 - URI of second snapshot
     * @param objectKey - Object key
     * @param options - References query options
     */
    async getDeltaReferences(uri1, uri2, objectKey, options) {
        return (0, snapshots_1.getSnapshotDeltaReferences)(this.connection, uri1, uri2, objectKey, options);
    }
}
exports.MemorySnapshots = MemorySnapshots;
