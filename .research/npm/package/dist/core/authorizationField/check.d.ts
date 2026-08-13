/**
 * AuthorizationField (SUSO / AUTH) check operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Check authorization field via /sap/bc/adt/checkruns?reporters=abapCheckRun.
 *
 * When xmlContent is supplied, the request validates the unsaved payload
 * (same XML that will be PUT), attaching it as a base64 artifact. Otherwise
 * the server re-reads the object by URI and checks the persisted version.
 *
 * The helper runCheckRun() doesn't know the auth URI scheme, so we build
 * the payload inline for both modes.
 */
export declare function checkAuthorizationField(connection: IAbapConnection, name: string, version: 'active' | 'inactive', xmlContent?: string): Promise<IAdtResponse>;
//# sourceMappingURL=check.d.ts.map