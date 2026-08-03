#!/usr/bin/env node
/**
 * verify-hero.mjs — the v6.1.8 rotating hero passages (static source gate).
 *
 * ── WHY TWO ASSERTIONS PER PASSAGE AND NOT ONE ────────────────────────────
 *
 * The defect this gate exists to catch is a CORRECT SENTENCE CARRYING A WRONG
 * BYLINE, and it is not hypothetical — it is in the mockup this feature is
 * ported from. `docs/v6-mockups/coldboot-splash.html:1350` attributes two
 * Satoshi quotes to `BitcoinTalk #770 · August 2010`. This repo's source of
 * record, `pages/_education/Quotes.tsx:23-24`, says `BitcoinTalk Thread #174`
 * / `August 11, 2010`. `#770` appears NOWHERE in `app/src`.
 *
 * The quote TEXT matches character for character. So a text-only diff passes
 * on it — the assertion would be structurally blind to the half that is
 * wrong. Hence: per passage, text AND attribution, against the same record.
 *
 * ── `source.mode` IS A CLAIM ABOUT PROVENANCE, NOT A KNOB ─────────────────
 *
 * "Verbatim" turned out to be three different relations, so each passage
 * DECLARES which one it claims and the gate checks that relation:
 *
 *   exact      the passage text equals a string in the source, character
 *              for character
 *   prefix     the passage shows the opening of a longer source string
 *              (passage 2 renders one sentence of a three-sentence quote —
 *              editorially fine, but it must SAY so)
 *   substring  the passage text appears inside a longer source body
 *
 * If a passage cannot be made verbatim without wrecking its slot, the honest
 * outcome is to say so and let a human rule. Loosening `mode` until the gate
 * goes green converts a provenance claim into a formality.
 *
 * ── THREE VACUITY GUARDS, because `substring` is the loosest relation ─────
 *
 *   1. DERIVED LENGTH FLOOR — a one-character substring satisfies includes()
 *      on almost anything. The floor is computed from the shortest passage in
 *      the table and PRINTED, never hardcoded: a picked constant reds on
 *      correct content the moment a legitimate passage falls under it.
 *   2. COUNT PIN — PASSAGES.length === 7, asserted SEPARATELY from the loop.
 *      A table of three that all match would otherwise pass cleanly.
 *   3. MATCHED COUNTER — the loop increments; the gate asserts matched === 7.
 *      This is the only assertion in the group that cannot go true-by-absence:
 *      a selector or reader that finds nothing fails loudly instead of
 *      passing an empty loop.
 *
 * Comparisons are CASE-SENSITIVE. A leading capital the source does not have
 * is a real difference and must be declared, never absorbed by a lax compare.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { makeReporter } from './verify-lib.mjs';

const R = makeReporter('verify-hero');

const SRC = 'src';
const TABLE = 'src/pages/home/passages.ts';
const EXPECTED = 7;

/* The length floor is DERIVED from the frozen table, never picked.
 *
 * A hand-chosen 40 would have RED-ED ON CORRECT CONTENT: P6's corrected
 * verbatim form from Timeline.tsx is "privacy mandatory and default" — 29
 * characters. Failing a passage precisely because it was fixed properly is
 * the same shape as a budget discovered at the gate. Derive it from the
 * shortest passage actually present and PRINT it, so shortening a passage
 * later reports both numbers instead of silently sliding under a constant. */
const deriveFloor = (ps) => Math.min(...ps.map((p) => typo((p.lines ?? []).join(' ')).length));

const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
/** Whitespace + QUOTE GLYPHS only. Case is NOT normalised, and DASHES ARE NOT
 *  EITHER.
 *
 *  An earlier draft folded [–—] to '-'. That silently contradicted this gate's
 *  own em-dash warning: the message told the reader a retyped hyphen would
 *  fail while the normaliser was quietly making it pass. A gate whose message
 *  and behaviour disagree is worse than either choice on its own — it teaches
 *  the next reader something false about what was checked.
 *
 *  Dashes stay significant because they are load-bearing here: P6's verbatim
 *  form is "from day one — privacy mandatory and default" and the U+2014 is
 *  part of the source text, not a rendering choice. Curly-vs-straight quotes
 *  ARE a rendering choice (editors rewrite them), so those are still folded. */
