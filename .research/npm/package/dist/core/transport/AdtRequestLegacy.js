"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtRequestLegacy = void 0;
const AdtRequest_1 = require("./AdtRequest");
const readLegacy_1 = require("./readLegacy");
class AdtRequestLegacy extends AdtRequest_1.AdtRequest {
    conn;
    constructor(connection, logger, systemContext) {
        super(connection, logger, systemContext);
        this.conn = connection;
    }
    /**
     * Create transport request — NOT supported on legacy systems.
     *
     * Legacy CTS endpoint (/sap/bc/cts/transportrequests) does not support
     * creating transport requests via REST API. The endpoint rejects all
     * POST payloads with "user action is not supported".
     */
    async create(_config, _options) {
        throw new Error('Creating transport requests is not supported on legacy SAP systems (BASIS < 7.50). ' +
            'The /sap/bc/cts/transportrequests endpoint does not support create operations. ' +
            'Use SE01/SE09/SE10 transaction to create transports.');
    }
    /**
     * Read transport request (legacy path).
     *
     * GET /sap/bc/cts/transportrequests returns the full transport list
     * for the current user. The response is filtered client-side.
     */
    async read(config, _version) {
        if (!config.transportNumber) {
            throw new Error('Transport request number is required');
        }
        try {
            const response = await (0, readLegacy_1.getTransportLegacy)(this.conn, config.transportNumber);
            return {
                transportNumber: config.transportNumber,
                readResult: response,
                errors: [],
            };
        }
        catch (error) {
            const e = error;
            if (e.response?.status === 404) {
                return undefined;
            }
            throw error;
        }
    }
}
exports.AdtRequestLegacy = AdtRequestLegacy;
