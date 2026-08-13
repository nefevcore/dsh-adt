/**
 * Structure delete operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
export interface DeleteStructureParams {
    structure_name: string;
    transport_request?: string;
}
/**
 * Low-level: Check if structure can be deleted
 */
export declare function checkDeletion(connection: IAbapConnection, params: DeleteStructureParams): Promise<IAdtResponse>;
/**
 * Low-level: Delete structure
 * Note: Structures should NOT have empty transportNumber tag
 */
export declare function deleteStructure(connection: IAbapConnection, params: DeleteStructureParams): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map