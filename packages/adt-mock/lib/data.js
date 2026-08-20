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
    {
        uri: '/sap/bc/adt/oo/classes/zcl_runner',
        type: 'CLAS/OC',
        category: 'CLAS',
        name: 'ZCL_RUNNER',
        description: 'Runnable class (if_oo_adt_classrun) for adt_execute demos',
        packageName: 'ZPACK_DEMO',
        masterLanguage: 'EN',
        changedAt: NOW,
        changedBy: 'DEMO',
        source: `CLASS zcl_runner DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_oo_adt_classrun.
ENDCLASS.

CLASS zcl_runner IMPLEMENTATION.
  METHOD if_oo_adt_classrun~main.
    out->write( 'Hello from ZCL_RUNNER (mock classrun)' ).
    out->write( |2 + 3 = { 2 + 3 }| ).
  ENDMETHOD.
ENDCLASS.`,
    },
    {
        uri: '/sap/bc/adt/msgclass/zmsg_demo',
        type: 'MSAG/N',
        category: 'MSAG',
        name: 'ZMSG_DEMO',
        description: 'Demo message class',
        packageName: 'ZPACK_DEMO',
        masterLanguage: 'EN',
        changedAt: NOW,
        changedBy: 'DEMO',
        source: '* message class ZMSG_DEMO',
        metadataXml: `<?xml version="1.0" encoding="UTF-8"?>
<mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZMSG_DEMO" adtcore:type="MSAG/N" adtcore:description="Demo message class" adtcore:language="EN" adtcore:masterLanguage="EN" adtcore:responsible="DEMO">
  <adtcore:packageRef adtcore:name="ZPACK_DEMO"/>
  <mc:messages mc:msgno="001" mc:msgtext="Hello &amp;1, welcome to the demo"/>
  <mc:messages mc:msgno="002" mc:msgtext="Value &amp;1 is not valid (allowed: &amp;2)"/>
  <mc:messages mc:msgno="003" mc:msgtext="Operation finished with status &amp;1"/>
</mc:messageClass>`,
    },
    {
        uri: '/sap/bc/adt/ddic/domains/zdoma_demo',
        type: 'DOMA/DT',
        category: 'DOMA',
        name: 'ZDOMA_DEMO',
        description: 'Demo domain with fixed values',
        packageName: 'ZPACK_DEMO',
        masterLanguage: 'EN',
        changedAt: NOW,
        changedBy: 'DEMO',
        source: '* domain ZDOMA_DEMO',
        metadataXml: `<?xml version="1.0" encoding="UTF-8"?>
<doma:domain xmlns:doma="http://www.sap.com/adt/ddic/Domains" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZDOMA_DEMO" adtcore:type="DOMA/DT" adtcore:description="Demo domain with fixed values" adtcore:language="EN" adtcore:masterLanguage="EN">
  <adtcore:packageRef adtcore:name="ZPACK_DEMO"/>
  <doma:content>
    <doma:typeInformation>
      <doma:datatype>CHAR</doma:datatype>
      <doma:length>2</doma:length>
      <doma:decimals>0</doma:decimals>
    </doma:typeInformation>
    <doma:outputInformation>
      <doma:conversionExit></doma:conversionExit>
      <doma:signExists>false</doma:signExists>
      <doma:lowercase>false</doma:lowercase>
    </doma:outputInformation>
    <doma:fixValues>
      <doma:fixValue>
        <doma:low>AA</doma:low>
        <doma:text>Alpha mode</doma:text>
      </doma:fixValue>
      <doma:fixValue>
        <doma:low>BB</doma:low>
        <doma:text>Beta mode</doma:text>
      </doma:fixValue>
    </doma:fixValues>
  </doma:content>
</doma:domain>`,
    },
    {
        uri: '/sap/bc/adt/ddic/dataelements/zdtel_demo',
        type: 'DTEL/DT',
        category: 'DTEL',
        name: 'ZDTEL_DEMO',
        description: 'Demo data element on ZDOMA_DEMO',
        packageName: 'ZPACK_DEMO',
        masterLanguage: 'EN',
        changedAt: NOW,
        changedBy: 'DEMO',
        source: '* data element ZDTEL_DEMO',
        metadataXml: `<?xml version="1.0" encoding="UTF-8"?>
<dtel:dataElement xmlns:dtel="http://www.sap.com/adt/ddic/DataElements" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZDTEL_DEMO" adtcore:type="DTEL/DT" adtcore:description="Demo data element on ZDOMA_DEMO" adtcore:language="EN" adtcore:masterLanguage="EN">
  <adtcore:packageRef adtcore:name="ZPACK_DEMO"/>
  <dtel:typeKind>domain</dtel:typeKind>
  <dtel:typeName>ZDOMA_DEMO</dtel:typeName>
  <dtel:labels>
    <dtel:label type="shortText">Demo</dtel:label>
    <dtel:label type="mediumText">Demo element</dtel:label>
    <dtel:label type="heading">DemoElem</dtel:label>
  </dtel:labels>
</dtel:dataElement>`,
    },
    {
        uri: '/sap/bc/adt/ddic/tabletypes/zttyp_demo',
        type: 'TTYP/DT',
        category: 'TTYP',
        name: 'ZTTYP_DEMO',
        description: 'Demo table type (sorted by component)',
        packageName: 'ZPACK_DEMO',
        masterLanguage: 'EN',
        changedAt: NOW,
        changedBy: 'DEMO',
        source: '* table type ZTTYP_DEMO',
        metadataXml: `<?xml version="1.0" encoding="UTF-8"?>
<ttypes:tableType xmlns:ttypes="http://www.sap.com/adt/ddic/TableTypes" xmlns:ttyp="http://www.sap.com/adt/ddic/TableTypes" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZTTYP_DEMO" adtcore:type="TTYP/DT" adtcore:description="Demo table type (sorted by component)" adtcore:language="EN" adtcore:masterLanguage="EN">
  <adtcore:packageRef adtcore:name="ZPACK_DEMO"/>
  <ttyp:typeKind>structure</ttyp:typeKind>
  <ttyp:typeName>ZCDS_DEMO</ttyp:typeName>
  <ttyp:accessType>standard</ttyp:accessType>
  <ttyp:key>
    <ttyp:definition>key</ttyp:definition>
    <ttyp:kind>default</ttyp:kind>
  </ttyp:key>
</ttypes:tableType>`,
    },
];
export const DUMPS = [
    {
        id: '20260813115347mockhost_MOCK_00DEMO000001',
        title: 'UNCAUGHT_EXCEPTION',
        category: 'ABAP Programming Error',
        user: 'DEMO',
        updatedAt: '2026-08-13T11:53:47.000Z',
        program: 'ZPROG_DEMO',
        text: 'CX_SY_ZERODIVIDE: Division by zero in method DIVIDE (row 11).',
    },
    {
        id: '20260812100102mockhost_MOCK_00OTHER000002',
        title: 'TIMEOUT',
        category: 'ABAP Runtime Limit Exceeded',
        user: 'OTHER',
        updatedAt: '2026-08-12T10:01:02.000Z',
        program: 'SAPLZLONG_RUNNING',
        text: 'Runtime limit of 600 seconds exceeded in SELECT on ZBIGTABLE.',
    },
];
export const PACKAGES = {
    ZPACK_DEMO: { description: 'Demo development package' },
    $TMP: { description: 'Local Objects (package for local development)' },
};
//# sourceMappingURL=data.js.map