/**
 * pages/monero/legality/status.ts — pure derivation over LEGALITY_MATRIX.
 * Zero React. Every number the UI shows (counts, headlines, filter results)
 * is computed here so nothing on the page is a hand-typed literal.
 */

import { ACTIVITIES, ALIASES } from "./data";
import type { ActivityKey, ActivityStatus, MatrixRow } from "./data";

// ── Severity ─────────────────────────────────────────────────────────────────
//
// Severity ordering rationale: `unclear` ranks BELOW `restricted`. The
// headline answers "how free am I here?". `restricted` is a known, enforced
// constraint (licensing, reporting thresholds, actual delistings); `unclear`
// is the *absence* of a rule. Ranking `unclear` higher would headline India
// (30% tax, CEXs merely don't list) as worse than Russia (payments outright
// prohibited) — plainly wrong.
export const SEVERITY: Record<ActivityStatus, number> = {
  legal: 0,
  unclear: 1,
  restricted: 2,
  illegal: 3,
};

/**
 * The non-hue channel. Colour alone never carries a status here: every chip also
 * renders the status WORD, and the marker beside it differs by SHAPE. Two readers
 * need this — anyone who cannot separate the green/amber/red trio, and anyone
 * reading a greyscale or high-contrast render, where `--g-50` and `--y-50`
 * collapse to neighbouring greys.
 *
 * Kept here as a TOKEN rather than a style object so this module stays framework-
 * free (see the file header); `StatusMark` in StatusChip.tsx owns the one mapping
 * from token to geometry, so the legend and the matrix cannot teach different
 * vocabularies.
 */
export type StatusShape = "disc" | "ring" | "diamond" | "square";

export const STATUS_META: Record<ActivityStatus, { c: string; label: string; shape: StatusShape }> = {
  legal:      { c: "var(--g-50)",   label: "Legal",      shape: "disc" },
  unclear:    { c: "var(--ink-60)", label: "Unclear",    shape: "ring" },
  restricted: { c: "var(--y-50)",   label: "Restricted", shape: "diamond" },
  illegal:    { c: "var(--r-50)",   label: "Illegal",    shape: "square" },
};

// ── Headline ─────────────────────────────────────────────────────────────────

export interface Headline {
  status: ActivityStatus;
  keys: ActivityKey[];
  reason: string;
}

const STATUS_WORD: Record<ActivityStatus, string> = {
  legal: "Legal",
  unclear: "Unclear",
  restricted: "Restricted",
  illegal: "Illegal",
};

/**
 * Reduces over ACTIVITIES in declaration order, so ties resolve to `hold`
 * before `cex` — deliberate, the more fundamental freedom leads. `reason`
 * names the tied activity/activities: e.g. "Illegal · CEX trade". This is
 * load-bearing — a bare "ILLEGAL" headline would contradict the page's own
 * thesis, since most "illegal" headlines are one activity, not five.
 */
export function headlineOf(row: MatrixRow): Headline {
  let worst = SEVERITY.legal;
  for (const a of ACTIVITIES) {
    const s = SEVERITY[row[a.key]];
    if (s > worst) worst = s;
  }
  const status = (Object.keys(SEVERITY) as ActivityStatus[]).find((k) => SEVERITY[k] === worst)!;
  const keys = ACTIVITIES.filter((a) => SEVERITY[row[a.key]] === worst).map((a) => a.key);

  // Naming every one of five would make China's chip four times the length of
  // everyone else's, for the one row where "all five" is the whole point.
  const named =
    keys.length === ACTIVITIES.length
      ? "all five activities"
      : ACTIVITIES.filter((a) => keys.includes(a.key)).map((a) => a.long).join(" · ");

  const reason =
    status === "legal"
      ? "Legal for all five"
      : `${STATUS_WORD[status]} · ${named}`;

  return { status, keys, reason };
}

// ── Summary ──────────────────────────────────────────────────────────────────

export interface Summary {
  total: number;
  counts: Record<ActivityStatus, number>;
  activityLegal: Record<ActivityKey, number>;
}

/** Counts headline status per row, so the four counts sum to `total` by construction. */
export function summarize(rows: readonly MatrixRow[]): Summary {
  const counts: Record<ActivityStatus, number> = { legal: 0, unclear: 0, restricted: 0, illegal: 0 };
  const activityLegal: Record<ActivityKey, number> = { hold: 0, cex: 0, p2p: 0, mine: 0, pay: 0 };

  for (const row of rows) {
    counts[headlineOf(row).status]++;
    for (const a of ACTIVITIES) {
      if (row[a.key] === "legal") activityLegal[a.key]++;
    }
  }

  return { total: rows.length, counts, activityLegal };
}

// ── Review dates ──────────────────────────────────────────────────────────────

export interface ReviewRange {
  oldest: string;
  newest: string;
  count: number;
}

/**
 * Oldest/newest over the rows' own `reviewed` dates, so the page-level line is
 * DERIVED and cannot drift from the rows it summarises — the same discipline
 * `summarize()` applies to the status counts.
 *
 * String comparison is exact here, not a shortcut: `reviewed` is ISO `YYYY-MM-DD`
 * (asserted by the gate), and ISO dates are lexicographically ordered iff they are
 * chronologically ordered. No `Date` is constructed, so no timezone can shift a
 * date across a day boundary between the row and the summary.
 */
export function reviewRange(rows: readonly MatrixRow[]): ReviewRange | null {
  if (rows.length === 0) return null;
  let oldest = rows[0].reviewed;
  let newest = rows[0].reviewed;
  for (const r of rows) {
    if (r.reviewed < oldest) oldest = r.reviewed;
    if (r.reviewed > newest) newest = r.reviewed;
  }
  return { oldest, newest, count: rows.length };
}

// ── Search + filter ───────────────────────────────────────────────────────────

export function matches(row: MatrixRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (row.n.toLowerCase().includes(needle)) return true;
  if (row.note.toLowerCase().includes(needle)) return true;
  const aliases = ALIASES[row.n];
  if (aliases && aliases.some((a) => a.toLowerCase().includes(needle))) return true;
  return false;
}

export function applyFilters(
  rows: readonly MatrixRow[],
  q: string,
  active: ReadonlySet<ActivityStatus>,
): MatrixRow[] {
  return rows.filter((row) => {
    if (!matches(row, q)) return false;
    if (active.size > 0 && !active.has(headlineOf(row).status)) return false;
    return true;
  });
}
