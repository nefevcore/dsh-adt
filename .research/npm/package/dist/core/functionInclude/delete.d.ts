/**
 * FunctionInclude (FUGR/I) delete operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
export interface IDeleteFunctionIncludeParams {
    function_group_name: string;
    include_name: string;
    transport_request?: string;
}
/**
 * Low-level: Check if function include can be deleted.
 */
export declare function checkDeletion(connection: IAbapConnection, params: IDeleteFunctionIncludeParams): Promise<IAdtResponse>;
/**
 * Low-level: Delete function include.
 */
export declare function deleteFunctionInclude(connection: IAbapConnection, params: IDeleteFunctionIncludeParams): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map