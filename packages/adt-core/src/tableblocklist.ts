/**
 * Read-side sensitive-table blocklist — the READ complement to the write-side
 * policy knobs (see policy.ts). Row-returning reads (`adt_data_preview`
 * entity + freestyle SQL paths) resolve the target table names BEFORE any
 * request is sent and refuse blocked tables with the category and reason,
 * so both the agent and the human learn WHY a table is off limits.
 *
 * Semantics adopted from abap-mcp's tableBlocklist (deny is never bypassable)
 * with one deliberate simplification: every built-in entry is a hard DENY —
 * there is no `acknowledge_risk` per-call escape. The sanctioned bypass is
 * the config-level `allowedTables` exemption, which is applied per
 * destination and surfaces an audit note in the tool output (and the plugin
 * logger) on every use.
 *
 * Profiles (tiers are inclusive: each tier adds the previous ones):
 *   - `minimal`  — direct PII: banking, customer/vendor/BP master, addresses,
 *                  authentication/authorization, HR/payroll, tax IDs
 *   - `standard` — minimal + transactional data with linked PII (SD/MM/FI
 *                  documents, change documents, long texts)
 *   - `strict`   — standard + audit/security logs, communication & workflow
 *                  payloads, and the customer namespace pattern `Z*`
 *   - `off`      — no read-side governance (the default; opt-in)
 *
 * Patterns use `*` as a SAP-name wildcard (`[A-Z0-9_]*`), matched
 * case-insensitively — the same alphabet real table names are built from.
 *
 * This module is intentionally dependency-free (pure catalog + logic) so it
 * can be unit-tested without any SAP system.
 */

/** The four read-side profiles (`off` disables the whole mechanism). */
export type BlockedTableProfile = 'off' | 'minimal' | 'standard' | 'strict';

/** Inclusive tier order: minimal ⊂ standard ⊂ strict. */
const TIER_ORDER: Record<Exclude<BlockedTableProfile, 'off'>, number> = {
  minimal: 1,
  standard: 2,
  strict: 3,
};

/** One catalog entry: what the category protects and since which tier. */
export interface BlockedTableEntry {
  category: string;
  tier: Exclude<BlockedTableProfile, 'off'>;
  why: string;
  /** Exact names and `*` patterns (compiled below). */
  names: string[];
}

/**
 * The built-in catalog, by category + tier + why (structure follows abap-mcp's
 * RawEntry: every entry must carry an educational reason — a bare name list
 * teaches nobody why a read was refused).
 */
const CATALOG: BlockedTableEntry[] = [
  {
    category: 'Banking / payment data',
    tier: 'minimal',
    why: 'bank account numbers, payment cards, payment run results',
    names: [
      'BNKA', 'KNBK', 'LFBK', 'BUT0BK', 'T012K', 'REGUH', 'REGUP', 'PAYR',
      'FPLT', 'FPLTC', 'CCARD', 'TCRCO', 'BSEGC', 'FPAYH', 'FPAYHX', 'FPAYP', 'FPAYPX',
    ],
  },
  {
    category: 'Customer / vendor / BP master PII',
    tier: 'minimal',
    why: 'names, contact persons, tax registrations, business-partner core PII',
    names: [
      'KNA1', 'KNB1', 'KNVK', 'KNVV', 'KNVL',
      'LFA1', 'LFB1', 'LFM1', 'LFM2',
      'BUT000', 'BUT020', 'BUT021', 'BUT021_FS', 'BUT050', 'BUT051', 'BUT100', 'BUT0ID',
    ],
  },
  {
    category: 'Addresses / communication data',
    tier: 'minimal',
    why: 'street addresses, phone, fax, e-mail, URLs — personal contact PII',
    names: [
      'ADRC', 'ADRP', 'ADR2', 'ADR3', 'ADR6', 'ADR7', 'ADR9', 'ADR11', 'ADR12', 'ADR13', 'ADRT', 'ADRCT',
    ],
  },
  {
    category: 'Authentication / authorization / security',
    tier: 'minimal',
    why: 'password hashes, permission values, RFC destinations with credentials, crypto key material',
    names: [
      'USR02', 'USH02', 'USRBF2', 'USR01', 'USR04', 'USR10', 'USR12', 'USR21', 'USR22',
      'USR40', 'USR41', 'USR_CUST',
      'AGR_1251', 'AGR_USERS', 'AGR_AGRS', 'PRGN_CUST',
      'RFCDES', 'RSECACTB', 'RSECTAB', 'SNCSYSACL', 'SSF_PSE_D',
    ],
  },
  {
    category: 'HR / payroll / personnel data',
    tier: 'minimal',
    why: 'employee PII, salary, payroll results, org-assignment and medical data',
    names: [
      'PA*', 'PB9*', 'PD9*', 'HRP*',
      'PCL1', 'PCL2', 'PCL3', 'PCL4', 'PCL5',
      'T526',
    ],
  },
  {
    category: 'Tax / government IDs',
    tier: 'minimal',
    why: 'tax numbers, VAT registrations, national ID references',
    names: [
      'DFKKBPTAXNUM', 'TFKTAXNUMTYPE', 'J_1BTXIC3', 'J_1BNFDOC', 'KNAS', 'LFAS', 'BUT0TX',
    ],
  },
  {
    category: 'Protected business data',
    tier: 'standard',
    why: 'transactional documents with linked customer/vendor references (sales, purchasing, accounting), change documents and long texts',
    names: [
      'VBRK', 'VBRP', 'VBAK', 'VBAP', 'VBPA',
      'EKKO', 'EKPO',
      'BKPF', 'BSEG', 'ACDOCA', 'FAGLFLEXA', 'FAGLFLEXT',
      'CDHDR', 'CDPOS', 'STXH', 'STXL',
    ],
  },
  {
    category: 'Audit / security logs',
    tier: 'strict',
    why: 'application log payloads and user activity traces can contain PII in message variables',
    names: [
      'BALDAT', 'BALHDR', 'SLG1', 'SLGD', 'RSAU_BUF_DATA', 'SNAP', 'SMONI',
      'SWNCMONI', 'SWNCT*', 'STAD', 'STATTRACE', 'DBTABLOG',
    ],
  },
  {
    category: 'Communication & workflow',
    tier: 'strict',
    why: 'mail bodies, workflow contexts, broadcast records — free-text content',
    names: [
      'SOOD', 'SOC3', 'SOST', 'SOFM', 'SWWWIHEAD', 'SWWCONT', 'SWWLOGHIST', 'BCST_SR', 'BCST_CAM',
    ],
  },
  {
    category: 'Customer namespace (Z*) data',
    tier: 'strict',
    why: 'custom tables frequently hold customer-specific PII — exempt individual tables via allowedTables',
    names: ['Z*'],
  },
];

