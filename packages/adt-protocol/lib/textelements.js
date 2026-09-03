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
/** Split a subsource body into blank-line-separated records. */
function splitRecords(body) {
    if (!body)
        return [];
    return body
        .replace(/\r?\n/g, '\n')
        .split(/\n\n+/)
        .map((record) => record.trim())
        .filter((record) => record.length > 0);
}
/** Parse the `symbols` subsource (`@MaxLength:N` + `KEY=text`). */
export function parseSymbolsSource(body) {
    const rows = [];
    for (const record of splitRecords(body)) {
        let maxLength;
        for (const line of record.split(/\r?\n/)) {
            const annot = /^@MaxLength:(\d+)\s*$/i.exec(line);
            if (annot) {
                maxLength = Number(annot[1]);
                continue;
            }
            const kv = /^([^=]+?)=(.*)$/.exec(line);
            if (kv) {
                rows.push({
                    id: 'I',
                    key: kv[1].trim(),
                    entry: kv[2],
                    ...(maxLength !== undefined ? { length: maxLength } : {}),
                });
            }
        }
    }
    return rows;
}
/** Parse the `selections` subsource (`KEY     =text`, key padded to 8). */
export function parseSelectionsSource(body) {
    const rows = [];
    for (const record of splitRecords(body)) {
        for (const line of record.split(/\r?\n/)) {
            const kv = /^(.*?)=(.*)$/.exec(line);
            if (!kv)
                continue;
            const key = kv[1].trim();
            if (!key)
                continue;
            rows.push({ id: 'S', key, entry: kv[2] });
        }
    }
    return rows;
}
/** Parse the `headings` subsource (`listHeader=…` / `columnHeader_N=…`). */
export function parseHeadingsSource(body) {
    const rows = [];
    for (const line of body.split(/\r?\n/)) {
        const kv = /^([A-Za-z_][A-Za-z_0-9]*)=(.*)$/.exec(line);
        if (kv)
            rows.push({ id: 'H', key: kv[1], entry: kv[2] });
    }
    return rows;
}
//# sourceMappingURL=textelements.js.map