/**
 * Read-side parsing of the ADT textelements subsources (symbols /
 * selections / headings) — the plain-text custom format SAP serves at
 * `GET /sap/bc/adt/textelements/programs/{prog}/source/{subsource}`.
 *
 * Format verified live against S/4HANA by abap-mcp (lib/textElementsSource.ts):
 *  - records separated by blank lines; CRLF on the wire (LF tolerated here);
 *  - symbols: `@MaxLength:N` annotation line above `KEY=text`;
 *  - selections: `KEY    =text` (key padded to 8);
 *  - headings: plain `key=text` lines (listHeader / columnHeader_N).
 *
 * The output uses the CLASSIC TEXTPOOL row shape (ID/KEY/ENTRY/LENGTH) so
 * agents recognize it: I = text symbol, S = selection text, H = list heading.
 * The write side (PUT of the same format) is deliberately NOT implemented —
 * it needs live verification first (plan P1-3: read only).
 */
/** One textpool-shaped row (ID/KEY/ENTRY/LENGTH). */
export interface AdtTextElementRow {
    /** I = text symbol, S = selection text, H = list heading. */
    id: 'I' | 'S' | 'H';
    key: string;
    entry: string;
    length?: number;
}
/** Parse the `symbols` subsource (`@MaxLength:N` + `KEY=text`). */
export declare function parseSymbolsSource(body: string): AdtTextElementRow[];
/** Parse the `selections` subsource (`KEY     =text`, key padded to 8). */
export declare function parseSelectionsSource(body: string): AdtTextElementRow[];
/** Parse the `headings` subsource (`listHeader=…` / `columnHeader_N=…`). */
export declare function parseHeadingsSource(body: string): AdtTextElementRow[];
/** The three subsources, parsed. */
export interface AdtTextElements {
    program: string;
    /** All rows, textpool-shaped, in I → S → H order. */
    elements: AdtTextElementRow[];
    counts: {
        symbols: number;
        selections: number;
        headings: number;
    };
    /** Per-subsource raw bodies (debugging format drift). */
    raw: {
        symbols?: string;
        selections?: string;
        headings?: string;
    };
}
//# sourceMappingURL=textelements.d.ts.map