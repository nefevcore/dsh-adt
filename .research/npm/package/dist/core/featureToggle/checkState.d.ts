import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { IFeatureToggleCheckStateResult } from './types';
export declare function checkFeatureToggleState(connection: IAbapConnection, name: string, opts?: {
    userSpecific?: boolean;
}): Promise<IFeatureToggleCheckStateResult>;
//# sourceMappingURL=checkState.d.ts.map