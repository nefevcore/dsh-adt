/**
 * Runtime Dumps (ABAP Short Dump Analysis)
 *
 * Provides functions for reading ABAP runtime dumps via ADT endpoints:
 * - List dumps feed with paging/query options
 * - List dumps by user
 * - Read dump by ID (default/summary/formatted view)
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
export interface IRuntimeDumpsListOptions {
    query?: string;
    inlinecount?: 'allpages' | 'none';
    top?: number;
    skip?: number;
    orderby?: string;
    from?: string;
    to?: string;
}
export type IRuntimeDumpReadView = 'default' | 'summary' | 'formatted';
export interface IRuntimeDumpReadOptions {
    view?: IRuntimeDumpReadView;
}
/**
 * Build a runtime dump ID prefix from its known components.
 *
 * The full dump ID is a compound key: `{datetime}{hostname}_{sysid}_{instance}{user}{client}{seq}`.
 * All fields except `seq` are typically available from external sources (e.g. CALM events).
 * Use this prefix with `from`/`to` time-range filtering to locate the exact dump entry.
 *
 * @example buildDumpIdPrefix('20260331215347', 'epbyminsd0654', 'E19', '00')
 *          // => '20260331215347epbyminsd0654_E19_00'
 */
export declare function buildDumpIdPrefix(datetime: string, hostname: string, sysid: string, instance: string): string;
/**
 * Build ADT runtime dumps query expression for user filtering.
 *
 * @example and( equals( user, CB9980000423 ) )
 */
export declare function buildRuntimeDumpsUserQuery(user?: string): string | undefined;
/**
 * List runtime dumps feed.
 */
export declare function listRuntimeDumps(connection: IAbapConnection, options?: IRuntimeDumpsListOptions): Promise<IAdtResponse>;
/**
 * List runtime dumps filtered by user.
 */
export declare function listRuntimeDumpsByUser(connection: IAbapConnection, user?: string, options?: Omit<IRuntimeDumpsListOptions, 'query'>): Promise<IAdtResponse>;
/**
 * Read a specific runtime dump by its dump ID.
 */
export declare function getRuntimeDumpById(connection: IAbapConnection, dumpId: string, options?: IRuntimeDumpReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map