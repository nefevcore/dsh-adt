/**
 * DataElement delete operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IDeleteDataElementParams } from './types';
/**
 * Low-level: Check if data element can be deleted
 */
export declare function checkDeletion(connection: IAbapConnection, params: IDeleteDataElementParams): Promise<IAdtResponse>;
/**
 * Low-level: Delete data element
 */
export declare function deleteDataElement(connection: IAbapConnection, params: IDeleteDataElementParams): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map