const typo = (s) => norm(s)
  .replace(/[‘’ʼ]/g, "'")
  .replace(/[“”]/g, '"');

/* ══ §0 · the table exists and has the declared shape ════════════════════ */
R.group('── 0 · passage table ────────────────────────────────────────────');

if (!existsSync(TABLE)) {
  R.ok(false, `${TABLE} exists`,
    'The hero passage table has not landed. Every assertion below would be ' +
    'true-by-absence, so they are SKIPPED rather than reported as passes.');
  R.skip('§1 per-passage text + attribution', `${TABLE} absent`);
  R.skip('§2 all seven matched', `${TABLE} absent`);
  R.skip('§3 count pin', `${TABLE} absent`);
  process.exit(R.finish());
}

const { PASSAGES } = await import('./' + TABLE);
R.ok(Array.isArray(PASSAGES), 'PASSAGES is exported as an array');

/* GUARD 2 — count pin, asserted separately from the loop below. */
R.ok(PASSAGES.length === EXPECTED,
  `PASSAGES declares exactly ${EXPECTED} passages (got ${PASSAGES.length})`,
  PASSAGES.length !== EXPECTED
    ? 'A short table would let the per-passage loop pass while the hero is incomplete.' : '');

const FLOOR = deriveFloor(PASSAGES);
R.info(`derived length floor: ${FLOOR} chars (shortest passage in the frozen table)`);

/* ══ §1 · per passage: TEXT and ATTRIBUTION, against the same record ═════ */
R.group('── 1 · per passage · text AND attribution ───────────────────────');

const fileCache = new Map();
const readSrc = (f) => {
  if (!fileCache.has(f)) fileCache.set(f, existsSync(f) ? readFileSync(f, 'utf8') : null);
  return fileCache.get(f);
};

let matched = 0;

