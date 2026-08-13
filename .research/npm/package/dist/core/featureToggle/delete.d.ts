/**
 * Feature Toggle (FTG2/FT) delete operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IDeleteFeatureToggleParams } from './types';
/**
 * Low-level: Check if feature toggle can be deleted
 */
export declare function checkDeletion(connection: IAbapConnection, params: IDeleteFeatureToggleParams): Promise<IAdtResponse>;
/**
 * Low-level: Delete feature toggle
 */
export declare function deleteFeatureToggle(connection: IAbapConnection, params: IDeleteFeatureToggleParams): Promise<IAdtResponse>;
//# sourceMappingURL=delete.d.ts.map