/**
 * DataElement read operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
/**
 * Get ABAP data element
 */
export declare function getDataElement(connection: IAbapConnection, dataElementName: string, options?: IReadOptions): Promise<IAdtResponse>;
/**
 * Get transport request for ABAP data element
 * @param connection - SAP connection
 * @param dataElementName - Data element name
 * @returns Transport request information
 */
export declare function getDataElementTransport(connection: IAbapConnection, dataElementName: string, options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map