/**
 * Virtual folders operations for ABAP objects
 *
 * Retrieves hierarchical virtual folder contents from ADT information system.
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import type { IGetVirtualFoldersContentsParams } from './types';
/**
 * Fetch virtual folder contents for hierarchical browsing.
 *
 * Endpoint: POST /sap/bc/adt/repository/informationsystem/virtualfolders/contents
 */
export declare function getVirtualFoldersContents(connection: IAbapConnection, params: IGetVirtualFoldersContentsParams): Promise<IAdtResponse>;
//# sourceMappingURL=virtualFolders.d.ts.map