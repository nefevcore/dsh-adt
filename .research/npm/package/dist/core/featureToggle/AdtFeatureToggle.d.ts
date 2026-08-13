/**
 * AdtFeatureToggle - High-level CRUD + lifecycle + runtime operations for
 * Feature Toggle (FTG2/FT) objects.
 *
 * Implements IFeatureToggleObject which extends IAdtObject with five
 * domain methods: switchOn, switchOff, getRuntimeState, checkState, readSource.
 *
 * Session management mirrors AdtAuthorizationField:
 * - stateful: only during lock / unlock
 * - stateless: obligatory after unlock and in error cleanup
 *
 * Source handling is JSON (IFeatureToggleSource), uploaded via
 * uploadFeatureToggleSource which stringifies internally.
 *
 * Operation chains:
 * - Create: create (+ optional source upload: lock → upload → unlock → activate)
 * - Update: lock → check(inactive, xmlContent?) → update → [uploadSource?] →
 *           read(longPolling) → unlock → check(inactive) → activate(optional) + read
 * - Delete: check(deletion) → delete
 */
import type { IAbapConnection, IAdtOperationOptions, ILogger, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { type LockRegistry } from '../shared/LockRegistry';
import type { IFeatureToggleConfig, IFeatureToggleObject, IFeatureToggleState } from './types';
export declare class AdtFeatureToggle implements IFeatureToggleObject {
    private readonly connection;
    private readonly logger?;
    private readonly systemContext;
    private readonly lockTracker;
    readonly objectType: string;
    constructor(connection: IAbapConnection, logger?: ILogger, systemContext?: IAdtSystemContext, lockRegistry?: LockRegistry);
    /**
     * Map camelCase config to the snake_case low-level params.
     * `source` is passed through unchanged (it is a structured JSON object,
     * not a snake_case DTO).
     */
    private buildCreateParams;
    private buildDeleteParams;
    /**
     * Validate feature toggle name against SAP naming rules.
     */
    validate(config: Partial<IFeatureToggleConfig>): Promise<IFeatureToggleState>;
    /**
     * Create feature toggle. If config.source is provided, follows up with a
     * source-upload sub-chain (lock → upload → unlock → activate).
     */
    create(config: IFeatureToggleConfig, options?: IAdtOperationOptions): Promise<IFeatureToggleState>;
    /**
     * Read feature toggle metadata XML.
     */
    read(config: Partial<IFeatureToggleConfig>, version?: 'active' | 'inactive', options?: {
        withLongPolling?: boolean;
    }): Promise<IFeatureToggleState | undefined>;
    /**
     * Read metadata — feature-toggle GET returns the full metadata XML,
     * so this delegates to read().
     */
    readMetadata(config: Partial<IFeatureToggleConfig>, options?: {
        withLongPolling?: boolean;
        version?: 'active' | 'inactive';
    }): Promise<IFeatureToggleState>;
    /**
     * Update feature toggle with full operation chain.
     * When config.source is provided, uploads JSON source after metadata PUT.
     */
    update(config: Partial<IFeatureToggleConfig>, options?: IAdtOperationOptions): Promise<IFeatureToggleState>;
    /**
     * Delete feature toggle.
     */
    delete(config: Partial<IFeatureToggleConfig>): Promise<IFeatureToggleState>;
    /**
     * Activate feature toggle.
     */
    activate(config: Partial<IFeatureToggleConfig>): Promise<IFeatureToggleState>;
    /**
     * Check feature toggle.
     */
    check(config: Partial<IFeatureToggleConfig>, status?: string): Promise<IFeatureToggleState>;
    /**
     * Read transport info — not supported for feature toggles.
     */
    readTransport(_config: Partial<IFeatureToggleConfig>, _options?: {
        withLongPolling?: boolean;
    }): Promise<IFeatureToggleState>;
    /**
     * Lock feature toggle for modification.
     */
    lock(config: Partial<IFeatureToggleConfig>): Promise<string>;
    /**
     * Unlock feature toggle.
     */
    unlock(config: Partial<IFeatureToggleConfig>, lockHandle: string): Promise<IFeatureToggleState>;
    switchOn(config: Partial<IFeatureToggleConfig>, opts: {
        transportRequest: string;
        userSpecific?: boolean;
    }): Promise<IFeatureToggleState>;
    switchOff(config: Partial<IFeatureToggleConfig>, opts: {
        transportRequest: string;
        userSpecific?: boolean;
    }): Promise<IFeatureToggleState>;
    private switchTo;
    getRuntimeState(config: Partial<IFeatureToggleConfig>): Promise<IFeatureToggleState>;
    checkState(config: Partial<IFeatureToggleConfig>, opts?: {
        userSpecific?: boolean;
    }): Promise<IFeatureToggleState>;
    readSource(config: Partial<IFeatureToggleConfig>, version?: 'active' | 'inactive'): Promise<IFeatureToggleState>;
    private requireName;
    getVersions(_config: Partial<IFeatureToggleConfig>): Promise<IObjectVersion[]>;
    getVersionSource(_contentUri: string): Promise<string>;
}
//# sourceMappingURL=AdtFeatureToggle.d.ts.map