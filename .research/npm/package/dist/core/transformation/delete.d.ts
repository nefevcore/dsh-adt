import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IDeleteTransformationParams } from './types';
/**
 * Low-level: Check if transformation can be deleted
 */
export declare function checkDeletion(connection: IAbapConnection, params: IDeleteTransformationParams): Promise<IAdtResponse>;
/**
 * Low-level: Delete transformation
 */
export declare function deleteTransformation(connection: IAbapConnection, params: IDeleteTransformationParams): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map