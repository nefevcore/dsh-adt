/**
 * XML builder for feature-toggle metadata.
 *
 * The metadata payload is the `blue:blueSource` envelope (same blues v1
 * envelope used by APS IAM auth) with adtcore attributes and a packageRef
 * child. Source body (rollout / toggledPackages / attributes) is JSON
 * handled separately by updateSource.ts.
 */
import type { ICreateFeatureToggleParams } from './types';
export declare function buildFeatureToggleXml(params: ICreateFeatureToggleParams): string;
//# sourceMappingURL=xmlBuilder.d.ts.map