/**
 * DataElement check operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { type CheckRunVersion } from '../../utils/checkRun';
/**
 * Check data element syntax
 *
 * @param connection - SAP connection
 * @param dataElementName - Data element name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param xmlContent - Optional XML content to validate (same format as PUT body). If provided, check validates this content instead of saved version.
 * @returns Check result with errors/warnings
 *
 * Note: For DDIC objects like data elements, check may not be fully supported in all SAP systems.
 * If check fails with "importing from database" error, it's often safe to skip.
 * When xmlContent is provided, it should be the same XML that will be sent in PUT request.
 */
export declare function checkDataElement(connection: IAbapConnection, dataElementName: string, version?: CheckRunVersion, xmlContent?: string): Promise<IAdtResponse>;
//# sourceMappingURL=check.d.ts.map