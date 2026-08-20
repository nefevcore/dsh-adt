/**
 * Structured metadata editing for the DDIC object types whose content is NOT
 * plain source text but a metadata XML document: message classes (MSAG),
 * domains (DOMA), data elements (DTEL) and table types (TTYP).
 *
 * The wire formats mirror what the official ADT editors exchange (cross-
 * checked against `@mcp-abap-adt/adt-clients`, `abap-adt-api` and the ADT
 * editors' own PUT payloads):
 *
 *  - MSAG  `application/vnd.sap.adt.mc.messageclass+xml`
 *          root `<mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass">`,
 *          messages as `<mc:messages mc:msgno=".." mc:msgtext=".."/>` elements;
 *          deletions travel as `<mc:deletedmessages …/>`.
 *  - DOMA  `application/vnd.sap.adt.domains.v2+xml`
 *          root `<doma:domain>`, technical data under `<doma:content>` →
 *          `<doma:typeInformation>`, fixed values under `<doma:fixValues>`.
 *  - DTEL  `application/vnd.sap.adt.dataelements.v2+xml`
 *          root `<dtel:dataElement>`, `<dtel:typeKind>`/`<dtel:typeName>`/
 *          `<dtel:dataType>`(+Length/Decimals), labels under `<dtel:labels>`.
 *  - TTYP  `application/vnd.sap.adt.tabletypes.v2+xml`
 *          root `<ttypes:tableType>`, row type `<ttyp:typeKind>`/
 *          `<ttyp:typeName>`, access `<ttyp:accessType>`, key `<ttyp:definition>`.
 *
 * Writes use the read-modify-write pattern: the client GETs the current XML,
 * patches ONLY the explicitly-provided fields on the raw string (preserving
 * every SAP-managed attribute that would be lost in a from-scratch build),
 * and PUTs the result back under a lock handle.
 */

import { attr, child, childText, children, parseXml, type XmlNode } from './xml.js';
import type {
  AdtDomainFixedValue,
  AdtMessageClassMessage,
  AdtStructureBase,
  AdtStructureChanges,
  AdtStructureData,
  AdtStructureKind,
} from './types.js';

/** Negotiation media type per structured kind (Accept + PUT Content-Type). */
export function structureMediaType(kind: AdtStructureKind): string {
  switch (kind) {
    case 'MSAG':
      return 'application/vnd.sap.adt.mc.messageclass+xml, application/xml';
    case 'DOMA':
      return 'application/vnd.sap.adt.domains.v2+xml';
    case 'DTEL':
      return 'application/vnd.sap.adt.dataelements.v2+xml';
    case 'TTYP':
      return 'application/vnd.sap.adt.tabletypes.v2+xml';
  }
}

/** Object type code (ADT form) per structured kind. */
export function structureTypeCode(kind: AdtStructureKind): string {
  switch (kind) {
    case 'MSAG':
      return 'MSAG/N';
    case 'DOMA':
      return 'DOMA/DT';
    case 'DTEL':
      return 'DTEL/DT';
    case 'TTYP':
      return 'TTYP/DT';
  }
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Attribute value by exact (possibly prefixed) name, e.g. `mc:msgno`. */
function prefixedAttr(node: XmlNode, name: string): string | undefined {
  const direct = node.attributes[name];
  if (direct !== undefined) return direct;
  const local = name.includes(':') ? name.slice(name.indexOf(':') + 1) : name;
  return attr(node, local);
}

function toBool(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const v = value.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'x') return true;
  if (v === 'false' || v === '0' || v === '') return false;
  return undefined;
}

