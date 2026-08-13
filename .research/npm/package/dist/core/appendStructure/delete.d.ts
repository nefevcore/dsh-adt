import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IDeleteAppendStructureParams } from './types';
export declare function checkDeletion(connection: IAbapConnection, params: IDeleteAppendStructureParams): Promise<IAdtResponse>;
export declare function deleteAppendStructure(connection: IAbapConnection, params: IDeleteAppendStructureParams): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map