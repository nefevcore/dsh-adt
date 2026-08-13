/**
 * AdtClientLegacy - ADT Client for older SAP systems (BASIS < 7.50)
 *
 * Extends AdtClient and overrides methods that differ on legacy systems:
 * - Unsupported object types throw clear errors
 * - Supported types use legacy-compatible deletion (direct DELETE vs /deletion/delete)
 * - Content-Type defaults to v1 (AdtContentTypesBase)
 * - Transport requests use /sap/bc/cts/ instead of /sap/bc/adt/cts/
 *
 * Use createAdtClient() factory to auto-detect and instantiate.
 *
 * Unsupported types are determined by /sap/bc/adt/discovery catalog —
 * endpoints not present in legacy system discovery are blocked here.
 */
import type { IAbapConnection, IAdtCheckable, IAdtCreatable, IAdtCrud, IAdtLockable, IAdtNonVersionedObject, IAdtReadable, IAdtSourceObject, IAdtTestRunnable, IAdtTransportAware, IAdtValidatable, ILogger } from '@mcp-abap-adt/interfaces';
import type { IClassConfig, IClassState } from '../core/class';
import type { IDdlConfig, IDdlState } from '../core/ddl';
import type { IFunctionGroupConfig, IFunctionGroupState } from '../core/functionGroup';
import type { IFunctionModuleConfig, IFunctionModuleState } from '../core/functionModule';
import type { IInterfaceConfig, IInterfaceState } from '../core/interface';
import type { IPackageConfig, IPackageState } from '../core/package';
import type { IProgramConfig, IProgramState } from '../core/program';
import type { AdtUtils } from '../core/shared/AdtUtils';
import type { AdtRequest } from '../core/transport';
import type { IUnitTestConfig, IUnitTestState } from '../core/unitTest';
import { AdtClient, type IAdtClientOptions } from './AdtClient';
export declare class AdtClientLegacy extends AdtClient {
    constructor(connection: IAbapConnection, logger?: ILogger, options?: IAdtClientOptions);
    getProgram(): IAdtSourceObject<IProgramConfig, IProgramState>;
    getClass(): IAdtSourceObject<IClassConfig, IClassState>;
    getInterface(): IAdtSourceObject<IInterfaceConfig, IInterfaceState>;
    getFunctionGroup(): IAdtNonVersionedObject<IFunctionGroupConfig, IFunctionGroupState>;
    getFunctionModule(): IAdtSourceObject<IFunctionModuleConfig, IFunctionModuleState>;
    getPackage(): IAdtCrud<IPackageConfig, IPackageState> & IAdtValidatable<IPackageConfig, IPackageState> & IAdtCheckable<IPackageConfig, IPackageState> & IAdtLockable<IPackageConfig, IPackageState> & IAdtTransportAware<IPackageConfig, IPackageState>;
    getDdl(): IAdtSourceObject<IDdlConfig, IDdlState>;
    getUnitTest(): IAdtCreatable<IUnitTestConfig, IUnitTestState> & IAdtReadable<IUnitTestConfig, IUnitTestState> & IAdtValidatable<IUnitTestConfig, IUnitTestState> & IAdtTestRunnable;
    getRequest(): AdtRequest;
    getUtils(): AdtUtils;
    getCdsUnitTest(): never;
    getDomain(): never;
    getDataElement(): never;
    getStructure(): never;
    getTable(): never;
    getTableType(): never;
    getAccessControl(): never;
    getServiceDefinition(): never;
    getServiceBinding(): never;
    getService(): never;
    getBehaviorDefinition(): never;
    getBehaviorImplementation(): never;
    getMetadataExtension(): never;
    getEnhancement(): never;
}
//# sourceMappingURL=AdtClientLegacy.d.ts.map