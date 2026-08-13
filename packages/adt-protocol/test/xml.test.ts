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
