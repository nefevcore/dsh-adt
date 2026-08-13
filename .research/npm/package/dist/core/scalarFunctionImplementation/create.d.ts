/**
 * ScalarFunctionImplementation create operations - Low-level functions
 * Metadata-only POST (blues v2 + server-driven content linking to the scalar function).
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { ICreateScalarFunctionImplementationParams, ScalarFunctionEngine } from './types';
/** base64 of {"scalarFunctionName":<upper>,"engineValue":<engine>} (key order fixed). */
export declare function buildServerDrivenContent(scalarFunctionName: string, engineValue: ScalarFunctionEngine): string;
export declare function create(connection: IAbapConnection, args: ICreateScalarFunctionImplementationParams): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map