/** A matched block: table plus the educational entry that matched it. */
export interface BlockedTableHit {
  table: string;
  category: string;
  tier: Exclude<BlockedTableProfile, 'off'>;
  why: string;
}

/** Compile a SAP-name glob: `*` → `[A-Z0-9_]*`, case-insensitive full match. */
export function tableGlobToRegExp(pattern: string): RegExp {
  const source = pattern
    .toUpperCase()
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[A-Z0-9_]*');
  return new RegExp(`^${source}$`, 'i');
}

interface CompiledEntry extends BlockedTableEntry {
  exact: Set<string>;
  patterns: RegExp[];
}

const COMPILED: CompiledEntry[] = CATALOG.map((entry) => {
  const exact = new Set<string>();
  const patterns: RegExp[] = [];
  for (const raw of entry.names) {
    if (raw.includes('*')) patterns.push(tableGlobToRegExp(raw));
    else exact.add(raw.toUpperCase());
  }
  return { ...entry, exact, patterns };
});

/**
 * Find the catalog entry that blocks `table` under the given profile
 * (custom `extra` patterns are checked FIRST — user additions outrank the
 * built-in catalog and always report the user-extended category).
 */
export function findBlockedTable(
  table: string,
  profile: BlockedTableProfile,
  extra: readonly string[] = [],
): BlockedTableHit | null {
  if (profile === 'off') return null;
  const upper = table.toUpperCase();
  for (const pattern of extra) {
    if (pattern === '*' || tableGlobToRegExp(pattern).test(upper)) {
      return {
        table: upper,
        category: 'User-extended blocklist',
        tier: 'minimal',
        why: 'listed in the blockedTables config of this destination',
      };
    }
  }
  const maxTier = TIER_ORDER[profile];
  for (const entry of COMPILED) {
    if (TIER_ORDER[entry.tier] > maxTier) continue;
    if (entry.exact.has(upper) || entry.patterns.some((p) => p.test(upper))) {
      return { table: upper, category: entry.category, tier: entry.tier, why: entry.why };
    }
  }
  return null;
}

/**
 * Extract candidate table names from a freestyle SQL SELECT: every
 * `FROM <t>` / `JOIN <t>` operand without a schema qualifier. Over-approximates
 * on purpose (subqueries included) — a read-governance extractor must never
 * miss a table, a false positive only costs a lookup in the catalog.
 */
export function extractTablesFromSql(sql: string): string[] {
  const found = new Set<string>();
  for (const match of sql.matchAll(/\b(?:from|join)\s+([A-Za-z0-9_/.~]+)/gi)) {
    found.add(match[1]!.toUpperCase());
  }
  return [...found];
}
