/**
 * Persistent lock ledger — the plugin's memory of every ADT edit lock it has
 * acquired (per destination), so a later session can release locks left behind
 * by crashed or interrupted tool calls via `adt_unlock_all`.
 *
 * SAP ADT only returns a lock handle at LOCK time. If the process dies between
 * LOCK and UNLOCK (or a create auto-locks without returning a handle), the
 * enqueue lock survives on the backend and blocks later edits (HTTP 403 EU510)
 * until it is removed in SM12. Recording every acquired lock (and every object
 * a create may have auto-locked) in a file that survives process restarts gives
 * `adt_unlock_all` the object URIs (and handles when known) to clean up.
 *
 * The ledger file lives under `${DSH_HOME:-<homedir>/.dsh}/storages/abap-adt-locks.json`
 * — the DSH home's per-plugin storage area, one file per machine, so any
 * session on the same host can clean up after any other. A ledger left by an
 * older release at `${DSH_HOME}/abap-adt-locks.json` is migrated on first load.
 * All mutations are fire-and-forget (never fail a tool because the ledger
 * could not be persisted).
 */
import { randomUUID } from 'node:crypto';
import { copyFileSync, readFileSync, renameSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface LockEntry {
  /** Unique id of the entry. */
  id: string;
  /** Destination name the lock was acquired on. */
  destination: string;
  /** ADT object URI, e.g. /sap/bc/adt/oo/classes/zcl_demo. */
  uri: string;
  /** Object name (for human-readable reporting). */
  name?: string;
  /** Lock handle when the backend returned one. */
  handle?: string;
  /** Transport request the lock is assigned to, when reported. */
  transport?: string;
  /** When the lock was acquired (ISO). */
  acquiredAt: string;
  /** Why the handle may be missing (e.g. 'create auto-lock'). */
  note?: string;
}

/** Resolve the ledger file path inside the DSH storages area (never throws). */
export function ledgerFilePath(): string {
  try {
    const base = process.env.DSH_HOME || join(homedir(), '.dsh');
    return join(base, 'storages', 'abap-adt-locks.json');
  } catch {
    return join('.', 'storages', 'abap-adt-locks.json');
  }
}

/** Pre-storages ledger location used by earlier releases. */
function legacyLedgerFilePath(): string {
  try {
    const base = process.env.DSH_HOME || join(homedir(), '.dsh');
    return join(base, 'abap-adt-locks.json');
  } catch {
    return join('.', 'abap-adt-locks.json');
  }
}

/**
 * One-time migration from the pre-storages location: move the legacy ledger
 * into `storages/` when only the legacy file exists. Best effort — any failure
 * leaves the files untouched and the constructor simply starts from what it
 * can read.
 */
function migrateLegacyLedger(file: string): void {
  const legacy = legacyLedgerFilePath();
  if (legacy === file) return;
  try {
    if (!existsSync(legacy) || existsSync(file)) return;
    try {
      mkdirSync(dirname(file), { recursive: true });
      renameSync(legacy, file);
    } catch {
      copyFileSync(legacy, file);
    }
  } catch {
    // Never let ledger bookkeeping disturb the plugin.
  }
}

export class LockLedger {
  private entries: LockEntry[] = [];
  private readonly file: string;

  constructor(file = ledgerFilePath()) {
    this.file = file;
    migrateLegacyLedger(file);
    this.load();
  }

  private load(): void {
    try {
      if (existsSync(this.file)) {
        const parsed = JSON.parse(readFileSync(this.file, 'utf8')) as { entries?: LockEntry[] };
        if (Array.isArray(parsed.entries)) this.entries = parsed.entries;
      }
    } catch {
      // Corrupt/unreadable ledger → start empty; never crash the plugin.
      this.entries = [];
    }
  }

  private persist(): void {
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(this.file, JSON.stringify({ version: 1, entries: this.entries }, null, 2), 'utf8');
    } catch {
      // Fire-and-forget: an unwritable ledger must not break tool calls.
    }
  }

  /** Record a lock we acquired (or an object a create may have auto-locked). */
  register(entry: Omit<LockEntry, 'id' | 'acquiredAt'>): LockEntry {
    const full: LockEntry = {
      ...entry,
      id: randomUUID(),
      acquiredAt: new Date().toISOString(),
    };
    // Keep one entry per (destination, uri) — a re-lock replaces the old one.
    this.entries = this.entries.filter((e) => !(e.destination === entry.destination && e.uri === entry.uri));
    this.entries.push(full);
    this.persist();
    return full;
  }

  /** Drop the entry for a released lock. */
  deregister(destination: string, uri: string): void {
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => !(e.destination === destination && e.uri === uri));
    if (this.entries.length !== before) this.persist();
  }

  /** Every recorded lock for a destination. */
  forDestination(destination: string): LockEntry[] {
    return this.entries.filter((e) => e.destination === destination);
  }

  /** The recorded handle for one object (undefined when unknown). */
  handleFor(destination: string, uri: string): string | undefined {
    return this.entries.find((e) => e.destination === destination && e.uri === uri)?.handle;
  }

  /** All entries (for reporting). */
  all(): LockEntry[] {
    return [...this.entries];
  }
}
