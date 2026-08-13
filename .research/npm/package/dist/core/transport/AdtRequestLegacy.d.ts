/**
 * AdtRequestLegacy - Transport request handler for legacy SAP systems (BASIS < 7.50)
 *
 * Legacy systems use /sap/bc/cts/ instead of /sap/bc/adt/cts/ for transport endpoints.
 *
 * Supported operations:
 * - read: GET /sap/bc/cts/transportrequests (returns full list, filtered client-side)
 *
 * Unsupported operations:
 * - create: Legacy CTS REST API does not support creating transport requests.
 *   The endpoint rejects all POST payloads — no useraction value is accepted.
 *   Use SE01/SE09/SE10 transaction to create transports on legacy systems.
 */
import type { IAbapConnection, IAdtOperationOptions, ILogger } from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { AdtRequest } from './AdtRequest';
import type { ITransportConfig, ITransportState } from './types';
export declare class AdtRequestLegacy extends AdtRequest {
    private readonly conn;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext);
    /**
     * Create transport request — NOT supported on legacy systems.
     *
     * Legacy CTS endpoint (/sap/bc/cts/transportrequests) does not support
     * creating transport requests via REST API. The endpoint rejects all
     * POST payloads with "user action is not supported".
     */
    create(_config: ITransportConfig, _options?: IAdtOperationOptions): Promise<ITransportState>;
    /**
     * Read transport request (legacy path).
     *
     * GET /sap/bc/cts/transportrequests returns the full transport list
     * for the current user. The response is filtered client-side.
     */
    read(config: Partial<ITransportConfig>, _version?: 'active' | 'inactive'): Promise<ITransportState | undefined>;
}
//# sourceMappingURL=AdtRequestLegacy.d.ts.map