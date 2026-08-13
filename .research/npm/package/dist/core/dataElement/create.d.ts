/**
 * DataElement create operations - Low-level functions
 * NOTE: Caller should call connection.setSessionType("stateful") before creating
 *
 * Create sends minimal XML (root element + packageRef only).
 * Type details (typeKind, labels, etc.) are set via update after creation,
 * matching Eclipse ADT behavior.
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { ICreateDataElementParams } from './types';
/**
 * Low-level: Create data element (POST)
 * Does NOT activate - just creates the object with minimal metadata.
 * Type information and labels should be set via updateDataElement() afterwards.
 */
export declare function create(connection: IAbapConnection, args: ICreateDataElementParams): Promise<IAdtResponse>;
//# sourceMappingURL=create.d.ts.map