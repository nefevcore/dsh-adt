/**
 * Enhancement module type definitions
 *
 * Supports multiple enhancement types:
 * - enhoxh: Enhancement Implementation (ENHO)
 * - enhoxhb: BAdI Implementation
 * - enhoxhh: Source Code Plugin (has source code)
 * - enhsxs: Enhancement Spot (ENHS)
 * - enhsxsb: BAdI Enhancement Spot
 */
import type { EnhancementType } from '@mcp-abap-adt/interfaces';
export type { EnhancementType, IEnhancementConfig, IEnhancementMetadata, IEnhancementState, } from '@mcp-abap-adt/interfaces';
/**
 * Enhancement object type codes for ADT
 */
export declare const ENHANCEMENT_TYPE_CODES: Record<EnhancementType, string>;
/**
 * Low-level function parameters (snake_case) — defined in @mcp-abap-adt/interfaces
 */
export type { ICheckEnhancementParams, ICreateEnhancementParams, IDeleteEnhancementParams, IUpdateEnhancementParams, IValidateEnhancementParams, } from '@mcp-abap-adt/interfaces';
/**
 * Get ADT base URL for enhancement type
 */
export declare function getEnhancementBaseUrl(type: EnhancementType): string;
/**
 * Get ADT object URI for specific enhancement
 */
export declare function getEnhancementUri(type: EnhancementType, name: string): string;
/**
 * Check if enhancement type supports source code operations
 */
export declare function supportsSourceCode(type: EnhancementType): boolean;
/**
 * Check if enhancement type is an implementation (requires enhancement spot)
 */
export declare function isImplementationType(type: EnhancementType): boolean;
/**
 * Check if enhancement type is a spot/definition
 */
export declare function isSpotType(type: EnhancementType): boolean;
//# sourceMappingURL=types.d.ts.map