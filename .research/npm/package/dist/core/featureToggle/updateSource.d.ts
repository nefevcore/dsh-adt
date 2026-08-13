import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { IFeatureToggleSource } from './types';
export declare function uploadFeatureToggleSource(connection: IAbapConnection, name: string, source: IFeatureToggleSource, lockHandle: string, transportRequest?: string): Promise<void>;
//# sourceMappingURL=updateSource.d.ts.map