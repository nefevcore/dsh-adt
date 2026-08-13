/**
 * ScalarFunction create operations - Low-level functions
 * Metadata-only POST (no source upload). Use AdtScalarFunction.update() for source.
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { ICreateScalarFunctionParams } from './types';
export declare function create(connection: IAbapConnection, args: ICreateScalarFunctionParams): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map