/** Parse a structured-metadata XML body into typed JSON (per kind). */
export function parseStructure(xml: string, kind: AdtStructureKind): AdtStructureData {
  const root = parseXml(xml);
  const packageRef = child(root, 'packageRef');
  const base: Omit<AdtStructureBase, 'kind'> = {
    name: attr(root, 'name') ?? '',
    description: attr(root, 'description'),
    packageName: packageRef ? attr(packageRef, 'name') : undefined,
    masterLanguage: attr(root, 'masterLanguage'),
    responsible: attr(root, 'responsible'),
  };

  switch (kind) {
    case 'MSAG': {
      const messages: AdtMessageClassMessage[] = [];
      for (const el of children(root, 'messages')) {
        const number = prefixedAttr(el, 'mc:msgno') ?? attr(el, 'msgno');
        if (!number) continue;
        messages.push({
          number,
          text: prefixedAttr(el, 'mc:msgtext') ?? attr(el, 'msgtext') ?? '',
          selfExplanatory: toBool(prefixedAttr(el, 'mc:selfexplainatory') ?? attr(el, 'selfexplainatory')),
        });
      }
      messages.sort((a, b) => a.number.localeCompare(b.number));
      return { ...base, kind: 'MSAG', messages };
    }
    case 'DOMA': {
      const properties = domaProperties(root);
      const fixedValues: AdtDomainFixedValue[] = [];
      // fixValues may sit at the root or nested under <doma:content>.
      const fixValues = child(root, 'fixValues') ?? child(child(root, 'content') ?? root, 'fixValues');
      for (const fv of children(fixValues ?? root, 'fixValue')) {
        fixedValues.push({
          low: childText(fv, 'low') ?? '',
          high: childText(fv, 'high') || undefined,
          description: childText(fv, 'text') || childText(fv, 'description') || undefined,
        });
      }
      return { ...base, kind: 'DOMA', properties, fixedValues };
    }
    case 'DTEL': {
      const properties = dtelProperties(root);
      const labels: Record<string, string> = {};
      const labelsEl = child(root, 'labels');
      for (const label of children(labelsEl ?? root, 'label')) {
        const key = attr(label, 'type') ?? attr(label, 'kind');
        if (key && label.text) labels[key] = label.text;
      }
      return { ...base, kind: 'DTEL', properties, labels };
    }
    case 'TTYP': {
      return { ...base, kind: 'TTYP', properties: ttypProperties(root) };
    }
  }
}

function domaProperties(root: XmlNode): Record<string, string> {
  const content = child(root, 'content') ?? root;
  const typeInfo = child(content, 'typeInformation') ?? content;
  const props: Record<string, string> = {};
  const scalar = (node: XmlNode, key: string): void => {
    const value = childText(node, key);
    if (value !== undefined) props[key] = value;
  };
  scalar(typeInfo, 'datatype');
  scalar(typeInfo, 'length');
  scalar(typeInfo, 'decimals');
  const output = child(content, 'outputInformation');
  if (output) {
    scalar(output, 'conversionExit');
    scalar(output, 'signExists');
    scalar(output, 'lowercase');
    scalar(output, 'outputStyle');
  }
  const valueTable = child(content, 'valueTableRef');
  if (valueTable) props.valueTable = attr(valueTable, 'name') ?? '';
  return props;
}

function dtelProperties(root: XmlNode): Record<string, string> {
  const props: Record<string, string> = {};
  for (const key of ['typeKind', 'typeName', 'dataType', 'dataTypeLength', 'dataTypeDecimals']) {
    const value = childText(root, key);
    if (value !== undefined) props[key] = value;
  }
  return props;
}

function ttypProperties(root: XmlNode): Record<string, string> {
  const props: Record<string, string> = {};
  const scalar = (key: string): void => {
    const value = childText(root, key);
    if (value !== undefined) props[key] = value;
  };
  scalar('typeKind');
  scalar('typeName');
  scalar('accessType');
  const keyEl = child(root, 'key');
  if (keyEl) {
    const definition = childText(keyEl, 'definition');
    const kind = childText(keyEl, 'kind');
    if (definition !== undefined) props.keyDefinition = definition;
    if (kind !== undefined) props.keyKind = kind;
  }
  return props;
}

// ---------------------------------------------------------------------------
// Patching (read-modify-write on the raw XML string)
// ---------------------------------------------------------------------------

function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Patch an attribute on the root element (matched by local name, any prefix). */
function patchRootAttribute(xml: string, localName: string, value: string): string {
  const rootOpen = /<[A-Za-z][\w.:-]*[^>]*>/g;
  const match = rootOpen.exec(xml);
  if (!match) return xml;
  const tag = match[0];
  const attrRe = new RegExp(`((?:[\\w.-]+:)?${localName})\\s*=\\s*"[^"]*"`);
  const escaped = escape(value);
  const patched = attrRe.test(tag)
    ? tag.replace(attrRe, `$1="${escaped}"`)
    : tag.replace(/\s*>$/, ` ${localName}="${escaped}">`);
  return xml.slice(0, match.index) + patched + xml.slice(match.index + tag.length);
}

/**
 * Range of the first element with `localName` (open-tag start to close-tag
 * end), or `undefined` when absent. Handles paired and self-closing forms.
 */
