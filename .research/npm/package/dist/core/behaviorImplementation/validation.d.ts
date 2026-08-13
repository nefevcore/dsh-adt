/**
 * Behavior Implementation validation
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Validate behavior implementation class name
 * Uses ADT validation endpoint: /sap/bc/adt/oo/validation/objectname
 *
 * @param connection - SAP connection
 * @param className - Behavior implementation class name (e.g., ZBP_OK_I_CDS_TEST)
 * @param packageName - Package name
 * @param description - Description
 * @param behaviorDefinition - Behavior definition name (root entity)
 * @returns Validation response (returns error response if object already exists)
 */
export declare function validateBehaviorImplementationName(connection: IAbapConnection, className: string, packageName?: string, description?: string, behaviorDefinition?: string): Promise<IAdtResponse>;
//# sourceMappingURL=validation.d.ts.map