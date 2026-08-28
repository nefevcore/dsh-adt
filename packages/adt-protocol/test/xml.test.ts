import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseXml, child, children, childText, attr } from '../lib/xml.js';

test('parses namespaced elements and attributes', () => {
  const xml = `<?xml version="1.0"?>
<adt:object xmlns:adt="http://www.sap.com/adt" uri="/x" type="CLAS/OC" name="ZCL_DEMO">
  <abap:code>CLASS zcl_demo DEFINITION.</abap:code>
  <adt:property key="a" value="1"/>
  <adt:property key="b" value="2"/>
</adt:object>`;
  const root = parseXml(xml);
  assert.equal(root.name, 'object');
  assert.equal(attr(root, 'uri'), '/x');
  assert.equal(attr(root, 'type'), 'CLAS/OC');
  const code = child(root, 'code');
  assert.ok(code);
  assert.equal(code?.text, 'CLASS zcl_demo DEFINITION.');
  assert.equal(children(root, 'property').length, 2);
  assert.equal(childText(root, 'property'), ''); // no text → empty string
});

test('parses CDATA and entities', () => {
  const xml = `<root><a><![CDATA[if x < 3 && y > 2]]></a><b>AT&amp;T &lt;x&gt;</b></root>`;
  const root = parseXml(xml);
  assert.equal(childText(root, 'a'), 'if x < 3 && y > 2');
  assert.equal(childText(root, 'b'), 'AT&T <x>');
});

test('parses self-closing and nested elements', () => {
  const xml = `<runResult overall="SUCCESS"><class name="LTCL_ADD" status="PASSED"><method name="M1" status="PASSED"/></class></runResult>`;
  const root = parseXml(xml);
  assert.equal(attr(root, 'overall'), 'SUCCESS');
  const cls = child(root, 'class');
  assert.equal(attr(cls, 'name'), 'LTCL_ADD');
  assert.equal(children(cls, 'method').length, 1);
});

test('rejects mismatched closing tags', () => {
  assert.throws(() => parseXml('<a><b></a></b>'), /mismatched closing tag/);
});

test('rejects unterminated element', () => {
  assert.throws(() => parseXml('<a><b>text'), /unterminated/);
});

test('DOCTYPE with a quoted ">" inside the system id parses (audit P3)', () => {
  const doc = parseXml(`<!DOCTYPE r SYSTEM "a>b"><r><x>1</x></r>`);
  assert.equal(doc.name, 'r');
  assert.equal(childText(doc, 'x'), '1');
});

test('deeply nested input is rejected with a clear error, not a stack overflow (audit P3)', () => {
  const depth = 2000;
  const hostile = '<a>'.repeat(depth) + '</a>'.repeat(depth);
  assert.throws(() => parseXml(hostile), /exceeds 500|nesting/);
});

test('invalid character references degrade to U+FFFD instead of RangeError (audit P3)', () => {
  const doc = parseXml('<r><a>&#x110000;</a><b>&#0;</b><c>&#xD800;</c></r>');
  assert.equal(childText(doc, 'a'), '\u{FFFD}');
  assert.equal(childText(doc, 'b'), '\u{FFFD}');
  assert.equal(childText(doc, 'c'), '\u{FFFD}');
  // Valid references still decode (text of the ROOT element here).
  assert.equal(parseXml('<r>&#65;</r>').text, 'A');
});
