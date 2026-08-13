/**
 * Factory function that auto-detects SAP system version
 * and returns the appropriate ADT client.
 *
 * - Modern systems (BASIS >= 7.50): AdtClient with full CRUD
 * - Legacy systems (BASIS < 7.50): AdtClientLegacy with limited CRUD
 *
 * The client type depends on the system version (which ADT endpoints exist),
 * NOT on the connection type (HTTP vs RFC). Connection type is orthogonal:
 * - HTTP works for modern systems and read-only on legacy
 * - RFC works for both (and is the only way to get CRUD on legacy)
 */
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtClient, type IAdtClientOptions } from './AdtClient';
export declare function createAdtClient(connection: IAbapConnection, logger?: ILogger, options?: IAdtClientOptions): Promise<AdtClient>;
//# sourceMappingURL=createAdtClient.d.ts.map