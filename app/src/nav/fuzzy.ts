/**
 * nav/fuzzy.ts — the ⌘K palette's fuzzy scorer.
 *
 * `fuzzy()` below is copied VERBATIM (algorithm and constants; only the
 * language changed JS → TS) from docs/v6-mockups/nav-ia-mockup.html's own
 * `fuzzy(q, s)` — that file is read-only and its INVENTORY is fiction, but
 * its scoring function is the spec for this one. Do not "improve" the
 * constants below without re-reading that file first; verify-palette.mjs
 * asserts a specific ranking outcome (§ below) that depends on them exactly
 * as written.
 *
 * ── THE ALGORITHM ─────────────────────────────────────────────────────────
 * Per matched character: +1, plus `streak * 2` (streak = consecutive-match
 * run length, reset to 0 on any non-match), plus +4 if the character sits at
 * haystack index 0 or immediately follows a literal boundary character
 * (' /·-+' — a space, slash, middle dot, hyphen or plus). A query that is
 * not a full subsequence of the haystack returns `null`.
 *
 * ── THE WORD-START PREFIX BONUS ─────────────────────────────────────────────
 * A bare subsequence score is not the same as what someone meant. Typing
 * "sim" matches "Sediment" (s·i·m scattered through the word) exactly as
 * well, mechanically, as it matches "Simulators" — only one of those is the
 * intent. So after the subsequence pass, the haystack is split on
 * `/[\s/·+—-]+/` and the FIRST word that `startsWith(q)` adds +40, plus a
 * further +25 if that word equals `q` exactly; `break` after the first hit
 * (only one word ever contributes the bonus, whichever comes first).
 * verify-palette.mjs's ranking assertion exists specifically to prove this
 * bonus is wired in — without it, "sim" would rank *Sediment* above
 * *Simulators*.
 */

export interface FuzzyMatch {
  /** Higher is a better match. Not comparable across different haystacks of
   *  different lengths in any absolute sense — only used to rank candidates
   *  against the SAME query. */
  score: number;
  /** Haystack character indices the query matched, in order — the label
   *  match's `idx` is what a caller highlights; the section match's is
   *  unused (see `rankDestinations` below). */
  idx: number[];
}

/** Literal boundary character set, verbatim from the mockup — a match right
 *  after one of these reads as "the start of a word", not a mid-word hit. */
const BOUNDARY = " /·-+";

/** Word-separator regex used only for the prefix bonus pass, verbatim from
 *  the mockup (note this set is a superset of BOUNDARY: it adds an em dash
 *  and treats runs of separators as one split, where BOUNDARY tests a single
 *  preceding character). Kept as two different, deliberately non-unified
 *  constants because the mockup itself never unified them — matching it
 *  exactly is the point of a verbatim port. */
const WORD_SPLIT = /[\s/·+—-]+/;

export function fuzzy(q: string, s: string): FuzzyMatch | null {
  if (!q) return { score: 0, idx: [] };
  const query = q.toLowerCase();
  const t = s.toLowerCase();
  let qi = 0;
  let score = 0;
  let streak = 0;
  const idx: number[] = [];
  for (let i = 0; i < t.length && qi < query.length; i++) {
    if (t[i] === query[qi]) {
      idx.push(i);
      score += 1 + streak * 2 + (i === 0 || BOUNDARY.includes(t[i - 1]) ? 4 : 0);
      streak++;
      qi++;
    } else {
      streak = 0;
    }
  }
  if (qi !== query.length) return null;

  for (const w of t.split(WORD_SPLIT)) {
    if (w.startsWith(query)) {
      score += 40 + (w === query ? 25 : 0);
      break;
    }
  }
  return { score, idx };
}

/**
 * rankDestinations — the palette's search step, built on `fuzzy()` above.
 * Not part of the mockup's own code (its `palSearch` is inline in the
 * `<script>` block) but the same shape: § numbers below match the task
 * brief's §1 bullets so the two are easy to cross-check.
 *
 * Every candidate carries a label (`l`) and a group/section name (`sec`).
 * A row survives if EITHER the label or the section matches the query;
 * score is `(label match score * 3) + (section match score)` — the label is
 * weighted 3x because it is what the user is actually looking for; the
 * section only breaks ties and surfaces a row when someone types a section
 * name ("learn", "future") rather than a destination name. Highlight
 * indices come from the LABEL match only — nothing highlights inside the
 * (unrendered, in the palette row) section string.
 *
 * Cap: 40 results with a non-empty query, 12 with an empty one (empty-query
 * fuzzy() always returns `{score:0, idx:[]}`, so every candidate "matches"
 * at score 0 and a STABLE sort — guaranteed by the spec since ES2019 — keeps
 * insertion order, i.e. the first 12 items of `items` as given).
 */
export interface FuzzyRankable {
  readonly l: string;
  readonly sec: string;
}
export type RankedResult<T extends FuzzyRankable> = T & { score: number; idx: number[] };

export function rankDestinations<T extends FuzzyRankable>(
  q: string,
  items: readonly T[],
): RankedResult<T>[] {
  const results: RankedResult<T>[] = [];
  for (const item of items) {
    const a = fuzzy(q, item.l);
    const b = fuzzy(q, item.sec);
    if (!a && !b) continue;
    const score = (a ? a.score * 3 : 0) + (b ? b.score : 0);
    results.push({ ...item, score, idx: a ? a.idx : [] });
  }
  results.sort((x, y) => y.score - x.score);
  return results.slice(0, q ? 40 : 12);
}