function elementRange(xml: string, localName: string): { start: number; end: number; openTag: string } | undefined {
  const openRe = new RegExp(`<(?:[\\w.-]+:)?${localName}\\b[^>]*?>`, 'g');
  const open = openRe.exec(xml);
  if (!open) return undefined;
  if (open[0].endsWith('/>')) {
    return { start: open.index, end: open.index + open[0].length, openTag: open[0] };
  }
  const closeRe = new RegExp(`</(?:[\\w.-]+:)?${localName}\\s*>`);
  closeRe.lastIndex = open.index + open[0].length;
  const rest = xml.slice(open.index + open[0].length);
  const close = closeRe.exec(rest);
  if (!close) return undefined;
  const end = open.index + open[0].length + close.index + close[0].length;
  return { start: open.index, end, openTag: open[0] };
}

/** Set the text of `localName` inside `parentLocal` (root when null). */
function patchElementText(xml: string, parentLocal: string | null, localName: string, value: string): string {
  // Scope the search to the parent element's range so same-named elements
  // elsewhere in the document are never touched.
  let scope: { start: number; end: number };
  if (parentLocal) {
    const parent = elementRange(xml, parentLocal);
    if (!parent) return xml;
    scope = { start: parent.start + parent.openTag.length, end: parent.end };
  } else {
    const rootOpen = /<[A-Za-z][\w.:-]*[^>]*>/g;
    const open = rootOpen.exec(xml);
    if (!open) return xml;
    scope = { start: open.index + open[0].length, end: xml.lastIndexOf('</') };
  }
  const inner = xml.slice(scope.start, scope.end);
  const elRe = new RegExp(`<((?:[\\w.-]+):)?${localName}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${localName}\\s*>`);
  const existing = elRe.exec(inner);
  if (existing) {
    const prefix = existing[1] ? `${existing[1]}:` : '';
    const patched =
      inner.slice(0, existing.index) + `<${prefix}${localName}>${escape(value)}</${prefix}${localName}>` +
      inner.slice(existing.index + existing[0].length);
    return xml.slice(0, scope.start) + patched + xml.slice(scope.end);
  }
  // Absent → insert right after the parent's open tag, reusing its prefix.
  const parentPrefix = parentLocal
    ? (/<([\w.-]+):/.exec(elementRange(xml, parentLocal)?.openTag ?? '')?.[1] ?? '')
    : '';
  const prefix = parentPrefix ? `${parentPrefix}:` : '';
  const insert = `<${prefix}${localName}>${escape(value)}</${prefix}${localName}>`;
  if (parentLocal) {
    const parent = elementRange(xml, parentLocal)!;
    return xml.slice(0, parent.start + parent.openTag.length) + insert + xml.slice(parent.start + parent.openTag.length);
  }
  return xml.slice(0, scope.start) + insert + xml.slice(scope.start);
}

/** Replace a whole element block (anywhere in the doc) with a new fragment. */
function replaceElementBlock(xml: string, localName: string, block: string): string {
  const range = elementRange(xml, localName);
  if (range) return xml.slice(0, range.start) + block + xml.slice(range.end);
  const lastClose = xml.lastIndexOf('</');
  return xml.slice(0, lastClose) + block + xml.slice(lastClose);
}

/** Remove EVERY occurrence of an element, returning the cleaned document. */
function removeAllElements(xml: string, localName: string): string {
  const openRe = new RegExp(
    `<(?:[\\w.-]+:)?${localName}\\b[^>]*?/>|<(?:[\\w.-]+:)?${localName}\\b[^>]*?>[\\s\\S]*?</(?:[\\w.-]+:)?${localName}\\s*>`,
    'g',
  );
  return xml.replace(openRe, '');
}

/** Insert a fragment just before the root element's closing tag. */
function insertBeforeRootClose(xml: string, fragment: string): string {
  const lastClose = xml.lastIndexOf('</');
  if (lastClose < 0) return xml + fragment;
  return xml.slice(0, lastClose) + fragment + xml.slice(lastClose);
}

/**
 * Apply typed changes to a raw structured-metadata XML body. Only explicitly
 * provided fields are patched; everything else round-trips untouched.
 */