for (const [i, p] of PASSAGES.entries()) {
  const tag = `P${i + 1} (${p.id ?? 'no-id'})`;
  const text = typo((p.lines ?? []).join(' '));
  const srcPath = p.source?.file?.startsWith(SRC) ? p.source.file : `${SRC}/${p.source?.file ?? ''}`;
  const body = readSrc(srcPath);

  if (!body) { R.ok(false, `${tag} · source file ${srcPath} exists`); continue; }

  /* GUARD 1 — derived length floor. */
  if (!R.ok(text.length >= FLOOR,
        `${tag} · displayed text is ≥${FLOOR} chars (${text.length}, floor derived from the table)`,
        `"${text}" is shorter than the shortest declared passage — a substring match this short ` +
        `asserts almost nothing`)) continue;

  const hay = typo(body);
  const mode = p.source?.mode;

  /* ── TEXT, by the relation the passage CLAIMS ── */
  let textOk = false;
  if (mode === 'exact') {
    // An exact claim must equal a whole string literal, not merely occur.
    const literals = [...body.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g)]
      .map((m) => typo(m[1] ?? m[2] ?? ''));
    textOk = literals.some((l) => l === text);
  } else if (mode === 'prefix') {
    const literals = [...body.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g)]
      .map((m) => typo(m[1] ?? m[2] ?? ''));
    textOk = literals.some((l) => l.startsWith(text) && l.length > text.length);
  } else if (mode === 'substring') {
    textOk = hay.includes(text);
  } else {
    R.ok(false, `${tag} · source.mode is one of exact|prefix|substring (got ${JSON.stringify(mode)})`);
    continue;
  }
  const tOk = R.ok(textOk, `${tag} · text is ${mode} against ${srcPath}`,
    textOk ? '' : `not found as ${mode}: "${text.slice(0, 90)}${text.length > 90 ? '…' : ''}"\n` +
      `     NOTE: this compare is character-sensitive. If the source carries U+2014 EM DASH (—) ` +
      `and the passage retypes it as a hyphen (-), THAT is the difference — it is a punctuation ` +
      `error, not a content error. Fix the character; do not loosen the compare.`);

  /* ── ATTRIBUTION, against the SAME record. This is the half a text-only
   *    diff is blind to, and the half the mockup got wrong. Every distinctive
   *    token of `meta` — thread numbers (#NNN) and years — must appear in the
   *    source file. `#770` in meta against a Quotes.tsx that contains only
   *    #174 and #82 fails here, which is the entire point of this gate. ── */
  const meta = typo(p.meta ?? '');
  const tokens = [...meta.matchAll(/#\d+|\b(?:19|20)\d{2}\b/g)].map((m) => m[0]);
  let aOk;
  if (tokens.length === 0) {
    // No numeric token to key on — fall back to requiring the whole meta
    // string to occur, rather than silently asserting nothing.
    aOk = R.ok(hay.includes(meta),
      `${tag} · attribution "${meta}" occurs in ${srcPath}`,
      hay.includes(meta) ? '' : 'no numeric token in meta and the full string is absent');
  } else {
    const missing = tokens.filter((t) => !hay.includes(t));
    aOk = R.ok(missing.length === 0,
      `${tag} · attribution tokens ${JSON.stringify(tokens)} all appear in ${srcPath}`,
      missing.length
        ? `ABSENT from the source of record: ${JSON.stringify(missing)} — the text may be correct ` +
          `while the byline is invented. This is the #770-vs-#174 defect.`
        : '');
  }

  if (tOk && aOk) matched++;
}

/* GUARD 3 — the counter. The only assertion here that cannot go
 * true-by-absence: an empty or unreadable table fails this loudly. */
R.group('── 2 · companion: every passage matched ─────────────────────────');
R.ok(matched === EXPECTED,
  `all ${EXPECTED} passages matched BOTH text and attribution (got ${matched})`,
  matched !== EXPECTED
    ? `${EXPECTED - matched} passage(s) did not match. A per-passage loop that finds nothing ` +
      `passes vacuously without this counter.` : '');

/* ══ §3 · REGRESSION GUARDS — labelled as such ══════════════════════════ */
R.group('── 3 · regression guards (true-by-absence today, by design) ─────');

/* These two are TRUE ON A TREE WITH NO HERO AT ALL. They are guards against
 * the mockup's errors being ported, not evidence that the hero is correct.
 * The wording says so, because an unchecked thing folded into a success count
 * is the failure this repo's reporter was built to prevent. */
const tree = (() => {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const f = `${d}/${e.name}`;
      if (e.isDirectory()) walk(f);
      else if (/\.(ts|tsx)$/.test(e.name)) out.push([f, readFileSync(f, 'utf8')]);
    }
  };
  walk(SRC);
  return out;
})();

const jev = tree.filter(([, c]) => /Jevans/.test(c)).map(([f]) => f);
R.ok(jev.length === 0,
  `REGRESSION GUARD (true-by-absence on a hero-less tree): "Jevans" absent from ${SRC}/ — ` +
  `this repo attributes quotations to a SOURCE OR A DOCUMENT, never to a named individual as ` +
  `speaker. Evidenced across all 12 distinct attributions in pages/_education/Quotes.tsx ` +
  `(Bitcoin Whitepaper, BitcoinTalk Thread #174, Cryptography Mailing List, Genesis Block ` +
  `Coinbase, P2P Foundation, …); "Email to Hal Finney" and "Email to Mike Hearn" name a person ` +
  `as RECIPIENT, never as the mouth the words come from. Where a role matters it names the role ` +
  `(pages/monero/BottomLineTab.tsx:162, "CipherTrace's CEO admitted…"); where a company is the ` +
  `actor it names the company (pages/monero/AttacksTab.tsx:13, pages/_education/Timeline.tsx:63). ` +
  `Same family as the MoneroSpace lineage rule in CLAUDE.md.`,
  jev.length ? `present in: ${jev.join(', ')}` : '');

const t770 = tree.filter(([, c]) => /#770/.test(c)).map(([f]) => f);
R.ok(t770.length === 0,
  `REGRESSION GUARD (true-by-absence on a hero-less tree): "#770" absent from ${SRC}/ — ` +
  `the source of record is BitcoinTalk Thread #174 (Quotes.tsx:23-24); #770 is the mockup's error.`,
  t770.length ? `present in: ${t770.join(', ')}` : '');

process.exit(R.finish());
