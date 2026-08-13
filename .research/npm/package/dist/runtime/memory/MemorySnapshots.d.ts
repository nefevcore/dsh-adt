import type { IAbapConnection, IAdtResponse, ILogger, IMemorySnapshots, IMemorySnapshotsListOptions, ISnapshotChildrenOptions, ISnapshotRankingListOptions, ISnapshotReferencesOptions } from '@mcp-abap-adt/interfaces';
export declare class MemorySnapshots implements IMemorySnapshots {
    private readonly connection;
    private readonly logger;
    readonly kind: "memorySnapshots";
    constructor(connection: IAbapConnection, logger: ILogger);
    list(options?: IMemorySnapshotsListOptions): Promise<IAdtResponse>;
    getById(snapshotId: string): Promise<IAdtResponse>;
    getOverview(snapshotId: string): Promise<IAdtResponse>;
    getRankingList(snapshotId: string, options?: ISnapshotRankingListOptions): Promise<IAdtResponse>;
    /**
     * Get children of a parent object in a snapshot.
     *
     * @param snapshotId - Snapshot ID
     * @param parentKey - Parent object key
     * @param options - Children query options
     */
    getChildren(snapshotId: string, parentKey: string, options?: ISnapshotChildrenOptions): Promise<IAdtResponse>;
    /**
     * Get references to an object in a snapshot.
     *
     * @param snapshotId - Snapshot ID
     * @param objectKey - Object key
     * @param options - References query options
     */
    getReferences(snapshotId: string, objectKey: string, options?: ISnapshotReferencesOptions): Promise<IAdtResponse>;
    /**
     * Get delta overview between two snapshots.
     *
     * @param uri1 - URI of first snapshot
     * @param uri2 - URI of second snapshot
     */
    getDeltaOverview(uri1: string, uri2: string): Promise<IAdtResponse>;
    /**
     * Get delta ranking list between two snapshots.
     *
     * @param uri1 - URI of first snapshot
     * @param uri2 - URI of second snapshot
     * @param options - Ranking list options
     */
    getDeltaRankingList(uri1: string, uri2: string, options?: ISnapshotRankingListOptions): Promise<IAdtResponse>;
    /**
     * Get delta children between two snapshots for a given parent object.
     *
     * @param uri1 - URI of first snapshot
     * @param uri2 - URI of second snapshot
     * @param parentKey - Parent object key
     * @param options - Children query options
     */
    getDeltaChildren(uri1: string, uri2: string, parentKey: string, options?: ISnapshotChildrenOptions): Promise<IAdtResponse>;
    /**
     * Get delta references between two snapshots for a given object.
     *
     * @param uri1 - URI of first snapshot
     * @param uri2 - URI of second snapshot
     * @param objectKey - Object key
     * @param options - References query options
     */
    getDeltaReferences(uri1: string, uri2: string, objectKey: string, options?: ISnapshotReferencesOptions): Promise<IAdtResponse>;
}
//# sourceMappingURL=MemorySnapshots.d.ts.map