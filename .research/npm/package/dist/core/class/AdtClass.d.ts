/**
 * AdtClass - High-level CRUD operations for Class objects
 *
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 *
 * Uses low-level functions directly (not Builder classes).
 *
 * Session management:
 * - stateful: only when doing lock operations
 * - stateless: obligatory after unlock
 * - If no lock/unlock, no stateful needed
 *
 * Operation chains:
 * - Create: validate → create → check → lock → check(inactive) → update → unlock → check → activate
 * - Update: lock → check(inactive) → update → unlock → check → activate
 * - Delete: check(deletion) → delete
 */
import { type IAbapConnection, type IAdtOperationOptions, type IAdtResponse, type IAdtSourceObject, type ILogger, type IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import type { IAdtContentTypes } from '../shared/contentTypes';
import { type LockRegistry } from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import type { IClassConfig, IClassState } from './types';
import { type ClassIncludeType } from './versions';
export declare class AdtClass implements IAdtSourceObject<IClassConfig, IClassState> {
    protected readonly connection: IAbapConnection;
    protected readonly logger?: ILogger;
    protected readonly systemContext: IAdtSystemContext;
    protected readonly contentTypes?: IAdtContentTypes;
    private readonly lockTracker;
    readonly objectType: string;
    private readonly capCtx;
    private readonly lockCap;
    private readonly versionsCap;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, contentTypes?: IAdtContentTypes, lockRegistry?: LockRegistry);
    /**
     * Validate class configuration before creation
     */
    validate(config: Partial<IClassConfig>): Promise<IClassState>;
    /**
     * Create class with full operation chain
     */
    create(config: IClassConfig, options?: IAdtOperationOptions): Promise<IClassState>;
    /**
     * Read class
     */
    read(config: Partial<IClassConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IClassState | undefined>;
    /**
     * Read class metadata (object characteristics: package, responsible, description, etc.)
     */
    readMetadata(config: Partial<IClassConfig>, options?: IReadOptions): Promise<IClassState>;
    /**
     * Update class with full operation chain
     * Always starts with lock
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<IClassConfig>, options?: IAdtOperationOptions): Promise<IClassState>;
    /**
     * Delete class
     */
    delete(config: Partial<IClassConfig>): Promise<IClassState>;
    /**
     * Activate class
     * No stateful needed - uses same session/cookies
     */
    activate(config: Partial<IClassConfig>): Promise<IClassState>;
    /**
     * Check class
     */
    check(config: Partial<IClassConfig>, status?: string): Promise<IClassState>;
    /**
     * Lock class
     */
    lock(config: Partial<IClassConfig>): Promise<string>;
    /**
     * Unlock class
     */
    unlock(config: Partial<IClassConfig>, lockHandle: string): Promise<IClassState>;
    /**
     * Lock test classes (local classes) for modification
     * Uses parent class lock - sufficient for updating testclasses include
     */
    lockTestClasses(config: Partial<IClassConfig>): Promise<string>;
    /**
     * Unlock test classes (local classes)
     * Uses parent class unlock
     */
    unlockTestClasses(config: Partial<IClassConfig>, lockHandle: string): Promise<IAdtResponse>;
    /**
     * Check test class code (local class)
     */
    checkTestClass(config: Partial<IClassConfig> & {
        testClassCode: string;
    }, version?: 'active' | 'inactive'): Promise<IAdtResponse>;
    /**
     * Update test classes (local classes) with full operation chain
     * Always starts with lock of parent class
     */
    updateTestClasses(config: Partial<IClassConfig> & {
        testClassCode: string;
    }): Promise<IAdtResponse>;
    /**
     * Activate test classes (local classes)
     */
    activateTestClasses(config: Partial<IClassConfig> & {
        testClassName: string;
    }): Promise<IAdtResponse>;
    /**
     * Read transport request information for the class
     */
    readTransport(config: Partial<IClassConfig>, options?: {
        withLongPolling?: boolean;
    }): Promise<IClassState>;
    getVersions(config: Partial<IClassConfig>): Promise<IObjectVersion[]>;
    getVersionSource(contentUri: string): Promise<string>;
    /** Shared by local-include subclasses to target their own include. */
    protected getIncludeVersions(className: string, includeType: ClassIncludeType): Promise<IObjectVersion[]>;
}
//# sourceMappingURL=AdtClass.d.ts.map