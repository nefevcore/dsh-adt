/**
 * Feature Toggle check operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Check feature toggle via /sap/bc/adt/checkruns?reporters=abapCheckRun.
 *
 * When xmlContent is supplied, the request validates the unsaved payload
 * (same XML that will be PUT), attaching it as a base64 artifact. Otherwise
 * the server re-reads the object by URI and checks the persisted version.
 */
export declare function checkFeatureToggle(connection: IAbapConnection, name: string, version: 'active' | 'inactive', xmlContent?: string): Promise<IAdtResponse>;
//# sourceMappingURL=check.d.ts.map