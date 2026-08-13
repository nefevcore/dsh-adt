/**
 * Enhancement unlock operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { type EnhancementType } from './types';
/**
 * Unlock enhancement
 * Must use same session and lock handle from lock operation
 *
 * NOTE: Caller should disable stateful session mode via connection.setSessionType("stateless")
 * after calling this function
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type (enhoxh, enhoxhb, enhoxhh, enhsxs, enhsxsb)
 * @param enhancementName - Enhancement name
 * @param lockHandle - Lock handle obtained from lockEnhancement
 * @returns Axios response
 */
export declare function unlockEnhancement(connection: IAbapConnection, enhancementType: EnhancementType, enhancementName: string, lockHandle: string): Promise<IAdtResponse>;
//# sourceMappingURL=unlock.d.ts.map