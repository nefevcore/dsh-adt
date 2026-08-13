/**
 * AdtLocalDefinitions - High-level CRUD operations for Local Definitions (definitions include)
 *
 * Local definitions are type declarations needed for components in the private section.
 * All operations require the parent class to be locked.
 */
import type { IAdtOperationOptions, ILocalDefinitionsConfig, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
import { AdtClass } from './AdtClass';
import type { IClassState } from './types';
export type { ILocalDefinitionsConfig } from '@mcp-abap-adt/interfaces';
export declare class AdtLocalDefinitions extends AdtClass {
    readonly objectType: string;
    /**
     * Validate local definitions code
     */
    validate(config: Partial<ILocalDefinitionsConfig>): Promise<IClassState>;
    /**
     * Create local definitions with full operation chain
     * Requires parent class to be locked
     */
    create(config: Partial<ILocalDefinitionsConfig>, options?: IAdtOperationOptions): Promise<IClassState>;
    /**
     * Read local definitions code
     */
    read(config: Partial<ILocalDefinitionsConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IClassState | undefined>;
    /**
     * Update local definitions with full operation chain
     * Requires parent class to be locked
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<ILocalDefinitionsConfig>, options?: IAdtOperationOptions): Promise<IClassState>;
    /**
     * Delete local definitions
     * Performs update with empty code to remove the local definitions
     */
    delete(config: Partial<ILocalDefinitionsConfig>): Promise<IClassState>;
    /**
     * Activate parent class (local definitions are activated with parent class)
     */
    activate(config: Partial<ILocalDefinitionsConfig>): Promise<IClassState>;
    /**
     * Check local definitions code
     */
    check(config: Partial<ILocalDefinitionsConfig>, version?: 'active' | 'inactive'): Promise<IClassState>;
    getVersions(config: Partial<{
        className: string;
    }>): Promise<IObjectVersion[]>;
}
//# sourceMappingURL=AdtLocalDefinitions.d.ts.map