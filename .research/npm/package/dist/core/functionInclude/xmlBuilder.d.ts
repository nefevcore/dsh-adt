/**
 * Shared XML helpers for function include (FUGR/I) metadata payloads.
 *
 * Create and update share the same root element and differ only in whether
 * the URL carries a lockHandle, so the XML builder is shared.
 *
 * Note: language / masterLanguage / masterSystem / responsible are inherited
 * from the parent function group and must NOT appear in the include payload.
 */
import type { ICreateFunctionIncludeParams } from './types';
/**
 * Build metadata XML body for create (POST) and update (PUT).
 * The parent group is referenced via adtcore:containerRef (NOT packageRef).
 */
export declare function buildFunctionIncludeXml(args: ICreateFunctionIncludeParams): string;
//# sourceMappingURL=xmlBuilder.d.ts.map