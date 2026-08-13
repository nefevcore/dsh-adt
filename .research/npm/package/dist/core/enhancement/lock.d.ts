/**
 * Enhancement lock operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { type EnhancementType } from './types';
/**
 * Lock enhancement for modification
 * Returns lock handle that must be used in subsequent requests
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type (enhoxh, enhoxhb, enhoxhh, enhsxs, enhsxsb)
 * @param enhancementName - Enhancement name
 * @returns Lock handle string
 */
export declare function lockEnhancement(connection: IAbapConnection, enhancementType: EnhancementType, enhancementName: string): Promise<string>;
/**
 * Lock enhancement for editing (for update)
 * Returns lock handle and transport number
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type
 * @param enhancementName - Enhancement name
 * @returns Object containing response, lockHandle, and optional corrNr
 */
export declare function lockEnhancementForUpdate(connection: IAbapConnection, enhancementType: EnhancementType, enhancementName: string): Promise<{
    response: IAdtResponse;
    lockHandle: string;
    corrNr?: string;
}>;
//# sourceMappingURL=lock.d.ts.map