export function patchStructureXml(xml: string, kind: AdtStructureKind, changes: AdtStructureChanges): string {
  let out = xml;
  if (changes.description !== undefined) {
    out = patchRootAttribute(out, 'description', changes.description);
  }

  if (kind === 'MSAG' && changes.messages) {
    // Message classes upsert every listed message and delete the rest: the
    // backend expects `<mc:messages>` for kept entries and
    // `<mc:deletedmessages>` for entries that exist remotely but are absent
    // from the new list. All existing message elements are replaced by the
    // generated set in one pass.
    const current = (parseStructure(xml, 'MSAG') as Extract<AdtStructureData, { kind: 'MSAG' }>).messages;
    const kept = new Set(changes.messages.map((m) => m.number));
    const lines: string[] = [];
    for (const message of changes.messages) {
      lines.push(
        `<mc:messages mc:msgno="${escape(message.number)}" mc:msgtext="${escape(message.text)}"` +
          (message.selfExplanatory !== undefined ? ` mc:selfexplainatory="${message.selfExplanatory}"` : '') +
          `/>`,
      );
    }
    for (const message of current) {
      if (!kept.has(message.number)) {
        lines.push(`<mc:deletedmessages mc:msgno="${escape(message.number)}" mc:msgtext="${escape(message.text)}"/>`);
      }
    }
    out = removeAllElements(out, 'messages');
    out = insertBeforeRootClose(out, lines.join('\n'));
    return out;
  }

  if (kind === 'DOMA') {
    for (const [key, raw] of Object.entries(changes.properties ?? {})) {
      const value = String(raw);
      if (key === 'valueTable') {
        // Reference element carries the name as an attribute.
        out = out.replace(
          /(<(?:[\w.-]+:)?valueTableRef\b[^>]*?)(?:[\w.-]+:)?name\s*=\s*"[^"]*"/,
          `$1adtcore:name="${escape(value)}"`,
        );
        continue;
      }
      const parent =
        key === 'conversionExit' || key === 'signExists' || key === 'lowercase' || key === 'outputStyle'
          ? 'outputInformation'
          : 'typeInformation';
      out = patchElementText(out, parent, key, value);
    }
    if (changes.fixedValues) {
      const items = changes.fixedValues
        .map(
          (fv) =>
            `      <doma:fixValue>\n        <doma:low>${escape(fv.low)}</doma:low>` +
            (fv.high ? `\n        <doma:high>${escape(fv.high)}</doma:high>` : '') +
            (fv.description ? `\n        <doma:text>${escape(fv.description)}</doma:text>` : '') +
            `\n      </doma:fixValue>`,
        )
        .join('\n');
      out = replaceElementBlock(
        out,
        'fixValues',
        changes.fixedValues.length > 0 ? `<doma:fixValues>\n${items}\n    </doma:fixValues>` : '<doma:fixValues/>',
      );
    }
    return out;
  }

  if (kind === 'DTEL') {
    for (const [key, raw] of Object.entries(changes.properties ?? {})) {
      let value = String(raw);
      if (key === 'dataTypeLength' || key === 'dataTypeDecimals') {
        // The ADT editor pads these to 6 digits.
        value = value.padStart(6, '0');
      }
      out = patchElementText(out, null, key, value);
    }
    for (const [key, value] of Object.entries(changes.labels ?? {})) {
      out = patchLabel(out, key, value);
    }
    return out;
  }

  // TTYP
  for (const [key, raw] of Object.entries(changes.properties ?? {})) {
    const value = String(raw);
    if (key === 'keyDefinition') {
      out = patchElementText(out, 'key', 'definition', value);
    } else if (key === 'keyKind') {
      out = patchElementText(out, 'key', 'kind', value);
    } else {
      out = patchElementText(out, null, key, value);
    }
  }
  return out;
}

/** Patch one `<dtel:label type="…">` text (inserting the labels block if absent). */
function patchLabel(xml: string, type: string, value: string): string {
  // 1) The label exists → replace its text, preserving prefix and attributes.
  const labelRe = new RegExp(
    `(<((?:[\\w.-]+):)?label\\b[^>]*?(?:[\\w.-]+:)?type\\s*=\\s*"${escape(type)}"[^>]*>)([\\s\\S]*?)</(?:[\\w.-]+:)?label\\s*>`,
  );
  const existing = labelRe.exec(xml);
  if (existing) {
    const prefix = existing[2] ? `${existing[2]}:` : '';
    return (
      xml.slice(0, existing.index) +
      `${existing[1]}${escape(value)}</${prefix}label>` +
      xml.slice(existing.index + existing[0].length)
    );
  }
  // 2) A labels block exists → append the label inside it (before its close).
  const labels = elementRange(xml, 'labels');
  if (labels && !labels.openTag.endsWith('/>')) {
    const insert = `<dtel:label type="${escape(type)}">${escape(value)}</dtel:label>`;
    const block = xml.slice(labels.start, labels.end);
    const patchedBlock = block.replace(/<\/([\w.-]+:)?labels\s*>$/, `${insert}</$1labels>`);
    return xml.slice(0, labels.start) + patchedBlock + xml.slice(labels.end);
  }
  // 3) No labels block at all → create one before the root close.
  return insertBeforeRootClose(xml, `<dtel:labels><dtel:label type="${escape(type)}">${escape(value)}</dtel:label></dtel:labels>`);
}
