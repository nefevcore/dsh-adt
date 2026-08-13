/**
 * AdtLocalTestClass - High-level CRUD operations for Local Test Classes
 *
 * Local test classes are defined in the testclasses include of an ABAP class.
 * All operations require the parent class to be locked.
 */
import type { IAdtOperationOptions, ILocalTestClassConfig, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { IReadOptions } from '../shared/types';
import { AdtClass } from './AdtClass';
import type { IClassState } from './types';
export type { ILocalTestClassConfig } from '@mcp-abap-adt/interfaces';
export declare class AdtLocalTestClass extends AdtClass {
    readonly objectType: string;
    /**
     * Validate local test class code
     */
    validate(config: Partial<ILocalTestClassConfig>): Promise<IClassState>;
    /**
     * Create local test class with full operation chain
     * Requires parent class to be locked
     */
    create(config: Partial<ILocalTestClassConfig>, options?: IAdtOperationOptions): Promise<IClassState>;
    /**
     * Read local test class code
     */
    read(config: Partial<ILocalTestClassConfig>, version?: 'active' | 'inactive', options?: IReadOptions): Promise<IClassState | undefined>;
    /**
     * Update local test class with full operation chain
     * Requires parent class to be locked
     * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
     */
    update(config: Partial<ILocalTestClassConfig>, options?: IAdtOperationOptions): Promise<IClassState>;
    /**
     * Delete local test class
     * Performs update with empty code to remove the test class
     */
    delete(config: Partial<ILocalTestClassConfig>): Promise<IClassState>;
    /**
     * Check local test class code
     * Override to use local test class specific check function
     */
    check(config: Partial<ILocalTestClassConfig>, status?: string): Promise<IClassState>;
    getVersions(config: Partial<{
        className: string;
    }>): Promise<IObjectVersion[]>;
}
//# sourceMappingURL=AdtLocalTestClass.d.ts.map