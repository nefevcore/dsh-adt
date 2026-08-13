/**
 * Structure lock operations
 * NOTE: Caller should call connection.setSessionType("stateful") before locking
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
/**
 * Lock structure for modification
 * Returns lock handle that must be used in subsequent requests
 */
export declare function lockStructure(connection: IAbapConnection, structureName: string): Promise<string>;
//# sourceMappingURL=lock.d.ts.map