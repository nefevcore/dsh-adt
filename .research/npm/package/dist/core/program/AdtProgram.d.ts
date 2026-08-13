/**
 * AdtProgram - High-level CRUD operations for Program objects
 *
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 *
 * Uses low-level functions directly (not Builder classes).
 *
 * Session management:
 * - stateful: only when doing lock/update/unlock operations
 * - stateless: obligatory after unlock
 * - If no lock/unlock, no stateful needed
 * - activate uses same session/cookies (no stateful needed)
 *
 * Operation chains:
 * - Create: validate → create → check → lock → check(inactive) → update → unlock → check → activate
 * - Update: lock → check(inactive) → update → unlock → check → activate
 * - Delete: check(deletion) → delete
 */
import type { IAbapConnection, IAdtOperationOptions, IAdtSourceObject, ILogger } from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import type { IAdtContentTypes } from '../shared/contentTypes';
import { type LockRegistry } from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import type { IProgramConfig, IProgramState } from './types';
export declare class AdtProgram implements IAdtSourceObject<IProgramConfig, IProgramState> {
    protected readonly connection: IAbapConnection;
    protected readonly logger?: ILogger;
    protected readonly systemContext: IAdtSystemContext;
    protected readonly contentTypes?: IAdtContentTypes;
    private readonly lockTracker;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, contentTypes?: IAdtContentTypes, lockRegistry?: LockRegistry);
    /**
     * Validate program configuration before creation
     */
    validate(config: Partial<IProgramConfig>): Promise<IProgramState>;
    /**
     * Create program with full operation chain
     */
    create(config: IProgramConfig, options?: IAdtOperationOptions): Promise<IProgramState>;
    /**
     * Read program
     */
    read(config: Partial<IProgramConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IProgramState | undefined>;
    /**
     * Read program metadata (object characteristics: package, responsible, description, etc.)
     */
    readMetadata(config: Partial<IProgramConfig>, options?: IReadOptions): Promise<IProgramState>;
    /**
     * Update program with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<IProgramConfig>, options?: IAdtOperationOptions): Promise<IProgramState>;
    /**
     * Delete program
     */
    delete(config: Partial<IProgramConfig>): Promise<IProgramState>;
    /**
     * Activate program
     * No stateful needed - uses same session/cookies
     */
    activate(config: Partial<IProgramConfig>): Promise<IProgramState>;
    /**
     * Check program
     */
    check(config: Partial<IProgramConfig>, status?: string): Promise<IProgramState>;
    /**
     * Read transport request information for the program
     */
    readTransport(config: Partial<IProgramConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<IProgramState>;
    /**
     * Lock program for modification
     */
    lock(config: Partial<IProgramConfig>): Promise<string>;
    /**
     * Unlock program
     */
    unlock(config: Partial<IProgramConfig>, lockHandle: string): Promise<IProgramState>;
    getVersions(config: Partial<IProgramConfig>): Promise<import("@mcp-abap-adt/interfaces").IObjectVersion[]>;
    getVersionSource(contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtProgram.d.ts.map