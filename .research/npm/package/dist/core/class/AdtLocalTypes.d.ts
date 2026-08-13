/**
 * AdtLocalTypes - High-level CRUD operations for Local Types (implementations include)
 *
 * Local types are defined in the implementations include of an ABAP class.
 * All operations require the parent class to be locked.
 */
import type { IAdtOperationOptions, ILocalTypesConfig, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
import { AdtClass } from './AdtClass';
import type { IClassState } from './types';
export type { ILocalTypesConfig } from '@mcp-abap-adt/interfaces';
export declare class AdtLocalTypes extends AdtClass {
    readonly objectType: string;
    /**
     * Validate local types code
     */
    validate(config: Partial<ILocalTypesConfig>): Promise<IClassState>;
    /**
     * Create local types with full operation chain
     * Requires parent class to be locked
     */
    create(config: Partial<ILocalTypesConfig>, options?: IAdtOperationOptions): Promise<IClassState>;
    /**
     * Read local types code
     */
    read(config: Partial<ILocalTypesConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IClassState | undefined>;
    /**
     * Update local types with full operation chain
     * Requires parent class to be locked
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<ILocalTypesConfig>, options?: IAdtOperationOptions): Promise<IClassState>;
    /**
     * Delete local types
     * Performs update with empty code to remove the local types
     */
    delete(config: Partial<ILocalTypesConfig>): Promise<IClassState>;
    /**
     * Activate parent class (local types are activated with parent class)
     */
    activate(config: Partial<ILocalTypesConfig>): Promise<IClassState>;
    /**
     * Check local types code
     */
    check(config: Partial<ILocalTypesConfig>, version?: 'active' | 'inactive'): Promise<IClassState>;
    getVersions(config: Partial<{
        className: string;
    }>): Promise<IObjectVersion[]>;
}
//# sourceMappingURL=AdtLocalTypes.d.ts.map