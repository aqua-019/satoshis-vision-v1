// verify-provenance.mjs — proves that a provenance badge cannot claim a freshness
// it has no way to know, and that the freshness vocabulary is total.
//
// Run: node verify-provenance.mjs   (Node >=22.18 strips the type annotations)
//
// Pure source assertions — no DOM, no build, no network. Runs in a bare checkout,
// which is why it does not import verify-lib.mjs (that pulls in playwright at
// module scope).
//
// ── WHY THIS GATE EXISTS ──────────────────────────────────────────────────
// Fixing 18 hardcoded `fresh="live"` call sites fixes 18 call sites. The 19th
// gets written next month, review passes it, and it renders a pulsing green dot
// through a total node outage — because `fresh="live"` is a string literal and
// strings do not go stale. Before v6.1.4 NOTHING in this repo's 53 gates
// mentioned <Provenance>, `fresh=`, or any freshness class.
//
// So the ban is the deliverable, not the 18 edits. Every surviving literal has to
// be listed below WITH A REASON, and the allowlist is checked in both directions:
// an entry matching nothing fails (the site moved and the reason is now fiction),
// and an entry matching twice fails (the reason no longer describes one site).
// A path exclusion would have been easier and would silently readmit the 19th.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "src");

let fail = false;
const ok = (cond, msg, detail = "") => {
  console.log((cond ? "✅ " : "❌ ") + msg + (!cond && detail ? `\n     ${detail}` : ""));
  if (!cond) fail = true;
};
const group = (t) => console.log(`\n— ${t} —`);
const info = (m) => console.log(`  ·  ${m}`);

const read = (p) => { try { return readFileSync(p, "utf8"); } catch { return null; } };

/**
 * Blank out comments, preserving length and newlines so byte offsets still map to
 * the right line numbers. Copied from verify-memshell.mjs:65 for the same reason
 * it exists there: the code this gate guards NAMES the banned patterns in its own
 * documentation — provenance.tsx's header block says `fresh="live"` twice while
 * explaining why not to write it. A naive grep flags the explanation.
 */
function stripComments(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === "//") {
      while (i < src.length && src[i] !== "\n") { out += " "; i++; }
    } else if (two === "/*") {
      while (i < src.length && src.slice(i, i + 2) !== "*/") { out += src[i] === "\n" ? "\n" : " "; i++; }
      out += "  "; i += 2;
    } else {
      out += src[i]; i++;
    }
  }
  return out;
}

const lineOf = (src, idx) => src.slice(0, idx).split("\n").length;

function walk(dir, exts) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p, exts));
    else if (exts.some((x) => e.endsWith(x))) out.push(p);
  }
  return out;
}

const PROV = join(SRC, "design", "provenance.tsx");
const CLOCK = join(SRC, "design", "useFreshClock.ts");
const STYLES = join(SRC, "styles.css");
const ENTRY_SSR = join(SRC, "entry-ssr.tsx");
const NETWORK_PAGE = join(SRC, "pages", "NetworkPage.tsx");

const provSrc = stripComments(read(PROV) ?? "");
const provRaw = read(PROV) ?? "";
const clockSrc = stripComments(read(CLOCK) ?? "");
const stylesRaw = read(STYLES) ?? "";
const netRaw = stripComments(read(NETWORK_PAGE) ?? "");

/* ══ A · the type ═══════════════════════════════════════════════════════════ */
group("A · ProvFreshness is five members, and rendering it is guarded");

const tsFiles = walk(SRC, [".ts", ".tsx"]);

{
  // The `=` is required. Without it this also counts `import { type ProvFreshness }`
  // — MarketsPage does exactly that, to annotate its assertNever fallback — and a
  // legitimate type-only import reads as a duplicate declaration.
  const DECL = /(?:^|\n)\s*(?:export\s+)?type ProvFreshness\s*=/g;
  const decls = [];
  for (const f of tsFiles) {
    const s = stripComments(read(f) ?? "");
    for (const m of s.matchAll(DECL)) decls.push(`${relative(HERE, f)}:${lineOf(s, m.index)}`);
  }
  ok(decls.length === 1, `ProvFreshness is declared exactly once (found ${decls.length})`, decls.join(", "));
}

{
  const m = provSrc.match(/export type ProvFreshness\s*=\s*([^;]+);/);
  const members = m ? [...m[1].matchAll(/"([a-z]+)"/g)].map((x) => x[1]).sort() : [];
  const want = ["error", "live", "loading", "none", "stale"];
  ok(JSON.stringify(members) === JSON.stringify(want),
     `ProvFreshness members are exactly {${want.join(", ")}}`, `got {${members.join(", ")}}`);
}

