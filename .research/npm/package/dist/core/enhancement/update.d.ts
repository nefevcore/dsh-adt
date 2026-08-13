/**
 * Enhancement update operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import { type EnhancementType, type IUpdateEnhancementParams } from './types';
/**
 * Low-level: Update enhancement source code (PUT)
 * Only available for enhoxhh (Source Code Plugin) type
 *
 * NOTE: Object must be locked before calling this function
 *
 * @param connection - SAP connection
 * @param args - Update parameters
 * @returns Axios response
 */
export declare function update(connection: IAbapConnection, args: IUpdateEnhancementParams, logger?: ILogger): Promise<IAdtResponse>;
/**
 * Convenience function: Update enhancement with simpler signature
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type
 * @param enhancementName - Enhancement name
 * @param sourceCode - New source code
 * @param lockHandle - Lock handle
 * @param transportRequest - Optional transport request
 * @returns Axios response
 */
export declare function updateEnhancement(connection: IAbapConnection, enhancementType: EnhancementType, enhancementName: string, sourceCode: string, lockHandle: string, transportRequest?: string, logger?: ILogger): Promise<IAdtResponse>;
//# sourceMappingURL=update.d.ts.map