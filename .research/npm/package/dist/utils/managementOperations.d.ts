import type { CheckRunVersion } from './checkRun';
/**
 * Core management operations - private implementations
 * All activation and check methods are implemented here once and reused by clients
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Get base URL from connection
 */
/**
 * Activate multiple ABAP objects in batch
 * Uses ADT activation/runs endpoint for batch activation
 */
export declare function activateObjectsGroup(connection: IAbapConnection, objects: Array<{
    uri: string;
    name: string;
}>, preaudit?: boolean): Promise<IAdtResponse>;
/**
 * Parse activation response to extract status and messages
 */
export declare function parseActivationResponse(responseData: unknown): {
    activated: boolean;
    checked: boolean;
    generated: boolean;
    messages: Array<{
        type: string;
        text: string;
        line?: number;
        column?: number;
    }>;
};
/**
 * Check ABAP object syntax
 * Uses shared checkRun utility for all object types
 */
export declare function checkObject(connection: IAbapConnection, name: string, type: string, version?: CheckRunVersion): Promise<IAdtResponse>;
//# sourceMappingURL=managementOperations.d.ts.map