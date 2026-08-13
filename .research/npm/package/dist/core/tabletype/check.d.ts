import type { CheckRunVersion } from '../../utils/checkRun';
/**
 * TableType check operations
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
/**
 * Run check run for table type
 * Note: This is a table type-specific check function. For generic check, use runCheckRun from shared/checkRun
 *
 * @param connection - ABAP connection
 * @param reporter - Check reporter type
 * @param tableTypeName - Table type name to check
 * @param sourceCode - Optional DDL source code to validate (for checking unsaved/new code)
 * @param version - Version to check ('active', 'inactive', or 'new'). Default: 'new'
 * @returns Check result with errors/warnings
 */
export declare function runTableTypeCheckRun(connection: IAbapConnection, reporter: 'tableStatusCheck' | 'abapCheckRun', tableTypeName: string, sourceCode?: string, version?: CheckRunVersion): Promise<IAdtResponse>;
//# sourceMappingURL=check.d.ts.map