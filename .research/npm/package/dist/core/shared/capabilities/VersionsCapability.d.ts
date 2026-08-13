import type { IAdtVersionable, IObjectVersion } from '@mcp-abap-adt/interfaces';
import type { ICapabilityContext, IVersionsStrategy } from './types';
/**
 * Shared version history for source-backed objects. Types without a
 * /source/main resource do NOT compose this capability and do not implement
 * IAdtVersionable — absence is expressed structurally, not by throwing.
 */
export declare class VersionsCapability<TConfig> implements IAdtVersionable<TConfig> {
    private readonly getCtx;
    private readonly strategy;
    constructor(getCtx: () => ICapabilityContext, strategy: IVersionsStrategy<TConfig>);
    getVersions(config: Partial<TConfig>): Promise<IObjectVersion[]>;
    getVersionSource(contentUri: string): Promise<string>;
}
//# sourceMappingURL=VersionsCapability.d.ts.map