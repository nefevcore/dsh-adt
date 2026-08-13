/**
 * Interface lock operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Lock interface for modification
 * Returns lock handle and transport number
 */
export declare function lockInterface(connection: IAbapConnection, interfaceName: string): Promise<{
    lockHandle: string;
    corrNr?: string;
}>;
/**
 * Lock interface for editing (for update)
 * Returns lock handle and transport number
 */
export declare function lockInterfaceForUpdate(connection: IAbapConnection, interfaceName: string, _sessionId: string): Promise<{
    response: IAdtResponse;
    lockHandle: string;
    corrNr?: string;
}>;
//# sourceMappingURL=lock.d.ts.map