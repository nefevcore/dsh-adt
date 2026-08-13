/**
 * View create operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { ICreateDdlParams } from './types';
/**
 * Create ABAP view (CDS DDLS object)
 * Low-level: Only creates the DDLS object metadata, does NOT lock/upload/activate
 * For complete workflow, use AdtDdl
 */
export declare function createDdl(connection: IAbapConnection, params: ICreateDdlParams): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map