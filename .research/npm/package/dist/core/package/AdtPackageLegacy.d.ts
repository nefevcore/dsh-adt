/**
 * AdtPackageLegacy - Package handler for legacy SAP systems (BASIS < 7.50)
 *
 * All package operations are blocked on legacy — the /sap/bc/adt/packages
 * endpoint exists in discovery but does not return usable results via RFC.
 */
import { AdtPackage } from './AdtPackage';
import type { IPackageConfig, IPackageState } from './types';
export declare class AdtPackageLegacy extends AdtPackage {
    create(): Promise<IPackageState>;
    read(): Promise<IPackageState | undefined>;
    readMetadata(): Promise<IPackageState>;
    validate(): Promise<IPackageState>;
    update(): Promise<IPackageState>;
    delete(_config: Partial<IPackageConfig>): Promise<IPackageState>;
}
//# sourceMappingURL=AdtPackageLegacy.d.ts.map