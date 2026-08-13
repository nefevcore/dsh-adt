import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Validate DSFI name. Endpoint confirmed present in system discovery
 * (category dsfisfi/validation): POST /sap/bc/adt/ddic/dsfi/validation?objtype=dsfisfi
 */
export declare function validateScalarFunctionImplementationName(connection: IAbapConnection, name: string, description?: string): Promise<IAdtResponse>;
//# sourceMappingURL=validation.d.ts.map