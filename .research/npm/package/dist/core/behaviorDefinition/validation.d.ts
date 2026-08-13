import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IBehaviorDefinitionValidationParams } from './types';
/**
 * Validate behavior definition parameters before creation
 *
 * Endpoint: POST /sap/bc/adt/bo/behaviordefinitions/validation
 *
 * @param connection - ABAP connection instance
 * @param params - Validation parameters
 * @param sessionId - Session ID for request tracking
 * @returns Axios response with validation result
 *
 * @example
 * ```typescript
 * const result = await validate(connection, {
 *   objname: 'Z_MY_BDEF',
 *   rootEntity: 'Z_MY_ENTITY',
 *   description: 'Test Behavior Definition',
 *   package: 'Z_PACKAGE',
 *   implementationType: 'Managed'
 * }, sessionId);
 *
 * // Check validation result
 * const severity = result.data.match(/<SEVERITY>([^<]+)<\/SEVERITY>/)?.[1];
 * if (severity === 'OK') {
 * }
 * ```
 */
export declare function validate(connection: IAbapConnection, params: IBehaviorDefinitionValidationParams): Promise<IAdtResponse>;
//# sourceMappingURL=validation.d.ts.map