// The guard that did not exist before v6.1.4. Two independent ternaries rendered
// the suffixes, so widening the union compiled clean and rendered nothing — a
// sweep that added a fifth member produced errors at nine sites tree-wide and
// ZERO in this file. A switch + assertNever is what makes the next one fail here.
{
  const m = provSrc.match(/function freshSuffix\s*\(\s*\w+\s*:\s*ProvFreshness\s*\)[\s\S]*?\n\}/);
  const body = m ? m[0] : "";
  ok(!!m, "freshSuffix(f: ProvFreshness) exists and is annotated with the union it switches over");
  ok((body.match(/case\s+"/g) ?? []).length === 5, "freshSuffix handles all five members as explicit cases",
     `found ${(body.match(/case\s+"/g) ?? []).length}`);
  ok(/default:\s*return assertNever\(/.test(body), "freshSuffix's default calls assertNever — a sixth member fails to compile here");
}

// Annotated FeedPhase, NOT FeedStatus["phase"]. FeedStatus is a union of variants
// carrying literal phases and never references FeedPhase, so a switch narrowed
// over `status.phase` keeps compiling when FeedPhase grows — protected by nothing
// and invisible to the guard sweep. This assertion is the only thing standing
// between those two spellings.
{
  const m = provSrc.match(/function freshOfPhase\s*\(\s*\w+\s*:\s*FeedPhase\s*\)[\s\S]*?\n\}/);
  const body = m ? m[0] : "";
  ok(!!m, "freshOfPhase(p: FeedPhase) is annotated FeedPhase, not FeedStatus[\"phase\"]");
  ok((body.match(/case\s+"/g) ?? []).length === 4, "freshOfPhase handles all four FeedPhase members",
     `found ${(body.match(/case\s+"/g) ?? []).length}`);
  ok(/default:\s*return assertNever\(/.test(body), "freshOfPhase's default calls assertNever");
}

// `pulse` forced the live dot on independent of `fresh`. It had zero call sites
// and was a second way to hardcode a claim, so banning only `fresh="live"` would
// have moved the escape hatch rather than closed it.
{
  const props = provSrc.match(/export interface ProvenanceProps\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  ok(!/\bpulse\s*\??\s*:/.test(props), "ProvenanceProps declares no `pulse` — the second live-dot backdoor stays closed");
}

{
  ok(/Omit<ProvenanceProps,\s*"fresh">/.test(provSrc),
     "NodeProvenanceProps omits `fresh` — passing it is a type error, not merely discouraged");
  ok(/keys:\s*readonly\s*\[FeedKey,\s*\.\.\.FeedKey\[\]\]/.test(provSrc),
     "NodeProvenance's `keys` is a NON-EMPTY tuple — keys={[]} would fold to a live dot from nothing");
}

{
  const header = provRaw.slice(0, provRaw.indexOf("import "));
  const missing = ["loading", "live", "stale", "error", "none"].filter((m) => !new RegExp(`\\b${m}\\b`).test(header));
  ok(missing.length === 0, "the file header documents all five freshness members", `missing: ${missing.join(", ")}`);
}

/* ══ B · the ban ════════════════════════════════════════════════════════════ */
group("B · every literal freshness claim is allowlisted, with a reason");

/**
 * Each entry: the file it lives in, a substring of the (comment-stripped) LINE
 * that identifies it, and why the literal is legitimate there.
 *
 * `contains` is matched against the line, not a line number, so reformatting and
 * insertions above it do not silently invalidate the entry.
 */
const ALLOW = [
  {
    file: "src/pages/MarketsPage.tsx",
    contains: 'fresh="live" detail={`${total} live`}',
    reason:
      "Inside GroupBadge's switch over result.status, where the error and loading arms return " +
      "early, AND on the stales === 0 branch of a ternary whose other arm is fresh=\"stale\". " +
      "groupStatus() returns \"stale\" only when some member is stale and none is live, so " +
      "stales === 0 implies every member is live. The literal is reachable only when live.",
  },
];

{
  const LIT = /\b(?:fresh|phase)\s*=\s*"live"/;
  const hits = [];
  for (const f of tsFiles) {
    const s = stripComments(read(f) ?? "");
    s.split("\n").forEach((line, i) => {
      if (LIT.test(line)) hits.push({ file: relative(HERE, f).replace(/\\/g, "/"), line: i + 1, text: line.trim() });
    });
  }

  const matched = new Set();
  const orphans = [];
  for (const h of hits) {
    const idx = ALLOW.findIndex((a) => a.file === h.file && h.text.includes(a.contains));
    if (idx === -1) orphans.push(`${h.file}:${h.line}  ${h.text.slice(0, 90)}`);
    else matched.add(idx);
  }

  ok(orphans.length === 0,
     `no un-allowlisted literal fresh="live" / phase="live" (${hits.length} literal${hits.length === 1 ? "" : "s"} total, all accounted for)`,
     orphans.join("\n     "));

  // An entry that matches nothing is worse than no entry: it reads as coverage
  // while documenting a site that has moved or been fixed.
  ALLOW.forEach((a, i) => {
    const n = hits.filter((h) => h.file === a.file && h.text.includes(a.contains)).length;
    ok(n === 1, `allowlist entry ${i} (${a.file}) matches exactly one site`, `matched ${n}`);
  });

  ALLOW.forEach((a, i) => {
    ok(a.reason.length >= 40, `allowlist entry ${i} carries a real reason, not a shrug (${a.reason.length} chars)`);
  });

  ALLOW.forEach((a, i) => {
    ok(read(join(HERE, a.file)) !== null, `allowlist entry ${i} names a file that exists`);
  });

  for (const a of ALLOW) info(`allowlisted — ${a.file}: ${a.reason.split(".")[0]}.`);
}

/* ══ C · the copy, against the REAL SUSPENDED_RE ════════════════════════════ */
group("C · no freshness suffix can break the prerender");

// SUSPENDED_RE is extracted from source rather than re-typed. Two copies of this
// pattern drifting by one space is how /simulate shipped an empty #root for an
// unknown number of builds; re-typing it here would be a third copy.
{
  const ssr = read(ENTRY_SSR) ?? "";
  const m = ssr.match(/export const SUSPENDED_RE\s*=\s*\/(.+)\/([a-z]*);/);
  ok(!!m, "SUSPENDED_RE could be extracted from src/entry-ssr.tsx");

  if (m) {
    const re = new RegExp(m[1], m[2]);

    // Self-check. Without this, a botched extraction makes every assertion below
    // pass vacuously — the gate would report green on a regex that matches nothing.
    ok(re.test("loading simulators…"), "extraction self-check: the rebuilt regex still matches a real Suspense fallback");
    ok(!re.test("COINGECKO · stale"), "extraction self-check: the rebuilt regex does not match ordinary badge copy");

    const suffixes = [...provSrc.matchAll(/className="prov-fresh prov-fresh--[a-z]+">([^<]*)</g)].map((x) => x[1]);
    ok(suffixes.length === 3, `three freshness suffixes are rendered (found ${suffixes.length})`, JSON.stringify(suffixes));

    const bad = suffixes.filter((s) => re.test(s));
    ok(bad.length === 0,
       "no freshness suffix matches SUSPENDED_RE — none can fail the prerender on all 11 routes",
       `offending: ${JSON.stringify(bad)}`);

    ok(suffixes.includes(" · unavailable"),
       'the error suffix is exactly " · unavailable" — byte-identical to the detail string it replaced, which is what keeps verify-allreal-dom\'s /COINGECKO · unavailable/ green');

    for (const s of suffixes) info(`suffix ${JSON.stringify(s)} — SUSPENDED_RE: no match`);
  }
}

/* ══ D · the CSS ════════════════════════════════════════════════════════════ */
group("D · the badge stays readable, and stops blinking when asked");

{
  const css = stripComments(stylesRaw);

  // Nothing gated this before. `.prov` must stay inline or innerText reads
  // "COINGECKO" and "· stale" on separate lines, and verify-allreal-dom fails
  // with copy that looks identical on screen.
  ok(/\.prov\s*\{[^}]*display:\s*inline\s*;/.test(css),
     ".prov is display:inline — innerText reads as one logical line for screen readers and string asserts");

  ok(/\.prov-fresh--error\s*\{[^}]*color:\s*var\(--r-50\)/.test(css),
     ".prov-fresh--error declares color: var(--r-50)");

  const errRule = css.match(/\.prov-fresh--error\s*\{([^}]*)\}/)?.[1] ?? "";
  ok(!/animation/.test(errRule), ".prov-fresh--error declares no animation — red means 'nothing arrived', and it says so without moving");

  ok(/\.prov-fresh--stale\s*\{/.test(css), ".prov-fresh--stale still exists");

  // Generalised on purpose. Pinning today's two class names would let a third
  // animated suffix reintroduce exactly the defect this assertion was written for.
  const reduceBlocks = [...css.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\s*\}/g)].map((x) => x[1]);
  const killList = reduceBlocks.join("\n");
  const animated = [...css.matchAll(/(\.prov-fresh--[a-z]+)\s*\{([^}]*)\}/g)]
    .filter((x) => /animation\s*:/.test(x[2]))
    .map((x) => x[1]);
  const unkilled = animated.filter((cls) => !killList.includes(cls));
  ok(unkilled.length === 0,
     `every animated .prov-fresh--* is in a reduced-motion kill-list (${animated.length} animated: ${animated.join(", ") || "none"})`,
     `NOT killed: ${unkilled.join(", ")}`);

  // The one that was actually broken: .prov-fresh--stale invokes the `blink`
  // KEYFRAME but carries no `.blink` CLASS, so the class-based kill-list missed it
  // for three versions and it blinked at readers who asked it not to.
  ok(killList.includes(".prov-fresh--stale"), ".prov-fresh--stale is named explicitly in the reduce kill-list");
  ok(killList.includes(".prov-fresh--error"), ".prov-fresh--error is named explicitly in the reduce kill-list");
}

/* ══ E · the wiring ═════════════════════════════════════════════════════════ */
group("E · freshness is derived per-endpoint, never globally");

{
  // Binding requirement 1, mechanised. feedDegraded is a pair-AND global that
  // reports healthy while a single endpoint is dead; a panel with keys=["mempool"]
  // must go stale when /api/xmr/mempool alone fails. That difference IS the claim.
  ok(!/\bfeedDegraded\b/.test(provSrc),
     "provenance.tsx never calls feedDegraded — the per-endpoint claim is not diluted by the pair-AND global");

  ok(/oldestFreshAt\(/.test(netRaw),
     "NetworkPage's DataPanel derives its timestamp from oldestFreshAt(), not from the lastUpdate heartbeat");

  // One array feeds data-panel-key, the `· stale` chip, the UPD stamp and the
  // badge. Before this, two panels rendered `· stale` beside a pulsing LIVE dot.
  // Anchored on a closing brace at column 0 followed by a newline. `\n\}` alone
  // stops at the destructured props' TYPE LITERAL (`}) {`), which is before the
  // function body — so the two assertions below silently examined an empty
  // string and reported red on code that was correct.
  const dp = netRaw.match(/function DataPanel\([\s\S]*?\n\}\n/)?.[0] ?? "";
  ok(/dataKey=\{keys\.join\(" "\)\}/.test(dp), "DataPanel's data-panel-key is the joined `keys` — byte-identical for verify-failure");
  ok(/<NodeProvenance[^>]*keys=\{keys\}[^>]*status=\{status\}/.test(dp),
     "DataPanel's badge reads the same `keys` it advertises — it cannot name a different endpoint than its own chip");
}

/* ══ F · the shared clock ═══════════════════════════════════════════════════ */
group("F · one clock, and it does not stop for reduced motion");

{
  ok(clockSrc.length > 0, "src/design/useFreshClock.ts exists");

  const intervals = (clockSrc.match(/setInterval\(/g) ?? []).length;
  ok(intervals === 1, `exactly one setInterval in the module (found ${intervals}) — 32 panels share one timer`);

  // An elapsed age is information, not decoration. v6.1.3 recorded the inverse
  // trap: useTick freezes to a literal 0 under reduce, so a frozen frame became a
  // false content claim. An age frozen at "0s" while an endpoint has been dead an
  // hour is the same fabrication.
  const motion = ["useReducedMotion", "prefers-reduced-motion", "getDeviceTier"].filter((t) => clockSrc.includes(t));
  ok(motion.length === 0,
     "the clock consults neither reduced-motion nor device tier — an elapsed age is information, not motion, and a frozen counter is a clock that lies",
     `found: ${motion.join(", ")}`);

  ok(/onPageActiveChange\(/.test(clockSrc), "the clock pauses while the tab is hidden (onPageActiveChange)");
}

console.log("");
console.log(fail ? "❌ verify-provenance: FAILED" : "✅ verify-provenance: all assertions passed");
process.exit(fail ? 1 : 0);
