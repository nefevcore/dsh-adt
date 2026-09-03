/**
 * DDIC 2.0 DDL generation for table creation (`define table …` blueSource).
 *
 * Semantics verified against vsp's CreateTable (pkg/adt/crud.go — field
 * mapping, annotations, auto-MANDT) — deliberately re-implemented, not
 * copied, and kept pure so the generator is testable without any system.
 *
 * The wire-format rule (the abap-mcp "fields-level JSON that only looks good
 * in the schema" anti-lesson): every accepted parameter MUST land in the
 * generated DDL. Field descriptions become `@EndUserText.label` annotations;
 * anything the format cannot express is rejected here, not silently dropped.
 */
/** One field of a table to create. */
export interface AdtTableFieldSpec {
    /** Field name (ABAP name; uppercased on the wire). */
    name: string;
    /**
     * Built-in type code (CHAR, NUMC, RAW, DEC, CURR, QUAN, INT1..8, FLTP,
     * STRING, RAWSTRING, DATS, TIMS, UTCLONG, UUID, CHARnn/NUMCnn shorthand)
     * — or the NAME of a data element (then length/decimals are ignored).
     */
    type: string;
    length?: number;
    decimals?: number;
    isKey?: boolean;
    notNull?: boolean;
    description?: string;
}
/** A full create-table request. */
export interface AdtCreateTableRequest {
    name: string;
    description: string;
    packageName: string;
    /** Transport request number (optional for $TMP). */
    transport?: string;
    fields: AdtTableFieldSpec[];
    /** SAP delivery class (A application, C customizing, L temporary, …). */
    deliveryClass?: string;
    /** TRANSPARENT (default) or STRUCTURE/CLUSTER/POOL. */
    tableCategory?: string;
}
/** Map one field's type code to the DDL type expression. */
export declare function mapTableFieldType(field: AdtTableFieldSpec): string;
/**
 * Generate the DDIC 2.0 DDL source of a table: annotations, the auto MANDT
 * key (`key client : abap.clnt not null;` — standard SAP practice, vsp
 * verified), then the user fields.
 */
export declare function generateTableDdl(request: AdtCreateTableRequest): string;
//# sourceMappingURL=tableddl.d.ts.map