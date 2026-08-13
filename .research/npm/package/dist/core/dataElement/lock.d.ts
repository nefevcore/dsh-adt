/**
 * DataElement lock operations
 * NOTE: Caller should call connection.setSessionType("stateful") before locking
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
/**
 * Lock data element for modification
 * Returns lock handle that must be used in subsequent requests
 */
export declare function lockDataElement(connection: IAbapConnection, dataElementName: string): Promise<string>;
//# sourceMappingURL=lock.d.ts.map