/**
 * Shared system information utilities
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { type IAdtContentTypes } from '../core/shared/contentTypes';
/**
 * Get system information from SAP ADT (for cloud systems)
 * Returns systemID and userName if available
 */
export declare function getSystemInformation(connection: IAbapConnection): Promise<{
    systemID?: string;
    userName?: string;
    client?: string;
    language?: string;
    userFullName?: string;
} | null>;
/**
 * Check if the system is a BTP ABAP Cloud Environment
 *
 * Detection strategy (ordered by reliability):
 * 1. URL pattern — cloud systems use *.hana.ondemand.com or *.abap.*.hana.ondemand.com
 * 2. HTTP with explicit port — almost always on-premise
 * 3. Fallback to systeminformation endpoint check
 */
export declare function isCloudEnvironment(connection: IAbapConnection): Promise<boolean>;
/**
 * Check if the system supports modern ADT endpoints (core/discovery).
 *
 * Modern systems (S/4 HANA, BTP) expose /sap/bc/adt/core/discovery.
 * Older systems (BASIS 7.40 and below) only have /sap/bc/adt/discovery.
 */
export declare function isModernAdtSystem(connection: IAbapConnection): Promise<boolean>;
/**
 * Resolve the appropriate content types for the connected SAP system.
 *
 * Uses /sap/bc/adt/core/discovery to detect modern systems:
 * - Available → AdtContentTypesModern (v2+ headers)
 * - Not available → AdtContentTypesBase (v1 headers, universal)
 */
export declare function resolveContentTypes(connection: IAbapConnection): Promise<IAdtContentTypes>;
//# sourceMappingURL=systemInfo.d.ts.map