/**
 * Class lock operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Lock class for modification
 * Returns lock handle that must be used in subsequent requests
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export declare function lockClass(connection: IAbapConnection, className: string): Promise<string>;
/**
 * Lock class for editing (for update)
 * Returns lock handle and transport number
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export declare function lockClassForUpdate(connection: IAbapConnection, className: string): Promise<{
    response: IAdtResponse;
    lockHandle: string;
    corrNr?: string;
}>;
//# sourceMappingURL=lock.d.ts.map