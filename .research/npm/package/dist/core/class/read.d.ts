/**
 * Class read operations
 */
import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
/**
 * Get ABAP class metadata (without source code)
 * @param connection - SAP connection
 * @param className - Class name
 */
export declare function getClassMetadata(connection: IAbapConnection, className: string, options?: IReadOptions): Promise<IAdtResponse>;
/**
 * Get ABAP class source code
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export declare function getClassSource(connection: IAbapConnection, className: string, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IAdtResponse>;
/**
 * Get ABAP class (source code by default for backward compatibility)
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 * @deprecated Use getClassSource() or getClassMetadata() instead
 */
export declare function getClass(connection: IAbapConnection, className: string, version?: 'active' | 'inactive'): Promise<IAdtResponse>;
/**
 * Get transport request for ABAP class
 * @param connection - SAP connection
 * @param className - Class name
 * @returns Transport request information
 */
export declare function getClassTransport(connection: IAbapConnection, className: string, options?: IReadOptions): Promise<IAdtResponse>;
/**
 * Get ABAP class definitions include (local types in private section)
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export declare function getClassDefinitionsInclude(connection: IAbapConnection, className: string, version?: 'active' | 'inactive', logger?: ILogger, options?: IReadOptions): Promise<IAdtResponse>;
/**
 * Get ABAP class macros include
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export declare function getClassMacrosInclude(connection: IAbapConnection, className: string, version?: 'active' | 'inactive', logger?: ILogger, options?: IReadOptions): Promise<IAdtResponse>;
/**
 * Get ABAP class testclasses include (local test classes)
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export declare function getClassTestClassesInclude(connection: IAbapConnection, className: string, version?: 'active' | 'inactive', logger?: ILogger, options?: IReadOptions): Promise<IAdtResponse>;
/**
 * Get ABAP class implementations include (local types, helper classes, interfaces)
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export declare function getClassImplementationsInclude(connection: IAbapConnection, className: string, version?: 'active' | 'inactive', logger?: ILogger, options?: IReadOptions): Promise<IAdtResponse>;
//# sourceMappingURL=read.d.ts.map