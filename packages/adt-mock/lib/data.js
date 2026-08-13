/**
 * Sample object store for the mock ADT server.
 *
 * Mirrors the shape of real ADT repository objects well enough for protocol
 * testing: class pools with includes, interfaces, programs, packages and a
 * CDS view, plus deterministic ABAP Unit and ATC outcomes.
 */
const NOW = '2026-08-13T12:00:00.000Z';
export const OBJECTS = [
    {
        uri: '/sap/bc/adt/oo/classes/zcl_demo',
        type: 'CLAS/OC',
        category: 'CLAS',
        name: 'ZCL_DEMO',
        description: 'Demo class with unit tests',
        packageName: 'ZPACK_DEMO',
        masterLanguage: 'EN',
        changedAt: NOW,
        changedBy: 'DEMO',
        source: `CLASS zcl_demo DEFINITION PUBLIC CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS add IMPORTING iv_a TYPE i iv_b TYPE i RETURNING VALUE(rv_sum) TYPE i.
    METHODS greet IMPORTING iv_name TYPE string RETURNING VALUE(rv_greeting) TYPE string.
  PROTECTED SECTION.
  PRIVATE SECTION.
ENDCLASS.

CLASS zcl_demo IMPLEMENTATION.
  METHOD add.
    rv_sum = iv_a + iv_b.
  ENDMETHOD.

  METHOD greet.
    rv_greeting = |Hello, { iv_name }!|.
  ENDMETHOD.
ENDCLASS.`,
        unit: { total: 2, passed: 2, failed: 0 },
        atcFindings: [
            {
                check: 'CI_FAVORITE_CHECK',
                checkTitle: 'Use of obsolete statement',
                severity: 'WARNING',
                message: 'Method ADD: consider inlining simple arithmetic',
                line: 12,
            },
        ],
    },
    {
        uri: '/sap/bc/adt/oo/classes/zcl_demo~test',
        type: 'CLAS/OC',
        category: 'CLAS',
        name: 'ZCL_DEMO~TEST',
        description: 'Unit tests for ZCL_DEMO',
        packageName: 'ZPACK_DEMO',
        masterLanguage: 'EN',
        changedAt: NOW,
        changedBy: 'DEMO',
        source: `CLASS ltcl_add DEFINITION FOR TESTING RISK LEVEL HARMLESS DURATION SHORT.
  PRIVATE SECTION.
    METHODS should_add FOR TESTING.
ENDCLASS.

CLASS ltcl_add IMPLEMENTATION.
  METHOD should_add.
    DATA(cut) = NEW zcl_demo( ).
    cl_abap_unit_assert=>assert_equals( act = cut->add( iv_a = 2 iv_b = 3 )
                                        exp = 5 ).
  ENDMETHOD.
ENDCLASS.`,
        unit: { total: 1, passed: 1, failed: 0 },
    },
    {
        uri: '/sap/bc/adt/oo/interfaces/zif_demo',
        type: 'INTF/OI',
        category: 'INTF',
        name: 'ZIF_DEMO',
        description: 'Demo interface',
        packageName: 'ZPACK_DEMO',
        masterLanguage: 'EN',
        changedAt: NOW,
        changedBy: 'DEMO',
        source: `INTERFACE zif_demo PUBLIC.
  METHODS add IMPORTING iv_a TYPE i iv_b TYPE i RETURNING VALUE(rv_sum) TYPE i.
  METHODS greet IMPORTING iv_name TYPE string RETURNING VALUE(rv_greeting) TYPE string.
ENDINTERFACE.`,
    },
    {
        uri: '/sap/bc/adt/programs/programs/zprog_demo',
        type: 'PROG/P',
        category: 'PROG',
        name: 'ZPROG_DEMO',
        description: 'Demo executable program',
        packageName: 'ZPACK_DEMO',
        masterLanguage: 'EN',
        changedAt: NOW,
        changedBy: 'DEMO',
        source: `REPORT zprog_demo.

PARAMETERS: p_name TYPE string DEFAULT 'World'.

DATA(lo_demo) = NEW zcl_demo( ).
WRITE / lo_demo->greet( iv_name = p_name ).`,
        atcFindings: [
            {
                check: 'CI_FAVORITE_CHECK',
                checkTitle: 'Performance: SELECT inside loop',
                severity: 'ERROR',
                message: 'REPORT ZPROG_DEMO: avoid SELECT statements in loops (line 5)',
                line: 5,
            },
        ],
    },
    {
        uri: '/sap/bc/adt/ddls/sources/zcds_demo',
        type: 'DDLS/DF',
        category: 'DDLS',
        name: 'ZCDS_DEMO',
        description: 'Demo CDS view',
        packageName: 'ZPACK_DEMO',
        masterLanguage: 'EN',
        changedAt: NOW,
        changedBy: 'DEMO',
        source: `@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'Demo CDS view'
define view ZCDS_DEMO as select from t100
{
  key msgno,
      text
}`,
    },
    {
        uri: '/sap/bc/adt/oo/classes/zcl_flaky',
        type: 'CLAS/OC',
        category: 'CLAS',
        name: 'ZCL_FLAKY',
        description: 'Class with failing unit test (demo)',
        packageName: 'ZPACK_DEMO',
        masterLanguage: 'EN',
        changedAt: NOW,
        changedBy: 'DEMO',
        source: `CLASS zcl_flaky DEFINITION PUBLIC CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS divide IMPORTING iv_a TYPE i iv_b TYPE i RETURNING VALUE(rv_q) TYPE i.
ENDCLASS.

CLASS zcl_flaky IMPLEMENTATION.
  METHOD divide.
    rv_q = iv_a / iv_b.
  ENDMETHOD.
ENDCLASS.`,
        unit: {
            total: 1,
            passed: 0,
            failed: 1,
            failedMethod: 'DIVIDES',
            failedMessage: 'Division by zero raises CX_SY_ZERODIVIDE instead of returning 0',
        },
        atcFindings: [
            {
                check: 'CI_FAVORITE_CHECK',
                checkTitle: 'Division by zero not handled',
                severity: 'CRITICAL',
                message: 'METHOD DIVIDE: potential division by zero',
                line: 11,
            },
        ],
    },
];
export const PACKAGES = {
    ZPACK_DEMO: { description: 'Demo development package' },
    $TMP: { description: 'Local Objects (package for local development)' },
};
//# sourceMappingURL=data.js.map