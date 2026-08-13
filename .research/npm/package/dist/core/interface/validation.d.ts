/**
 * Interface validation
 * Uses ADT validation endpoint: /sap/bc/adt/oo/validation/objectname
 * Same endpoint as class validation, but with objtype=INTF/OI
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Validate interface name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/oo/validation/objectname
 *
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <exc:exception> with message about existing object or validation failure
 */
export declare function validateInterfaceName(connection: IAbapConnection, interfaceName: string, packageName?: string, description?: string): Promise<IAdtResponse>;
//# sourceMappingURL=validation.d.ts.map