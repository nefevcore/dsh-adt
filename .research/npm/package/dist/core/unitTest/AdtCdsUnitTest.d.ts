/**
 * AdtCdsUnitTest - High-level CRUD operations for CDS Unit Test objects
 *
 * Extends AdtUnitTest with CDS-specific functionality:
 * - Checks CDS view availability for unit test doubles
 * - Creates test classes with CDS templates
 * - Manages test class lifecycle (create, update, delete)
 * - Runs unit tests for CDS views
 *
 * Uses AdtClass for test class lifecycle operations and AdtUnitTest for test execution.
 */
import type { IAbapConnection, IAdtCdsTestRunnable, ICdsUnitTestConfig, ICdsUnitTestState, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtDdl } from '../ddl/AdtDdl';
import { AdtUnitTest } from './AdtUnitTest';
import type { IClassUnitTestDefinition, IClassUnitTestRunOptions } from './types';
export type { ICdsUnitTestConfig, ICdsUnitTestState, } from '@mcp-abap-adt/interfaces';
/**
 * AdtCdsUnitTest - CDS-specific unit test operations
 *
 * Combines AdtClass for test class lifecycle and AdtUnitTest for test execution
 */
export declare class AdtCdsUnitTest extends AdtUnitTest implements IAdtCdsTestRunnable {
    protected adtView: AdtDdl;
    private cdsViewName?;
    private className?;
    constructor(connection: IAbapConnection, logger?: ILogger);
    /**
     * Check CDS view availability for unit test doubles
     * This check is required before creating a CDS unit test class.
     *
     * Unlike validate() (which checks name/params before create), this checks whether
     * a CDS view can be used with the test doubles framework (cl_cds_test_environment).
     */
    checkCdsTestDoubles(cdsViewName: string): Promise<ICdsUnitTestState>;
    /**
     * Override: Create test class with CDS template and test class source
     * For CDS: creates a global minimal class and adds local test class to it
     * If className and classTemplate are provided, creates test class; otherwise uses parent's create for test run
     */
    create(config: ICdsUnitTestConfig, options?: import('@mcp-abap-adt/interfaces').IAdtOperationOptions): Promise<ICdsUnitTestState>;
    /**
     * Override: Update test class source
     * If className and testClassSource are provided, updates test class; otherwise uses parent's update
     */
    update(config: Partial<ICdsUnitTestConfig>, options?: import('@mcp-abap-adt/interfaces').IAdtOperationOptions): Promise<ICdsUnitTestState>;
    /**
     * Override: Delete test class
     * If className is provided, deletes test class; otherwise uses parent's delete
     * For CDS: deletes the entire global class (not just the local test class)
     */
    delete(config: Partial<ICdsUnitTestConfig>): Promise<ICdsUnitTestState>;
    /**
     * Override: Run unit tests
     * For CDS: if className is provided, runs tests for that class by object name
     * Otherwise, uses parent's run method with tests array
     */
    run(testsOrClassName: IClassUnitTestDefinition[] | string, options?: IClassUnitTestRunOptions): Promise<string>;
    /**
     * Get test class name
     */
    getClassName(): string | undefined;
    /**
     * Get CDS view name
     */
    getCdsViewName(): string | undefined;
}
//# sourceMappingURL=AdtCdsUnitTest.d.ts.map