/**
 * DataElement update operations
 *
 * Uses read-modify-write pattern: GET current XML → patch fields → PUT.
 * This preserves all SAP-managed fields that would be lost if XML were built from scratch.
 */
import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import type { IUpdateDataElementParams } from './types';
/**
 * Get domain info to extract dataType, length, decimals
 */
export declare function getDomainInfo(connection: IAbapConnection, domainName: string): Promise<{
    dataType: string;
    length: number;
    decimals: number;
}>;
/**
 * Update data element - atomic PUT operation (read-modify-write pattern)
 * NOTE: Requires object to be locked first via lockDataElement()
 * NOTE: Caller should call connection.setSessionType("stateful") before locking
 */
export declare function updateDataElement(connection: IAbapConnection, params: IUpdateDataElementParams, lockHandle: string, logger?: ILogger): Promise<IAdtResponse>;
/**
 * @deprecated Use updateDataElement directly. Kept for backward compatibility.
 */
export declare function updateDataElementInternal(connection: IAbapConnection, args: IUpdateDataElementParams, lockHandle: string, _username: string, _domainInfo: {
    dataType: string;
    length: number;
    decimals: number;
}, logger?: ILogger): Promise<IAdtResponse>;
//# sourceMappingURL=update.d.ts.map