/**
 * DataElement unlock operations
 * NOTE: Caller should call connection.setSessionType("stateless") after unlocking
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Unlock data element
 * Must use same session and lock handle from lock operation
 */
export declare function unlockDataElement(connection: IAbapConnection, dataElementName: string, lockHandle: string): Promise<IAdtResponse>;
//# sourceMappingURL=unlock.d.ts.map