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
export function mapTableFieldType(field: AdtTableFieldSpec): string {
  const t = field.type.toUpperCase();
  const length = field.length && field.length > 0 ? Math.floor(field.length) : 0;
  switch (t) {
    case 'CHAR':
      return `abap.char(${length || 1})`;
    case 'NUMC':
      return `abap.numc(${length || 10})`;
    case 'RAW':
      return `abap.raw(${length || 16})`;
    case 'DEC':
    case 'CURR':
    case 'QUAN':
      return `abap.dec(${length || 15},${Math.max(Math.floor(field.decimals ?? 2), 0)})`;
    case 'INT1':
      return 'abap.int1';
    case 'INT2':
      return 'abap.int2';
    case 'INT4':
      return 'abap.int4';
    case 'INT8':
      return 'abap.int8';
    case 'FLTP':
      return 'abap.fltp';
    case 'STRING':
      return 'abap.string(0)';
    case 'RAWSTRING':
      return 'abap.rawstring(0)';
    case 'DATS':
    case 'DATE':
      return 'abap.dats';
    case 'TIMS':
    case 'TIME':
      return 'abap.tims';
    case 'UTCLONG':
      return 'abap.utclong';
    case 'UUID':
    case 'SYSUUID_X16':
      return 'sysuuid_x16';
    case 'MANDT':
    case 'CLIENT':
      return 'mandt';
  }
  // CHAR32 / NUMC10 shorthand (vsp compat).
  if (/^CHAR\d+$/.test(t)) return `abap.char(${t.slice(4)})`;
  if (/^NUMC\d+$/.test(t)) return `abap.numc(${t.slice(4)})`;
  // Anything else must be a data element reference.
  if (!/^[A-Za-z/][A-Za-z0-9_/]*$/.test(field.type)) {
    throw new Error(
      `table field ${field.name}: '${field.type}' is neither a builtin type code nor a valid data element name`,
    );
  }
  return field.type.toLowerCase();
}

/** Escape single quotes for DDL string literals ('' doubling). */
function ddlQuote(text: string): string {
  return text.replace(/'/g, "''");
}

/**
 * Generate the DDIC 2.0 DDL source of a table: annotations, the auto MANDT
 * key (`key client : abap.clnt not null;` — standard SAP practice, vsp
 * verified), then the user fields.
 */
export function generateTableDdl(request: AdtCreateTableRequest): string {
  const name = request.name.toUpperCase();
  if (!/^[A-Za-z/][A-Za-z0-9_/]*$/.test(name)) {
    throw new Error(`table name '${request.name}' is not a valid ABAP object name`);
  }
  if (name.length > 30) {
    throw new Error(`table name '${name}' is longer than 30 characters`);
  }
  if (!Array.isArray(request.fields) || request.fields.length === 0) {
    throw new Error('at least one field is required for table creation');
  }
  const deliveryClass = (request.deliveryClass ?? 'A').toUpperCase();
  const tableCategory = (request.tableCategory ?? 'TRANSPARENT').toUpperCase();
  const lines: string[] = [
    `@EndUserText.label : '${ddlQuote(request.description)}'`,
    '@AbapCatalog.enhancement.category : #NOT_EXTENSIBLE',
    `@AbapCatalog.tableCategory : #${tableCategory}`,
    `@AbapCatalog.deliveryClass : #${deliveryClass}`,
    '@AbapCatalog.dataMaintenance : #ALLOWED',
    `define table ${name.toLowerCase()} {`,
    '',
    '  key client : abap.clnt not null;',
  ];
  const seen = new Set(['client']);
  for (const field of request.fields) {
    const fieldName = field.name.toLowerCase();
    if (!/^[a-z/][a-z0-9_/]*$/.test(fieldName)) {
      throw new Error(`table field name '${field.name}' is not a valid ABAP field name`);
    }
    if (fieldName === 'client' || fieldName === 'mandt') {
      throw new Error(`table field '${field.name}': the client key field is added automatically`);
    }
    if (seen.has(fieldName)) {
      throw new Error(`table field '${field.name}' is defined twice`);
    }
    seen.add(fieldName);
    if (field.description) {
      lines.push(`  @EndUserText.label : '${ddlQuote(field.description)}'`);
    }
    const type = mapTableFieldType(field);
    const key = field.isKey ? 'key ' : '';
    const notNull = field.isKey || field.notNull ? ' not null' : '';
    lines.push(`  ${key}${fieldName} : ${type}${notNull};`);
  }
  lines.push('', '}', '');
  return lines.join('\n');
}
