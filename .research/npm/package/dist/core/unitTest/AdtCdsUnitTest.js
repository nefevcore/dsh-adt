"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdtCdsUnitTest = void 0;
const internalUtils_1 = require("../../utils/internalUtils");
const run_1 = require("../class/run");
const AdtDdl_1 = require("../ddl/AdtDdl");
const AdtUnitTest_1 = require("./AdtUnitTest");
const checkCdsTestDoublesAvailability_1 = require("./checkCdsTestDoublesAvailability");
/**
 * AdtCdsUnitTest - CDS-specific unit test operations
 *
 * Combines AdtClass for test class lifecycle and AdtUnitTest for test execution
 */
class AdtCdsUnitTest extends AdtUnitTest_1.AdtUnitTest {
    adtView;
    cdsViewName;
    className;
    constructor(connection, logger) {
        super(connection, logger);
        // adtClass and adtLocalTestClass are already available from parent class
        // adtView is for working with CDS views
        this.adtView = new AdtDdl_1.AdtDdl(connection, logger);
    }
    /**
     * Check CDS view availability for unit test doubles
     * This check is required before creating a CDS unit test class.
     *
     * Unlike validate() (which checks name/params before create), this checks whether
     * a CDS view can be used with the test doubles framework (cl_cds_test_environment).
     */
    async checkCdsTestDoubles(cdsViewName) {
        try {
            this.logger?.info?.('Checking CDS view for unit test doubles:', cdsViewName);
            const response = await (0, checkCdsTestDoublesAvailability_1.checkCdsTestDoublesAvailability)(this.connection, cdsViewName);
            // Check if the check succeeded (SEVERITY=OK)
            if (response?.status === 200) {
                const { XMLParser } = require('fast-xml-parser');
                const parser = new XMLParser({ ignoreAttributes: false });
                const parsed = parser.parse(response.data);
                const severity = parsed?.['asx:abap']?.['asx:values']?.DATA?.SEVERITY;
                if (severity !== 'OK') {
                    const shortText = parsed?.['asx:abap']?.['asx:values']?.DATA?.SHORT_TEXT || '';
                    const longText = parsed?.['asx:abap']?.['asx:values']?.DATA?.LONG_TEXT || '';
                    const errorMessage = shortText ||
                        longText ||
                        `CDS test doubles check failed with severity: ${severity}`;
                    throw new Error(`CDS view ${cdsViewName} is not available for unit test doubles: ${errorMessage}`);
                }
                this.logger?.info?.('CDS view available for unit test doubles');
                this.cdsViewName = cdsViewName;
                const state = {
                    cdsCheckResponse: response,
                    errors: [],
                };
                return state;
            }
            else {
                throw new Error(`CDS test doubles check failed with HTTP ${response.status}`);
            }
        }
        catch (error) {
            this.logger?.error('checkCdsTestDoubles failed:', (0, internalUtils_1.safeErrorMessage)(error));
            throw error;
        }
    }
    /**
     * Override: Create test class with CDS template and test class source
     * For CDS: creates a global minimal class and adds local test class to it
     * If className and classTemplate are provided, creates test class; otherwise uses parent's create for test run
     */
    async create(config, options) {
        // If className and classTemplate are provided, create test class
        if (config.className && config.classTemplate && config.testClassSource) {
            try {
                this.logger?.info?.('Creating CDS unit test class:', config.className);
                this.className = config.className;
                // Step 1: Create empty global class with CDS template
                // Uses parent's adtClass for creating the global class
                this.logger?.info?.('Step 1: Creating global class with template');
                const createState = await this.adtClass.create({
                    className: config.className,
                    packageName: config.packageName,
                    description: config.description || `CDS unit test for ${config.className}`,
                    classTemplate: config.classTemplate,
                    transportRequest: config.transportRequest,
                    final: true,
                });
                // Step 1.5: Activate the class after creation (required before lock test classes)
                this.logger?.info?.('Step 1.5: Activating global class');
                const _activateState = await this.adtClass.activate({
                    className: config.className,
                });
                this.logger?.info?.('Global class activated');
                // Step 2: Create local test class in the global class's testclasses include
                // Uses parent's adtLocalTestClass which handles locking/unlocking internally
                this.logger?.info?.('Step 2: Creating local test class in global class');
                const testClassState = await this.adtLocalTestClass.create({
                    className: config.className,
                    testClassCode: config.testClassSource,
                    transportRequest: config.transportRequest,
                }, {
                    activateOnCreate: true, // Activate the parent class after creating test class
                });
                return {
                    createResult: createState.createResult,
                    testClassState: {
                        ...createState,
                        ...testClassState,
                    },
                    errors: [],
                };
            }
            catch (error) {
                this.logger?.error('create failed:', (0, internalUtils_1.safeErrorMessage)(error));
                throw error;
            }
        }
        // Otherwise, use parent's create for test run
        // Convert ICdsUnitTestConfig to IUnitTestConfig for parent method
        if (!config.tests || config.tests.length === 0) {
            throw new Error('At least one test definition is required for test run');
        }
        return await super.create({
            tests: config.tests,
            options: config.options,
            runId: config.runId,
            status: config.status,
            result: config.result,
        }, options);
    }
    /**
     * Override: Update test class source
     * If className and testClassSource are provided, updates test class; otherwise uses parent's update
     */
    async update(config, options) {
        // If className and testClassSource are provided, update test class
        if (config.className && config.testClassSource) {
            try {
                this.logger?.info?.('Updating CDS test class source:', config.className);
                // Uses parent's adtLocalTestClass which handles locking/unlocking and activation internally
                const testClassState = await this.adtLocalTestClass.update({
                    className: config.className,
                    testClassCode: config.testClassSource,
                    transportRequest: config.transportRequest,
                }, {
                    activateOnUpdate: true, // Activate the parent class after updating test class
                });
                return {
                    testClassState,
                    errors: [],
                };
            }
            catch (error) {
                this.logger?.error('update failed:', (0, internalUtils_1.safeErrorMessage)(error));
                throw error;
            }
        }
        // Otherwise, use parent's update (which throws error for test runs)
        return await super.update(config, options);
    }
    /**
     * Override: Delete test class
     * If className is provided, deletes test class; otherwise uses parent's delete
     * For CDS: deletes the entire global class (not just the local test class)
     */
    async delete(config) {
        // If className is provided, delete test class
        if (config.className) {
            try {
                this.logger?.info?.('Deleting CDS test class (global class):', config.className);
                // Uses parent's adtClass for deleting the global class
                const deleteState = await this.adtClass.delete({
                    className: config.className,
                    transportRequest: config.transportRequest,
                });
                this.className = undefined;
                return {
                    testClassState: deleteState,
                    errors: [],
                };
            }
            catch (error) {
                this.logger?.error('delete failed:', (0, internalUtils_1.safeErrorMessage)(error));
                throw error;
            }
        }
        // Otherwise, use parent's delete (which throws error for test runs)
        return await super.delete(config);
    }
    /**
     * Override: Run unit tests
     * For CDS: if className is provided, runs tests for that class by object name
     * Otherwise, uses parent's run method with tests array
     */
    async run(testsOrClassName, options) {
        // If className is provided (string), run tests for that class by object name
        if (typeof testsOrClassName === 'string') {
            const className = testsOrClassName;
            if (!className) {
                throw new Error('Class name is required');
            }
            try {
                this.logger?.info?.('Starting unit test run for object:', className);
                const response = await (0, run_1.startClassUnitTestRunByObject)(this.connection, className, options);
                const runId = (0, internalUtils_1.headerValueToString)(response.headers?.location)?.split('/').pop() ||
                    (0, internalUtils_1.headerValueToString)(response.headers?.['content-location'])
                        ?.split('/')
                        .pop() ||
                    (0, internalUtils_1.headerValueToString)(response.headers?.['sap-adt-location'])
                        ?.split('/')
                        .pop() ||
                    this.extractRunId(response);
                if (!runId) {
                    throw new Error('Failed to extract run ID from response');
                }
                this.lastRunId = runId;
                this.state.runId = runId;
                this.logger?.info?.('Unit test run started, runId:', runId);
                return runId;
            }
            catch (error) {
                this.logger?.error('run failed:', (0, internalUtils_1.safeErrorMessage)(error));
                throw error;
            }
        }
        // Otherwise, use parent's run method with tests array
        return await super.run(testsOrClassName, options);
    }
    /**
     * Get test class name
     */
    getClassName() {
        return this.className;
    }
    /**
     * Get CDS view name
     */
    getCdsViewName() {
        return this.cdsViewName;
    }
}
exports.AdtCdsUnitTest = AdtCdsUnitTest;
