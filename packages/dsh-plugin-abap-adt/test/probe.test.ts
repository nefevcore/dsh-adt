import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { startAdtStubServer } from './helpers/stub-server.ts';
import {
  candidateAdtUrls,
  pickVerifiedProbe,
  probeCandidateUrls,
  probeUrl,
  type UrlProbe,
} from '../lib/probe.js';

test('candidateAdtUrls: port-convention combos in preference order, deduped', () => {
  assert.deepEqual(candidateAdtUrls('h.example.com', '01'), [
    'https://h.example.com:44301',
    'https://h.example.com',
    'http://h.example.com:8001',
    'http://h.example.com',
  ]);
  // No instance number: only the default ports.
  assert.deepEqual(candidateAdtUrls('h.example.com', undefined), [
    'https://h.example.com',
    'http://h.example.com',
  ]);
});

test('probeUrl: HTTP 401 is reachable + ADT-likely (the expected unauthenticated answer)', async () => {
  const { server, port } = await startAdtStubServer(401);
  try {
    const probe = await probeUrl(`http://127.0.0.1:${port}`, { timeoutMs: 2000 });
    assert.equal(probe.reachable, true);
    assert.equal(probe.status, 401);
    assert.equal(probe.adtLikely, true);
    assert.match(probe.detail, /401/);
  } finally {
    server.close();
  }
});

test('probeUrl: 404 answers HTTP but is not ADT-likely; refused ports report why', async () => {
  // A port we control and CLOSE again — deterministically refused afterwards.
  const transient = createServer((_req, res) => res.end());
  await new Promise<void>((resolve) => transient.listen(0, '127.0.0.1', resolve));
  const deadPort = (transient.address() as AddressInfo).port;
  await new Promise<void>((resolve) => transient.close(() => resolve()));

  const { server, port } = await startAdtStubServer(404);
  try {
    const probe = await probeUrl(`http://127.0.0.1:${port}`, { timeoutMs: 2000 });
    assert.equal(probe.reachable, true);
    assert.equal(probe.status, 404);
    assert.equal(probe.adtLikely, false);
    assert.match(probe.detail, /404/);

    const dead = await probeUrl(`http://127.0.0.1:${deadPort}`, { timeoutMs: 2000 });
    assert.equal(dead.reachable, false);
    assert.equal(dead.adtLikely, false);
    assert.match(dead.detail, /refused/);
  } finally {
    server.close();
  }
});

test('pickVerifiedProbe: first ADT-likely wins over merely-reachable; undefined when nothing responds', () => {
  const mk = (url: string, reachable: boolean, adtLikely: boolean): UrlProbe => ({
    url,
    reachable,
    adtLikely,
    detail: reachable ? 'HTTP 404' : 'connection refused',
  });
  // Preference order is the candidate order, not adtLikely alone.
  assert.equal(
    pickVerifiedProbe([mk('a', true, false), mk('b', true, true), mk('c', true, true)])?.url,
    'b',
  );
  // Fallback: merely reachable when nothing is ADT-likely.
  assert.equal(pickVerifiedProbe([mk('a', false, false), mk('b', true, false)])?.url, 'b');
  assert.equal(pickVerifiedProbe([mk('a', false, false)]), undefined);
});

test('probeCandidateUrls: end-to-end — a live 80<nn> server is found among the four candidates', async () => {
  const { server, port } = await startAdtStubServer(401);
  const sysnr = String(port - 8000).padStart(2, '0');
  try {
    const probes = await probeCandidateUrls('127.0.0.1', sysnr, { timeoutMs: 2000 });
    assert.equal(probes.length, 4);
    const best = pickVerifiedProbe(probes);
    // The convention HTTP candidate is OUR server; the https candidates
    // cannot talk to a plain-HTTP endpoint.
    assert.equal(best?.url, `http://127.0.0.1:${port}`);
    assert.equal(best?.adtLikely, true);
    assert.equal(best?.status, 401);
  } finally {
    server.close();
  }
});
