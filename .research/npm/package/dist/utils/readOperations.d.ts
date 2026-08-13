/**
 * Core read operations - private implementations
 * All read-only methods are implemented here once and reused by clients
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Get base URL from connection
 */
/**
 * Get ABAP program source code
 */
export declare function getProgram(connection: IAbapConnection, programName: string): Promise<IAdtResponse>;
/**
 * Get ABAP class source code
 */
export declare function getClass(connection: IAbapConnection, className: string): Promise<IAdtResponse>;
/**
 * Get ABAP table structure
 */
export declare function getTable(connection: IAbapConnection, tableName: string): Promise<IAdtResponse>;
/**
 * Get ABAP structure
 */
export declare function getStructure(connection: IAbapConnection, structureName: string): Promise<IAdtResponse>;
/**
 * Get ABAP domain
 */
export declare function getDomain(connection: IAbapConnection, domainName: string): Promise<IAdtResponse>;
/**
 * Get ABAP data element
 */
export declare function getDataElement(connection: IAbapConnection, dataElementName: string): Promise<IAdtResponse>;
/**
 * Get ABAP interface
 */
export declare function getInterface(connection: IAbapConnection, interfaceName: string): Promise<IAdtResponse>;
/**
 * Get ABAP function group
 */
export declare function getFunctionGroup(connection: IAbapConnection, functionGroupName: string): Promise<IAdtResponse>;
/**
 * Get ABAP function module
 */
export declare function getFunction(connection: IAbapConnection, functionName: string, functionGroup: string): Promise<IAdtResponse>;
/**
 * Get ABAP package
 */
export declare function getPackage(connection: IAbapConnection, packageName: string): Promise<IAdtResponse>;
/**
 * Get ABAP view (CDS or Classic)
 */
export declare function getDdl(connection: IAbapConnection, ddlName: string): Promise<IAdtResponse>;
/**
 * Fetches node structure from SAP ADT repository
 */
export declare function fetchNodeStructure(connection: IAbapConnection, parentName: string, parentTechName: string, parentType: string, nodeKey: string, withShortDescriptions?: boolean): Promise<IAdtResponse>;
/**
 * Get system information from SAP ADT (for cloud systems)
 * Returns systemID and userName if available
 */
export declare function getSystemInformation(connection: IAbapConnection): Promise<{
    systemID?: string;
    userName?: string;
} | null>;
//# sourceMappingURL=readOperations.d.ts.map