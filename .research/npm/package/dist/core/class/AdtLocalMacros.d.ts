/**
 * AdtLocalMacros - High-level CRUD operations for Local Macros
 *
 * Local macros are defined in the macros include of an ABAP class.
 * Note: Macros are supported in older ABAP versions but not in newer ones.
 * All operations require the parent class to be locked.
 */
import type { IAdtOperationOptions, ILocalMacrosConfig, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
import { AdtClass } from './AdtClass';
import type { IClassState } from './types';
export type { ILocalMacrosConfig } from '@mcp-abap-adt/interfaces';
export declare class AdtLocalMacros extends AdtClass {
    readonly objectType: string;
    /**
     * Validate local macros code
     */
    validate(config: Partial<ILocalMacrosConfig>): Promise<IClassState>;
    /**
     * Create local macros with full operation chain
     * Requires parent class to be locked
     */
    create(config: Partial<ILocalMacrosConfig>, options?: IAdtOperationOptions): Promise<IClassState>;
    /**
     * Read local macros code
     */
    read(config: Partial<ILocalMacrosConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IClassState | undefined>;
    /**
     * Update local macros with full operation chain
     * Requires parent class to be locked
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<ILocalMacrosConfig>, options?: IAdtOperationOptions): Promise<IClassState>;
    /**
     * Delete local macros
     * Performs update with empty code to remove the local macros
     */
    delete(config: Partial<ILocalMacrosConfig>): Promise<IClassState>;
    /**
     * Activate parent class (local macros are activated with parent class)
     */
    activate(config: Partial<ILocalMacrosConfig>): Promise<IClassState>;
    /**
     * Check local macros code
     */
    check(config: Partial<ILocalMacrosConfig>, version?: 'active' | 'inactive'): Promise<IClassState>;
    getVersions(config: Partial<{
        className: string;
    }>): Promise<IObjectVersion[]>;
}
//# sourceMappingURL=AdtLocalMacros.d.ts.map