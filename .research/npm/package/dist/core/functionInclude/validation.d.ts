/**
 * FunctionInclude (FUGR/I) "validation".
 *
 * FUGR/I has no dedicated validation endpoint — instead, probe the parent
 * function group's existence. A 404 here tells the caller the group is
 * missing before any create/update is attempted.
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
export declare function validateFunctionIncludeName(connection: IAbapConnection, groupName: string, _includeName: string): Promise<IAdtResponse>;
//# sourceMappingURL=validation.d.ts.map