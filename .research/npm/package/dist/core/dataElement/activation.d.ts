/**
 * DataElement activation operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Parse activation response
 */
/**
 * Activate data element
 * Makes data element active and usable in SAP system
 */
export declare function activateDataElement(connection: IAbapConnection, dataElementName: string): Promise<IAdtResponse>;
//# sourceMappingURL=activation.d.ts.map