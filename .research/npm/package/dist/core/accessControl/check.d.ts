import type { IAbapConnection, IAdtResponse, ILogger } from '@mcp-abap-adt/interfaces';
import { type CheckRunVersion } from '../../utils/checkRun';
/**
 * Check access control syntax
 *
 * Retries once on transient `status='notProcessed'` with empty errors —
 * observed on cloud trial under full-suite load, where the CHECK reporter
 * occasionally returns has_errors=true without findings because async
 * validation has not materialized yet (#20). After the retry, if the state
 * persists with no real errors, downgrade to a warning and return the
 * response instead of throwing with an empty message.
 */
export declare function checkAccessControl(connection: IAbapConnection, accessControlName: string, version?: CheckRunVersion, sourceCode?: string, logger?: ILogger): Promise<IAdtResponse>;
//# sourceMappingURL=check.d.ts.map