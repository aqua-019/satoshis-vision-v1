/**
 * pages/network/bands.ts — threshold-band arithmetic for /live/network (D0832).
 *
 * PURE. No React, no DOM, no feed types. Every export is a function of numbers
 * in and numbers out, so `verify-bands.mjs` can import it under bare Node and
 * assert the arithmetic without a browser.
 *
 * ── WHY EVERY BAND CARRIES ITS OWN SOURCE STRING ──────────────────────
 *
 * An undocumented band is a coloured rectangle asserting authority it has not
 * earned, and a MISLABELLED one is worse: it earns the authority and spends it
 * on a claim the data does not support. So a `Band` is not `{lo, hi}` — it is
 * `{lo, hi, source}`, and `source` is the sentence the panel prints under the
 * chart. There is no constructor that lets you skip it.
 *
 * Two of the three bands below were CORRECTED against the in-repo mockup
 * (`docs/v6-mockups/markets-network-mockup.html`, NETWORK TAB) rather than
 * copied from it. The mockup's series are seeded placeholders — its own header
 * says so — and two of its bands are true of seeded data and false of this
 * chain. The corrections are recorded on each function.
 *
 * ── THE WINDOW IS PART OF THE CLAIM ───────────────────────────────────
 *
 * `sigmaBand` takes `n` and puts it in the source string, because a ±1σ
 * envelope over 100 blocks and one over 30 days are different claims and only
 * one of them is available here. What this site actually has client-side is
 * `/api/xmr/blocks?limit=100` (`data/xmrirish-feed.ts`, `BLOCKS_CAP = 100`) —
 * 100 block headers, which at the 120 s target is about 3.3 hours.
 *
 * UPDATED IN p3·14b — the sentence that stood here said "Nothing in `app/`
 * fetches `/api/xmr/network/difficulty` or `/network/hashrate`; they are
 * unconsumed server surface." That was measured and true when it was written,
 * and this PR made half of it false: `StreamPanel` now seeds from
 * `/api/xmr/network/difficulty`. A docblock asserting an absence is a claim
 * with a shelf life, and this one was load-bearing — it is the justification
 * for `bandWindowLabel` existing at all.
 *
 * What is true now: the difficulty history endpoint IS consumed, one seed
 * request per mount, and `/network/hashrate` remains unconsumed (it reports
 * difficulty ÷ the target, so consuming both would be fetching one measurement
 * twice). The deepest window that endpoint can serve is 720 blocks — ONE DAY —
 * because monerod rejects a `get_block_headers_range` spanning more than
 * `RESTRICTED_BLOCK_HEADER_RANGE` (1000) on a restricted node, and every node
 * in this site's cascade is restricted.
 *
 * So a "trailing 30-day envelope" is STILL not a band this page can draw — the
 * ceiling moved from 3.3 hours to 24, not to 30 days — and `bandWindowLabel`
 * exists to make the true window impossible to omit from the label. The window
 * now comes from the server's own `window_seconds`, never from a literal.
 */

/** Monero's consensus block target, in seconds. Not a tuning constant — this
 *  is protocol, and it is the SOURCE of the cadence band rather than an input
 *  to it. Named here once so no band writes a bare 120. */
export const BLOCK_TARGET_S = 120;

/** Which zone a reading falls in. Ordered by severity for `worstZone`. */
export type BandZone = "healthy" | "warn" | "critical";

const ZONE_RANK: Record<BandZone, number> = { healthy: 0, warn: 1, critical: 2 };

/**
 * A two-sided band with an explicit provenance sentence.
 *
 * `lo`/`hi` bound the healthy zone. `warnLo`/`warnHi` bound the warn zone;
 * `null` on a side means that side never escalates past warn — which is a real
 * case, not a placeholder: a mempool that is emptier than expected is not a
 * fault, and a chain running FAST is not a fault either.
 */
export interface Band {
  lo: number;
  hi: number;
  warnLo: number | null;
  warnHi: number | null;
  /** Printed under the chart, verbatim. Never empty. */
  source: string;
}

/** Classify one reading against a band. */
export function classify(v: number, b: Band): BandZone {
  if (!Number.isFinite(v)) return "healthy";
  if (v >= b.lo && v <= b.hi) return "healthy";
  if (v < b.lo) return b.warnLo != null && v < b.warnLo ? "critical" : "warn";
  return b.warnHi != null && v > b.warnHi ? "critical" : "warn";
}

/** Worst zone across several readings — the page-header health summary. */
export function worstZone(zones: BandZone[]): BandZone {
  return zones.reduce<BandZone>((acc, z) => (ZONE_RANK[z] > ZONE_RANK[acc] ? z : acc), "healthy");
}

/**
 * Human label for a block count, as a wall-clock approximation at the target.
 * Used inside every source string so a window can never be quoted in blocks
 * alone — "100 blocks" means nothing to a reader who does not know the target.
 */
export function bandWindowLabel(nBlocks: number): string {
  const secs = nBlocks * BLOCK_TARGET_S;
  if (secs < 5400) return `${nBlocks} blocks ≈ ${Math.round(secs / 60)} min`;
  if (secs < 172800) return `${nBlocks} blocks ≈ ${(secs / 3600).toFixed(1)} h`;
  return `${nBlocks} blocks ≈ ${(secs / 86400).toFixed(1)} days`;
}

