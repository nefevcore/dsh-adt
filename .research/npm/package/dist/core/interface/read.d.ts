/**
 * Interface read operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
/**
 * Get ABAP interface metadata (without source code)
 */
export declare function getInterfaceMetadata(connection: IAbapConnection, interfaceName: string, options?: IReadOptions): Promise<IAdtResponse>;
/**
 * Get ABAP interface source code
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export declare function getInterfaceSource(connection: IAbapConnection, interfaceName: string, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IAdtResponse>;
/**
 * Get ABAP interface (source code by default for backward compatibility)
 * @deprecated Use getInterfaceSource() or getInterfaceMetadata() instead
 */
export declare function getInterface(connection: IAbapConnection, interfaceName: string): Promise<IAdtResponse>;
/**
 * Get transport request for ABAP interface
 * @param connection - SAP connection
 * @param interfaceName - Interface name
 * @returns Transport request information
 */
export declare function getInterfaceTransport(connection: IAbapConnection, interfaceName: string, options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map