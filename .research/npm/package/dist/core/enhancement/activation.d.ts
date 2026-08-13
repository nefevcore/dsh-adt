/**
 * Enhancement activation operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { type EnhancementType } from './types';
/**
 * Activate enhancement
 * Makes enhancement active and usable in SAP system
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type (enhoxh, enhoxhb, enhoxhh, enhsxs, enhsxsb)
 * @param enhancementName - Enhancement name
 * @returns Axios response with activation result
 */
export declare function activateEnhancement(connection: IAbapConnection, enhancementType: EnhancementType, enhancementName: string): Promise<IAdtResponse>;
//# sourceMappingURL=activation.d.ts.map