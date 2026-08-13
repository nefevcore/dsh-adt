/**
 * View update operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Update view DDL source code
 * Low-level: Only uploads DDL source with lock handle, does NOT lock/unlock/activate
 * For complete workflow, use AdtDdl
 */
export declare function updateDdl(connection: IAbapConnection, ddlName: string, ddlSource: string, lockHandle: string, transportRequest?: string): Promise<IAdtResponse>;
//# sourceMappingURL=update.d.ts.map