"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENHANCEMENT_TYPE_CODES = void 0;
exports.getEnhancementBaseUrl = getEnhancementBaseUrl;
exports.getEnhancementUri = getEnhancementUri;
exports.supportsSourceCode = supportsSourceCode;
exports.isImplementationType = isImplementationType;
exports.isSpotType = isSpotType;
/**
 * Enhancement object type codes for ADT
 */
exports.ENHANCEMENT_TYPE_CODES = {
    enhoxh: 'ENHO/EXH', // Enhancement Implementation
    enhoxhb: 'ENHO/EXHB', // BAdI Implementation
    enhoxhh: 'ENHO/EXHH', // Source Code Plugin
    enhsxs: 'ENHS/EXS', // Enhancement Spot
    enhsxsb: 'ENHS/EXSB', // BAdI Enhancement Spot
};
/**
 * Get ADT base URL for enhancement type
 */
function getEnhancementBaseUrl(type) {
    return `/sap/bc/adt/enhancements/${type}`;
}
/**
 * Get ADT object URI for specific enhancement
 */
function getEnhancementUri(type, name) {
    return `${getEnhancementBaseUrl(type)}/${encodeURIComponent(name.toLowerCase())}`;
}
/**
 * Check if enhancement type supports source code operations
 */
function supportsSourceCode(type) {
    return type === 'enhoxhh';
}
/**
 * Check if enhancement type is an implementation (requires enhancement spot)
 */
function isImplementationType(type) {
    return type === 'enhoxh' || type === 'enhoxhb' || type === 'enhoxhh';
}
/**
 * Check if enhancement type is a spot/definition
 */
function isSpotType(type) {
    return type === 'enhsxs' || type === 'enhsxsb';
}
