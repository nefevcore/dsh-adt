/**
 * AppendStructure create operations - Low-level functions
 * Metadata-only POST with base_structure template; source via update().
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { ICreateAppendStructureParams } from './types';
export declare function create(connection: IAbapConnection, args: ICreateAppendStructureParams): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map