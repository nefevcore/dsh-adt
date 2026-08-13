/**
 * Runtime Memory Analysis - Snapshots
 *
 * Provides functions for analyzing runtime memory snapshots, including:
 * - Listing and retrieving snapshots
 * - Ranking lists of objects in snapshots
 * - Getting children and references
 * - Delta comparisons between snapshots
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Options for snapshot ranking list queries
 */
export interface ISnapshotRankingListOptions {
    maxNumberOfObjects?: number;
    excludeAbapType?: string[];
    sortAscending?: boolean;
    sortByColumnName?: string;
    groupByParentType?: boolean;
}
/**
 * Options for snapshot children queries
 */
export interface ISnapshotChildrenOptions {
    maxNumberOfObjects?: number;
    sortAscending?: boolean;
    sortByColumnName?: string;
}
/**
 * Options for snapshot references queries
 */
export interface ISnapshotReferencesOptions {
    maxNumberOfReferences?: number;
}
/**
 * List memory snapshots
 *
 * @param connection - ABAP connection
 * @param user - Filter by user (optional)
 * @param originalUser - Filter by original user (optional)
 * @returns Axios response with list of snapshots
 */
export declare function listSnapshots(connection: IAbapConnection, user?: string, originalUser?: string): Promise<IAdtResponse>;
/**
 * Get specific snapshot details
 *
 * @param connection - ABAP connection
 * @param snapshotId - Snapshot ID
 * @returns Axios response with snapshot details
 */
export declare function getSnapshot(connection: IAbapConnection, snapshotId: string): Promise<IAdtResponse>;
/**
 * Get ranking list of objects in snapshot
 *
 * @param connection - ABAP connection
 * @param snapshotId - Snapshot ID
 * @param options - Ranking list options
 * @returns Axios response with ranking list
 */
export declare function getSnapshotRankingList(connection: IAbapConnection, snapshotId: string, options?: ISnapshotRankingListOptions): Promise<IAdtResponse>;
/**
 * Get delta ranking list between two snapshots
 *
 * @param connection - ABAP connection
 * @param uri1 - URI of first snapshot
 * @param uri2 - URI of second snapshot
 * @param options - Ranking list options
 * @returns Axios response with delta ranking list
 */
export declare function getSnapshotDeltaRankingList(connection: IAbapConnection, uri1: string, uri2: string, options?: ISnapshotRankingListOptions): Promise<IAdtResponse>;
/**
 * Get children of a parent object in snapshot
 *
 * @param connection - ABAP connection
 * @param snapshotId - Snapshot ID
 * @param parentKey - Parent object key
 * @param options - Children query options
 * @returns Axios response with children list
 */
export declare function getSnapshotChildren(connection: IAbapConnection, snapshotId: string, parentKey: string, options?: ISnapshotChildrenOptions): Promise<IAdtResponse>;
/**
 * Get delta children between two snapshots
 *
 * @param connection - ABAP connection
 * @param uri1 - URI of first snapshot
 * @param uri2 - URI of second snapshot
 * @param parentKey - Parent object key
 * @param options - Children query options
 * @returns Axios response with delta children list
 */
export declare function getSnapshotDeltaChildren(connection: IAbapConnection, uri1: string, uri2: string, parentKey: string, options?: ISnapshotChildrenOptions): Promise<IAdtResponse>;
/**
 * Get references to an object in snapshot
 *
 * @param connection - ABAP connection
 * @param snapshotId - Snapshot ID
 * @param objectKey - Object key
 * @param options - References query options
 * @returns Axios response with references list
 */
export declare function getSnapshotReferences(connection: IAbapConnection, snapshotId: string, objectKey: string, options?: ISnapshotReferencesOptions): Promise<IAdtResponse>;
/**
 * Get delta references between two snapshots
 *
 * @param connection - ABAP connection
 * @param uri1 - URI of first snapshot
 * @param uri2 - URI of second snapshot
 * @param objectKey - Object key
 * @param options - References query options
 * @returns Axios response with delta references list
 */
export declare function getSnapshotDeltaReferences(connection: IAbapConnection, uri1: string, uri2: string, objectKey: string, options?: ISnapshotReferencesOptions): Promise<IAdtResponse>;
/**
 * Get snapshot overview
 *
 * @param connection - ABAP connection
 * @param snapshotId - Snapshot ID
 * @returns Axios response with snapshot overview
 */
export declare function getSnapshotOverview(connection: IAbapConnection, snapshotId: string): Promise<IAdtResponse>;
/**
 * Get delta overview between two snapshots
 *
 * @param connection - ABAP connection
 * @param uri1 - URI of first snapshot
 * @param uri2 - URI of second snapshot
 * @returns Axios response with delta overview
 */
export declare function getSnapshotDeltaOverview(connection: IAbapConnection, uri1: string, uri2: string): Promise<IAdtResponse>;
//# sourceMappingURL=snapshots.d.ts.map