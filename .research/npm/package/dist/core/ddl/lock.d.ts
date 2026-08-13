/**
 * View lock operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Lock DDLS for modification
 */
export declare function lockDDLS(connection: IAbapConnection, ddlName: string): Promise<string>;
/**
 * Lock DDLS for editing (for update)
 */
export declare function lockDDLSForUpdate(connection: IAbapConnection, ddlName: string): Promise<{
    response: IAdtResponse;
    lockHandle: string;
    corrNr?: string;
}>;
//# sourceMappingURL=lock.d.ts.map