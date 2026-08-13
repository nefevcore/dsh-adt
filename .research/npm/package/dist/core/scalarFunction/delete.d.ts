import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IDeleteScalarFunctionParams } from './types';
export declare function checkDeletion(connection: IAbapConnection, params: IDeleteScalarFunctionParams): Promise<IAdtResponse>;
export declare function deleteScalarFunction(connection: IAbapConnection, params: IDeleteScalarFunctionParams): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map