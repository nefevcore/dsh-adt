// Probe: replay parseAtcResultBody against the real deloitte-kic ATC XML.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseXml, child, children, childText, attr } from '../packages/adt-protocol/lib/xml.js';

function severityFromPriority(priority) {
  switch (priority) {
    case 1: return 'CRITICAL';
    case 2: return 'ERROR';
    case 3: return 'WARNING';
    default: return 'INFO';
  }
}

function parseAtcResultBody(xml, displayId) {
  const emptyResult = () => ({
    success: true, clean: true, findings: [], durationMs: 0, displayId,
    counts: { INFO: 0, WARNING: 0, ERROR: 0, CRITICAL: 0, CATASTROPHIC: 0 },
    rawXml: xml,
  });
  const trimmed = xml.trimStart();
  if (!trimmed.startsWith('<')) return emptyResult();
  let root;
  try { root = parseXml(xml); } catch { return emptyResult(); }
  const result = child(root, 'result') ?? root;
  if (result.name === 'resultList' || child(root, 'result') || child(result, 'displayId') || child(result, 'objects')) {
    const findings = [];
    const counts = { INFO: 0, WARNING: 0, ERROR: 0, CRITICAL: 0, CATASTROPHIC: 0 };
    const objectsNode = child(result, 'objects');
    let objectCount = 0, findingCount = 0;
    for (const obj of children(objectsNode ?? result, 'object')) {
      objectCount++;
      const objectName = attr(obj, 'name') ?? '';
      const findingsNode = child(obj, 'findings');
      for (const finding of children(findingsNode ?? obj, 'finding')) {
        findingCount++;
        const priority = Number(attr(finding, 'priority') ?? 0);
        const severity = Number.isFinite(priority) ? severityFromPriority(priority) : 'INFO';
        const location = attr(finding, 'location') ?? '';
        const locMatch = /#start=(\d+)(?:,(\d+))?/.exec(location);
        counts[severity] = (counts[severity] ?? 0) + 1;
        findings.push({
          check: attr(finding, 'checkId') ?? '',
          checkTitle: attr(finding, 'checkTitle') ?? '',
          severity,
          message: attr(finding, 'messageTitle') ?? attr(finding, 'messageId') ?? '',
          objectName,
          uri: attr(finding, 'uri') ?? '',
          line: locMatch ? Number(locMatch[1]) : undefined,
          offset: locMatch && locMatch[2] ? Number(locMatch[2]) : undefined,
          messageId: attr(finding, 'messageId'),
        });
      }
    }
    const clean = counts.ERROR + counts.CRITICAL + counts.CATASTROPHIC === 0;
    return {
      success: true, clean, findings, counts,
      durationMs: 0,
      displayId: displayId ?? childText(result, 'displayId') ?? undefined,
      title: childText(result, 'title') ?? undefined,
      checkVariant: childText(result, 'checkVariant') ?? undefined,
      objectCount, findingCount,
    };
  }
  return emptyResult();
}

const file = path.join(os.tmpdir(), 'atc_raw.xml');
const xml = fs.readFileSync(file, 'utf8');
const out = parseAtcResultBody(xml, '59D32AF578641FE1A4A7D80456A5084F');
console.log(JSON.stringify({
  title: out.title,
  checkVariant: out.checkVariant,
  clean: out.clean,
  counts: out.counts,
  objectCount: out.objectCount,
  findingCount: out.findingCount,
  firstFindings: out.findings.slice(0, 3).map((f) => ({
    objectName: f.objectName, severity: f.severity, check: f.check, checkTitle: f.checkTitle,
    message: f.message, line: f.line,
  })),
}, null, 2));
