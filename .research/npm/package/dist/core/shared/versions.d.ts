import { type IObjectVersion } from '@mcp-abap-adt/interfaces';
/** Parse an ADT versions Atom feed into a list of versions. Pure — no endpoints. */
export declare function parseVersionsFeed(xml: string): IObjectVersion[];
/** Throw a typed "no version history" error. Used by non-source types and by
 *  source types when SAP reports the versions resource is absent (404/406). */
export declare function throwUnsupportedVersions(detail?: string): never;
/** Translate ANY version-request failure into an interface-level error so no
 *  raw IAdtResponse/axios object ever leaks outward. 404/406 → unsupported;
 *  everything else → AdtOperationError carrying status + originalError.
 *  Call this from the catch of every version list/content GET. */
export declare function throwVersionsError(error: unknown, detail: string): never;
//# sourceMappingURL=versions.d.ts.map