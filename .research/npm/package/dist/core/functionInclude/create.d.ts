/**
 * FunctionInclude (FUGR/I) create operations - Low-level functions
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { ICreateFunctionIncludeParams } from './types';
/**
 * Low-level: Create function include (POST to the parent group's includes collection).
 * Does NOT upload source / activate — just creates the include metadata.
 */
export declare function create(connection: IAbapConnection, args: ICreateFunctionIncludeParams): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map