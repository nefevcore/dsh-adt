/**
 * AdtRequest - High-level CRUD operations for Transport Request objects
 *
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 *
 * Uses low-level functions directly (not Builder classes).
 *
 * Session management:
 * - No stateful needed for transport operations
 * - Transport requests don't use lock/unlock
 *
 * Operation chains:
 * - Create: create (no validation, no check, no activate)
 * - Read: read (get transport request details)
 * - Update: not supported (transport requests are immutable after creation)
 * - Delete: not supported (transport requests cannot be deleted via ADT)
 * - Activate: not supported (transport requests are not activated)
 * - Check: not supported (transport requests don't have check operation)
 */
import type { IAbapConnection, IAdtObject, IAdtOperationOptions, ILogger, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import type { ITransportConfig, ITransportState } from './types';
export declare class AdtRequest implements IAdtObject<ITransportConfig, ITransportState> {
    private readonly connection;
    private readonly logger?;
    private readonly systemContext;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext);
    /**
     * Validate transport request configuration before creation
     * Note: ADT doesn't provide validation endpoint for transport requests
     */
    validate(config: Partial<ITransportConfig>): Promise<ITransportState>;
    /**
     * Create transport request
     */
    create(config: ITransportConfig, _options?: IAdtOperationOptions): Promise<ITransportState>;
    /**
     * Read transport request
     */
    read(config: Partial<ITransportConfig>, _version?: 'active' | 'inactive'): Promise<ITransportState | undefined>;
    /**
     * List transport requests
     */
    list(params: {
        user: string;
        status?: string;
        dateRange?: string;
        targetSystem?: string;
        requestType?: string;
    }): Promise<ITransportState>;
    /**
     * Read transport request metadata
     * For transport requests, read() already returns all metadata (description, owner, etc.)
     */
    readMetadata(config: Partial<ITransportConfig>): Promise<ITransportState>;
    /**
     * Update transport request
     * Note: Transport requests are immutable after creation in ADT
     */
    update(_config: Partial<ITransportConfig>, _options?: IAdtOperationOptions): Promise<ITransportState>;
    /**
     * Delete transport request
     * Note: Transport requests cannot be deleted via ADT
     */
    delete(_config: Partial<ITransportConfig>): Promise<ITransportState>;
    /**
     * Activate transport request
     * Note: Transport requests are not activated (they are containers for objects)
     */
    activate(_config: Partial<ITransportConfig>): Promise<ITransportState>;
    /**
     * Check transport request
     * Note: Transport requests don't have check operation
     */
    check(_config: Partial<ITransportConfig>, _status?: string): Promise<ITransportState>;
    /**
     * Read transport request information for the class
     */
    readTransport(_config: Partial<ITransportConfig>): Promise<ITransportState>;
    /**
     * Lock transport request (not supported)
     */
    lock(_config: Partial<ITransportConfig>): Promise<string>;
    /**
     * Unlock transport request (not supported)
     */
    unlock(_config: Partial<ITransportConfig>, _lockHandle: string): Promise<ITransportState>;
    getVersions(_config: Partial<ITransportConfig>): Promise<IObjectVersion[]>;
    getVersionSource(_contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtRequest.d.ts.map