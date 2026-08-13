/**
 * Shared XML helpers for authorization field (SUSO / AUTH) payloads.
 *
 * The auth envelope is `auth:authorizationField` with an inline `auth:content`
 * block. Create and update share the same root element but differ only in
 * whether the URL carries a lockHandle — so the XML builder is shared.
 */
import type { ICreateAuthorizationFieldParams } from './types';
/**
 * Build the root XML body for create/update.
 */
export declare function buildAuthorizationFieldXml(args: ICreateAuthorizationFieldParams): string;
//# sourceMappingURL=xmlBuilder.d.ts.map