/**
 * THE CADENCE BAND — and the one place this page departs hardest from the
 * mockup, on arithmetic rather than taste.
 *
 * The mockup prints "Healthy 96–150s · warn 150–200s · critical >200s —
 * derived from the 120s target and observed variance". Those numbers are a
 * defensible band for the MEAN of about a hundred intervals and a badly wrong
 * one for a SINGLE interval, because Monero block arrivals are a Poisson
 * process: inter-arrival times are exponential with mean 120 s, and an
 * exponential is memoryless, not clustered about its mean.
 *
 * Applied per-block, that band classifies a perfectly healthy chain as:
 *
 *   P(interval > 150 s) = e^(−150/120) = 0.2865   → 28.7% "warn or worse"
 *   P(interval > 200 s) = e^(−200/120) = 0.1889   → 18.9% "CRITICAL"
 *   P(interval <  96 s) = 1 − e^(−96/120) = 0.5507 → 55.1% below "healthy"
 *   ⇒ only 16.3% of blocks land inside the "healthy" band.
 *
 * A band that paints a fifth of a healthy chain red has not measured health,
 * it has measured the exponential distribution. So the per-tick strip draws NO
 * health band (see `CadenceStrip`) and the band goes on the aggregate, where
 * the Central Limit Theorem makes it exact:
 *
 *   the mean of n exponential(τ) samples has σ = τ/√n
 *
 * At n = 100 that is 12 s, and 120 ± 2σ = [96, 144] — which is, to within the
 * rounding, the very interval the mockup drew. The mockup's numbers were right
 * about the wrong quantity; this restores the quantity.
 *
 * `k` is the half-width in standard deviations. 2σ is the healthy edge and 3σ
 * the warn edge, so "critical" means a mean that a healthy chain produces
 * about 0.3% of the time — rare enough to be worth a colour.
 */
export function cadenceBand(n: number): Band {
  const safeN = Math.max(1, Math.floor(n));
  const sigma = BLOCK_TARGET_S / Math.sqrt(safeN);
  const r1 = (x: number) => Math.round(x);
  return {
    lo: r1(BLOCK_TARGET_S - 2 * sigma),
    hi: r1(BLOCK_TARGET_S + 2 * sigma),
    /* A chain running FAST is not a fault — it means hashrate arrived and the
       retarget has not caught up yet. It gets a warn tint so the asymmetry is
       visible, and never escalates. */
    warnLo: null,
    warnHi: r1(BLOCK_TARGET_S + 3 * sigma),
    source:
      `Band is ±2σ about the ${BLOCK_TARGET_S} s consensus target, σ = ${BLOCK_TARGET_S}/√n = ` +
      `${sigma.toFixed(1)} s over n=${safeN} intervals — block arrivals are Poisson, so the ` +
      `spread of the MEAN is what a target can be judged against; a single interval cannot be.`,
  };
}

/**
 * A ±1σ envelope measured over the window actually held, with the window in
 * the sentence. This is the honest form of the mockup's "trailing 30-day ±1σ
 * envelope": the shape is the same, the window is the one the data covers.
 *
 * Returns `null` on fewer than `MIN_SIGMA_SAMPLES` samples rather than a band
 * built from two points — a σ over n=2 is noise wearing a Greek letter.
 */
export const MIN_SIGMA_SAMPLES = 8;

export function sigmaBand(series: number[], label: string, k = 1): Band | null {
  const xs = series.filter(Number.isFinite);
  if (xs.length < MIN_SIGMA_SAMPLES) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  /* Sample standard deviation (n−1). The population form would understate the
     spread of a short window, which is exactly the window this page has. */
  const varSum = xs.reduce((a, b) => a + (b - mean) * (b - mean), 0);
  const sigma = Math.sqrt(varSum / (xs.length - 1));
  return {
    lo: mean - k * sigma,
    hi: mean + k * sigma,
    warnLo: mean - 2 * k * sigma,
    warnHi: mean + 2 * k * sigma,
    /* States what IS true and does not argue with the mockup. An earlier draft
       ended "— not a 30-day envelope", which reads as candour and is a trap: a
       label that NAMES a window it is not is still a label with that window in
       it, and `verify-bands` §3 (rightly) could not tell the disclaimer from
       the claim. The argument belongs in this file's header, where it is. */
    source:
      `Band is ±${k}σ about the mean of the last ${label} — ${xs.length} samples, measured from ` +
      `the node's own block headers over the window this page actually holds.`,
  };
}

/**
 * MEMPOOL BACKLOG, in blocks rather than bytes — the one framing where the
 * threshold is the node's own number instead of a chosen one.
 *
 * `limitBytes` is the node-reported dynamic block weight limit. A backlog under
 * one block clears next block; over one block, somebody waits; over three, the
 * wait is long enough that the fee market is doing real work. The threshold's
 * source is therefore the node, and the reading is a ratio the reader can check
 * against the two numbers printed beside it.
 *
 * Returns `null` when the node has not published a limit — a backlog measured
 * against a guessed capacity is a fabricated reading.
 */
export function backlogBand(limitBytes: number): Band | null {
  if (!Number.isFinite(limitBytes) || limitBytes <= 0) return null;
  return {
    lo: 0,
    hi: 1,
    warnLo: null,
    warnHi: 3,
    source:
      `Depth is mempool bytes ÷ the node's own dynamic block weight limit ` +
      `(${Math.round(limitBytes).toLocaleString()} B). Under 1 block clears next block; over 3 ` +
      `the backlog outlives several. The divisor is node-reported, not assumed.`,
  };
}

/**
 * Mean of a numeric series, or `null` when there is nothing to average.
 * `null` rather than 0 on purpose: 0 is a reading and "no samples" is not.
 */
export function meanOf(xs: number[]): number | null {
  const f = xs.filter(Number.isFinite);
  if (!f.length) return null;
  return f.reduce((a, b) => a + b, 0) / f.length;
}
