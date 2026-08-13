/**
 * Discovery-based endpoint availability checking
 *
 * Utilities for parsing /sap/bc/adt/discovery and determining
 * which ADT endpoints a system supports.
 *
 * The main library uses isModernAdtSystem() to auto-detect and
 * AdtClientLegacy has hardcoded stubs for known-unsupported types.
 * These utilities are for consumers who want manual checking.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
/**
 * Fetch /sap/bc/adt/discovery and extract all collection href paths.
 *
 * @returns Set of endpoint paths available on the system
 */
export declare function fetchDiscoveryEndpoints(connection: IAbapConnection): Promise<Set<string>>;
/**
 * Check if a specific endpoint path is available in the discovery set.
 * Supports prefix matching — e.g., '/sap/bc/adt/ddic/domains' matches
 * if the discovery contains '/sap/bc/adt/ddic/domains' or any sub-path.
 */
export declare function isEndpointInDiscovery(endpoints: Set<string>, path: string): boolean;
//# sourceMappingURL=discoveryEndpoints.d.ts.map