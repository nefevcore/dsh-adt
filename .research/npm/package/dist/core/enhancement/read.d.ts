/**
 * Enhancement read operations
 */
import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
import { type EnhancementType } from './types';
/**
 * Get enhancement metadata (without source code)
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type (enhoxh, enhoxhb, enhoxhh, enhsxs, enhsxsb)
 * @param enhancementName - Enhancement name
 * @param options - Optional parameters including withLongPolling
 * @returns Axios response with enhancement metadata XML
 */
export declare function getEnhancementMetadata(connection: IAbapConnection, enhancementType: EnhancementType, enhancementName: string, options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
/**
 * Get enhancement source code
 * Only available for enhoxhh (Source Code Plugin) type
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type (should be enhoxhh for source code)
 * @param enhancementName - Enhancement name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 * @param options - Optional parameters including withLongPolling
 * @returns Axios response with source code as text/plain
 */
export declare function getEnhancementSource(connection: IAbapConnection, enhancementType: EnhancementType, enhancementName: string, version?: 'active' | 'inactive', options?: IReadOptions, logger?: ILogger): Promise<IAdtResponse>;
/**
 * Get transport request for enhancement
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type
 * @param enhancementName - Enhancement name
 * @param options - Optional parameters including withLongPolling
 * @returns Transport request information
 */
export declare function getEnhancementTransport(connection: IAbapConnection, enhancementType: EnhancementType, enhancementName: string, options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map