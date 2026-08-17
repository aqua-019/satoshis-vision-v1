/**
 * pages/MinePage.tsx — /operate/mine, the FIFTEENTH route and the OPERATE
 * section's third leaf, after "Run a node" and the Superstress hub.
 *
 * ── THE FILE NAME IS `MinePage`, NOT `OperateMinePage` ────────────────────
 * Measured rather than assumed: NO page in this directory carries its section
 * prefix. `/operate/node` → NodePage, `/operate/superstress` → SuperstressPage,
 * `/about/peers` → TrustedPeersPage, `/about/sources` → SourcesPage,
 * `/live/network` → NetworkPage. The convention is `<Thing>Page.tsx` and the
 * section lives in the ROUTE, not the filename.
 *
 * ── EVERY COMMAND ON THIS PAGE IS UPSTREAM'S OWN ─────────────────────────
 * Not one command line here was composed by this site. Each is quoted from a
 * named upstream README and the source is on the page beside it:
 *
 *   · P2Pool          SChernykh/p2pool — the GNU/Linux, Windows, macOS and
 *                     Android (Termux) sections of its README, verbatim.
 *   · XMRig           xmrig/xmrig — its README and its own CMake options.
 *   · RandomX facts   tevador/RandomX — its README's own words.
 *
 * That is the honest-data doctrine applied to instructions rather than to
 * numbers. A walkthrough that invents a flag is the same defect class as a
 * live surface that invents a price: it is confident, it is plausible, and it
 * is wrong in a way the reader cannot see. Where upstream does not say
 * something, THIS PAGE DOES NOT SAY IT EITHER — see the `--mini` note below,
 * which is the sharpest instance.
 *
 * ── WHAT THIS PAGE REFUSES TO PRINT ──────────────────────────────────────
 *   · NO earnings estimate. It would need the reader's own hashrate, the
 *     network's, the price and luck. Three of those four are unknowable here.
 *   · NO device hashrates ("a phone does N H/s"). RandomX throughput depends
 *     on core count, cache, memory bandwidth and whether huge pages were
 *     granted. A figure with that many free variables is decoration.
 *   · NO pool market share. Monero coinbases do not tag pools and this site
 *     queries no pool API, so the distribution is not measurable from here —
 *     `protocols/pool-data.ts` already says exactly that about the Skyline
 *     simulator's illustrative figures, and this page must not quietly
 *     contradict its own simulator by stating a share as fact.
 *   · NO RandomX-successor parameters, dates or performance claims. Work on
 *     the next PoW iteration is real and upstream; it is LINKED (the MRL
 *     issue tracker, the destination `pages/future/data.ts` already uses) and
 *     nothing about it is asserted. Same discipline FUTURE_PROTOCOLS applies
 *     to consensus changes, applied to proof of work.
 *
 * The ONE live number is the network hashrate/difficulty pair, and it costs
 * ZERO extra requests: `useMoneroLive()` reads the feed DataProvider already
 * polls on every route. Real or an em-dash, with a NODE provenance badge —
 * never synthesised, exactly as NodePage's own "expected height" line works.
 *
 * ── THE PRIVACY CAVEAT IS NOT A FOOTNOTE ─────────────────────────────────
 * P2Pool's README: "It is highly recommended to create a new mainnet wallet
 * for P2Pool mining because **wallet addresses are public on P2Pool**." On a
 * site whose subject is transaction privacy, recommending P2Pool without
 * putting that sentence at full size would be advocacy, not documentation.
 * It gets its own callout above the walkthroughs, not a line at the bottom.
 *
 * XMRig's default 1% donation is disclosed for the same reason: the reader is
 * being told to run software that pays its author by default. That is fine,
 * it is upstream's documented behaviour, and it is theirs to know.
 *
 * ── `Cmd` IS DUPLICATED FROM NodePage, DELIBERATELY ──────────────────────
 * Extracting it to a shared leaf is the obvious move and it is NOT taken.
 * Two reasons, the second measured:
 *   1. It is PRESENTATIONAL. The things this repo shares across pages are
 *      INVARIANTS — SUPERBRAIN_APPS, the fork version, MINER_CMD — where
 *      drift is a lie on one of the two surfaces. Two copy buttons that
 *      differ by a padding value are not a lie.
 *   2. A leaf shared ACROSS CHUNK GROUPS costs a chunk (canvasColor,
 *      repoPulse, Disclosure — this repo has paid it four times), and
 *      NodePage and this page are separate lazy groups. `CHUNK_COUNT` is
 *      already at its band ceiling before this route mints its own. Spending
 *      the last rung on a twenty-line button, in the PR that must spend one
 *      on the route itself, is the worst trade available.
 * See the release note for the measured chunk delta either way.
 *
 * ── THE SUPERBRAIN MINER LINE IS LINKED, NOT RESTATED ────────────────────
 * `SuperstressPage` derives that one command from `pages/future/data.ts`'s
 * Superbrain `blocks[]`. The obvious move here is to derive it identically so
 * the two agree by construction — and it is NOT taken, for a measured reason
 * and a stronger one.
 *   MEASURED: `data.ts` currently has THREE importer groups (FuturePage,
 *   TrustedPeersPage, SuperstressPage) and shares a chunk with the other
 *   modules that have the same three. Importing it from a FOURTH group gives
 *   it an importer set nothing else has, which is exactly the condition that
 *   splits it into its own chunk — a SECOND mint on top of this route's own,
 *   with CHUNK_COUNT already one rung from its band ceiling, to carry one
 *   string. It would also put that module's whole prose payload into this
 *   route's first load for a command the reader can reach in one click.
 *   STRONGER: linking is the harder form of "do not fork it". Deriving the
 *   string means two surfaces print it and a gate has to prove they agree.
 *   Linking means ONE surface prints it and there is nothing to disagree.
 *
 * ── THE VISUAL: SVG GEOMETRY, DOM LABELS, ZERO NUMERALS ──────────────────
 * `<DecentralField>` draws a jittered lattice of equal peers. Three separate
 * constraints decided its shape and each rules out an alternative:
 *
 *   · NO CANVAS TEXT. Canvas glyphs are invisible to verify-legibility, to
 *     find-in-page and to a screen reader — the rule CandleCanvas.tsx already
 *     records ("canvas draws NO text — every glyph is DOM").
 *   · NO SVG TEXT EITHER. An `<svg>` with a viewBox is DOWNSCALED at 390, and
 *     verify-mobile §6 measures SVG through each node's own getScreenCTM in
 *     RENDERED space. `/live/markets/thesis` already carries 22 labels at
 *     2.58–3.04px behind exactly that mechanism and is BOUNDED rather than
 *     exempted, so a new offender fails the build. Every label here is DOM,
 *     outside the svg, at `--fs-label`.
 *   · NO NUMERALS AT ALL. A diagram that prints a figure has to defend the
 *     figure. This one draws topology only, so there is nothing on it that
 *     could be fabricated, and the caption says in words that the positions
 *     are a fixed seed rather than a map of the network.
 *
 * Randomness is `design/prng.ts`'s `h3` — seeded, index-addressable, and
 * strictly VISUAL. `Math.random()` is banned outside `src/protocols/` and
 * verify-prng.mjs sweeps all of `src/` for it.
 *
 * Motion is the documented shape (mempool/constellation.tsx:68): the CALLER
 * owns reduced motion, so `useReducedMotion()` gates `useAnimationSeconds`'s
 * `enabled`. Neither clock hook checks the preference itself. Under reduce
 * the hook never subscribes and returns 0 — and the still frame LOSES NOTHING,
 * because each pulse's phase is `(t / PERIOD + seededOffset) % 1`: at t = 0
 * the offsets alone already spread the pulses along their paths, so the
 * reading "a solution can originate at any peer and propagates outward with
 * no hub" is fully present in the static frame. SMIL is not used anywhere
 * here: it is invisible to CSS reduce and verify-reduce asserts its ABSENCE.
 *
 * The accent colour is deliberately NOT `--tk-accent`. Monero orange means
 * crypto data on this site and never decoration; this is a diagram.
 */

import * as React from "react";
import { Link } from "react-router-dom";

import { PageShell } from "@/layout/PageShell";
import { PageHeader } from "@/layout/AppShell";
import { Card, Crumbs, Pill, Stat, NodeProvenance } from "@/design/primitives";
import { Disclosure } from "@/design/Disclosure";
import { useMoneroLive } from "@/data/DataContext";
import { hasData } from "@/data/feed-status";
import { useReducedMotion } from "@/design/useReducedMotion";
import { useAnimationSeconds } from "@/design/useAnimationClock";
import { h3 } from "@/design/prng";
import { R } from "../../scripts/routes.mjs";

/* ── Sources ──────────────────────────────────────────────────────────────
 * Named once, rendered wherever a claim needs its receipt. External links
 * only — the browser fetches none of them; CSP is `connect-src 'self'` and
 * these are destinations a reader chooses, not requests this site makes. */
const SRC = {
  randomx: "https://github.com/tevador/RandomX",
  p2pool: "https://github.com/SChernykh/p2pool",
  p2poolRel: "https://github.com/SChernykh/p2pool/releases/latest",
  xmrig: "https://github.com/xmrig/xmrig",
  xmrigRel: "https://github.com/xmrig/xmrig/releases/latest",
  termux: "https://f-droid.org/en/packages/com.termux/",
  mrl: "https://github.com/monero-project/research-lab/issues",
} as const;

function Src({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="mono dim2" href={href} target="_blank" rel="noopener noreferrer"
       style={{ fontSize: "var(--fs-label)" }}>
      {children} ↗
    </a>
  );
}

/* ── Cmd — the copy-button command row (see the header for why it is here) ── */

function Cmd({ id, cmd, copied, setCopied }: { id: string; cmd: string; copied: string | null; setCopied: (v: string | null) => void }) {
  /* THE CONFIRMATION WAITS FOR THE WRITE, and NodePage's copy of this does not
     — a deliberate divergence, found by reading rather than by any gate.
     `navigator.clipboard.writeText` returns a PROMISE, so a try/catch around it
     catches only the synchronous throw (no `navigator.clipboard` at all). A
     REJECTION — permission denied, a non-secure context, a hardened browser —
     lands after the handler has returned, by which time "✓ COPIED" is already
     on screen and nothing was copied. On a site whose whole subject is not
     claiming things it cannot show, a button that reports a success it did not
     achieve is the same defect class as a fabricated reading, at UI scale.
     Awaiting the promise makes the label report the outcome instead. */
  const copy = () => {
    try {
      Promise.resolve(navigator.clipboard.writeText(cmd))
        .then(() => {
          setCopied(id);
          setTimeout(() => setCopied(null), 1500);
        })
        .catch(() => { /* denied — say nothing rather than claim success */ });
    } catch { /* no clipboard API at all */ }
  };
  return (
    <div className="panel" style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <code className="mono" style={{ color: "var(--c-50)", fontSize: "var(--fs-mono)" }}>
        $ <span style={{ color: "var(--ink-100)" }}>{cmd}</span>
      </code>
      <button type="button" className="proto-btn" style={{ padding: "5px 10px", fontSize: "var(--fs-label)" }} onClick={copy}>
        {copied === id ? "✓ COPIED" : "COPY"}
      </button>
    </div>
  );
}

/* ── The decentralization field ───────────────────────────────────────────
 * See the file header for why this is SVG geometry with DOM labels and no
 * numerals anywhere. */

const FIELD_SEED = 0x6d696e65;
const FIELD_W = 1000;
const FIELD_H = 360;
const COLS = 11;
const ROWS = 4;
/** Peers are all the SAME radius. That is the whole argument: no peer is
 *  bigger, and none is in the middle. */
const PEER_R = 5;
/** Link cutoff, in viewBox units. MEASURED across candidate values rather than
 *  eyeballed, because the two failure modes sit either side of it: too small
 *  and a peer is isolated (which draws the opposite of the argument), too large
 *  and it is a hairball in which no individual peer is legible. At 132 the
 *  field is 103 links over 44 peers — mean degree 4.7, MINIMUM 2, maximum 8, so
 *  every peer has neighbours and none is a hub. At 168 the mean was 7.1 and the
 *  max 12; at 120 the minimum fell to 1. */
const LINK_D2 = 132 * 132;
const PULSES = 6;
/** Seconds for a pulse to traverse its whole path. */
const PULSE_PERIOD = 6.4;

interface Peer { x: number; y: number }
interface Field {
  peers: Peer[];
  links: [number, number][];
  /** Each pulse's polyline, as absolute points, plus its cumulative lengths. */
  paths: { pts: Peer[]; cum: number[]; total: number; off: number }[];
}

function buildField(): Field {
  const cw = FIELD_W / COLS;
  const ch = FIELD_H / ROWS;
  const peers: Peer[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      // Jittered lattice: uniform density across the whole box, so there is
      // no centre for the eye to read as a hub. The jitter keeps it from
      // looking like a manufactured grid.
      peers.push({
        x: (c + 0.16 + 0.68 * h3(i, 0, FIELD_SEED)) * cw,
        y: (r + 0.16 + 0.68 * h3(i, 1, FIELD_SEED)) * ch,
      });
    }
  }

  const links: [number, number][] = [];
  const adj: number[][] = peers.map(() => []);
  for (let i = 0; i < peers.length; i++) {
    for (let j = i + 1; j < peers.length; j++) {
      const dx = peers[i].x - peers[j].x;
      const dy = peers[i].y - peers[j].y;
      if (dx * dx + dy * dy <= LINK_D2) {
        links.push([i, j]);
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }

  // A pulse walks outward from a seeded origin: origin → neighbour →
  // neighbour-of-neighbour. Peer-to-peer propagation with no hub in it.
  const paths: Field["paths"] = [];
  for (let p = 0; p < PULSES; p++) {
    let cur = Math.floor(h3(p, 7, FIELD_SEED) * peers.length) % peers.length;
    const pts: Peer[] = [peers[cur]];
    const seen = new Set<number>([cur]);
    for (let hop = 0; hop < 2; hop++) {
      const options = adj[cur].filter((n) => !seen.has(n));
      if (!options.length) break;
      const next = options[Math.floor(h3(p, 11 + hop, FIELD_SEED) * options.length) % options.length];
      seen.add(next);
      pts.push(peers[next]);
      cur = next;
    }
    if (pts.length < 2) continue;
    const cum = [0];
    for (let k = 1; k < pts.length; k++) {
      const dx = pts[k].x - pts[k - 1].x;
      const dy = pts[k].y - pts[k - 1].y;
      cum.push(cum[k - 1] + Math.hypot(dx, dy));
    }
    paths.push({ pts, cum, total: cum[cum.length - 1], off: h3(p, 23, FIELD_SEED) });
  }

  return { peers, links, paths };
}

/** Position along a pulse's polyline at fraction `u` ∈ [0, 1). */
function atFraction(path: Field["paths"][number], u: number): Peer {
  const want = u * path.total;
  for (let k = 1; k < path.cum.length; k++) {
    if (want <= path.cum[k] || k === path.cum.length - 1) {
      const span = path.cum[k] - path.cum[k - 1] || 1;
      const f = Math.min(1, Math.max(0, (want - path.cum[k - 1]) / span));
      const a = path.pts[k - 1];
      const b = path.pts[k];
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
  }
  return path.pts[0];
}

/** The static half — every peer and every link. Memoised so the animated
 *  pulse layer above it can re-render without React reconciling ~120 nodes
 *  every frame. `field` is built once, so the props are referentially stable
 *  and this subtree is genuinely skipped. */
const FieldStatic = React.memo(function FieldStatic({ field }: { field: Field }) {
  return (
    <g>
      <g stroke="var(--ink-20)" strokeWidth={1} fill="none">
        {field.links.map(([a, b], i) => (
          <line key={i} x1={field.peers[a].x} y1={field.peers[a].y} x2={field.peers[b].x} y2={field.peers[b].y} />
        ))}
      </g>
      <g fill="var(--c-50)">
        {field.peers.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={PEER_R} />
        ))}
      </g>
    </g>
  );
});

function DecentralField() {
  const reduce = useReducedMotion();
  // The CALLER owns reduced motion — useAnimationSeconds does not check it.
  // enabled:false never subscribes and returns 0, which is the still frame.
  const t = useAnimationSeconds({ fps: 12, enabled: !reduce });
  const field = React.useMemo(buildField, []);

  return (
    <figure style={{ margin: 0 }}>
      <div
        // Explicit ratio as well as the viewBox's intrinsic one: the box is
        // reserved before a single byte of this component's JS runs, so the
        // ledger below it cannot be pushed down. Zero CLS by construction.
        style={{ width: "100%", aspectRatio: `${FIELD_W} / ${FIELD_H}`, background: "var(--bg-2)", border: "1px solid var(--rule)", borderRadius: 4, overflow: "hidden" }}
      >
        {/* aria-hidden, and that is the STRONGER accessibility answer here:
            every claim the picture makes is written in the caption below it
            as real text, so announcing an unlabelled graphic on top of that
            would be noise. */}
        <svg viewBox={`0 0 ${FIELD_W} ${FIELD_H}`} width="100%" height="100%" aria-hidden="true" focusable="false"
             data-mine-field={reduce ? "static" : "live"} data-mine-peers={COLS * ROWS}>
          <FieldStatic field={field} />
          <g fill="var(--g-50)">
            {field.paths.map((path, i) => {
              const u = ((t / PULSE_PERIOD) + path.off) % 1;
              const at = atFraction(path, u);
              // `data-mine-pulse-u` is the phase, published so a gate can
              // assert the STILL frame without inferring it from pixels. It is
              // the whole "loses no information" claim in one number: under
              // reduce t is 0, so u collapses to the SEEDED offset, and six
              // distinct spread offsets are what keeps "a solution can start
              // anywhere" legible with nothing moving. Zero it and the gate
              // reds.
              return (
                <circle key={i} cx={at.x} cy={at.y} r={PEER_R + 3}
                        data-mine-pulse="" data-mine-pulse-u={u.toFixed(3)} />
              );
            })}
          </g>
        </svg>
      </div>
      <figcaption className="mono dim" style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", margin: "10px 0 0", fontSize: "var(--fs-label)", letterSpacing: "0.04em" }}>
        <span>Every peer the same size — none is bigger, none is in the middle</span>
        <span>·</span>
        <span>A solution can originate at any peer and travels outward hop by hop</span>
        <span>·</span>
        <span>No operator, no hub, nothing to shut down</span>
      </figcaption>
      <p className="mono dim2" style={{ margin: "8px 0 0", fontSize: "var(--fs-label)", lineHeight: 1.6 }}>
        Illustrative topology. Peer positions come from a fixed seed, not from a map of the network —
        this site queries no peer crawler and draws no figure it cannot source. The one live reading on
        this page is the network hashrate above, from the node this site reads.
      </p>
    </figure>
  );
}

/* ── The page ─────────────────────────────────────────────────────────────*/

type PlatformId = "windows" | "linux" | "macos" | "android";

export function MinePage() {
  const data = useMoneroLive();
  const [copied, setCopied] = React.useState<string | null>(null);
  // Single-select: exactly one walkthrough open, defaulting to the first.
  // Every panel is still in the prerendered HTML (Disclosure renders its
  // panel ALWAYS and toggles `hidden`), so a JS-off reader gets all four —
  // see that component's header for the measurement behind that choice.
  const [openPlatform, setOpenPlatform] = React.useState<PlatformId>("windows");

  const netReady = hasData(data.status.network);
  const cmd = (id: string, c: string) => <Cmd id={id} cmd={c} copied={copied} setCopied={setCopied} />;

  return (
    <PageShell width="standard" bg={{ intensity: "calm" }}>
      <Crumbs path={R.OPERATE_MINE} />
      <PageHeader
        kicker="randomx · cpu-first · four platforms"
        title='<em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">Mine</em> Monero. On the computer you already own.'
        sub="RandomX is proof of work designed so an ordinary CPU stays competitive. This is the doing page: what to install, what to run, and what it costs you to know."
      />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        <Stat k="Proof of work" v="RandomX" sub="CPU-optimized, since 2019" />
        <Stat k="Miner memory" v="2080 MiB" sub="fast mode · 256 MiB light" />
        <Stat k="Architecture" v="64-bit" sub="P2Pool: no 32-bit / ARMv7" />
        {/* The ONE live number on this page, and the ONLY place a hashrate may
            appear at all — verify-mine §4 asserts that every "H/s" on the
            rendered page sits inside this element, which is what stops a
            device-hashrate claim ("a phone does N H/s") drifting into the
            prose later. Real or an em-dash; never synthesised. */}
        <Stat
          k="Network hashrate"
          v={<span data-live-hashrate>{netReady ? `${(data.hashrate / 1e9).toFixed(2)} GH/s` : "—"}</span>}
          sub={<NodeProvenance source="node" keys={["network"]} status={data.status} bare />}
        />
      </section>

      {/* ── The thesis ─────────────────────────────────────────────────── */}
      <Card style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div className="kicker" style={{ color: "var(--tk-accent)" }}>The thesis</div>
          <p className="serif" style={{ margin: "10px 0 0", fontSize: 21, lineHeight: 1.45, color: "var(--ink-100)" }}>
            CPU-focused mining with RandomX is simple, hyper-decentralized, and open to almost
            any practical device with a CPU.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
          <div>
            <div className="kicker">Simple</div>
            <p className="mono dim" style={{ margin: "6px 0 0", fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
              Three programs on one machine: your node, P2Pool, a miner. No account, no operator,
              no application, no minimum balance. Nothing to be approved for.
            </p>
          </div>
          <div>
            <div className="kicker">Hyper-decentralized</div>
            <p className="mono dim" style={{ margin: "6px 0 0", fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
              RandomX is “optimized for general-purpose CPUs” and uses “random code execution
              together with several memory-hard techniques to minimize the efficiency advantage of
              specialized hardware”. The consequence is the point: the machine you already own is
              not obsolete against a machine built to beat it.
            </p>
          </div>
          <div>
            <div className="kicker">Open to almost any device</div>
            <p className="mono dim" style={{ margin: "6px 0 0", fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
              A 64-bit CPU and enough free memory for the miner's dataset — 2080 MiB in fast mode,
              or 256 MiB in light mode, which works and is much slower. A laptop qualifies. A Pi 5
              qualifies. A phone qualifies.
            </p>
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 14 }}>
          <div className="kicker" style={{ color: "var(--p-50)" }}>“Forever” — the half that is a guarantee, and the half that is not</div>
          <p className="mono dim" style={{ margin: "8px 0 0", fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
            One half is protocol: the tail emission pays <span className="acc">0.6 XMR</span> per block
            with no end date, so there is always a reward to mine for — Monero has no security cliff
            waiting for it. The other half is not a law of nature. “RandomX stays CPU-friendly” is a
            decision the network keeps making, and work on a successor proof of work is live upstream
            in the Monero Research Lab. This page links that work and asserts nothing about it — no
            parameters, no dates, no performance claims, because none have been published to assert.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
            <Src href={SRC.randomx}>tevador/RandomX</Src>
            <Src href={SRC.mrl}>MRL research-lab issues</Src>
          </div>
        </div>
      </Card>

      {/* ── The gradient ───────────────────────────────────────────────── */}
      <section>
        <div className="kicker">Where your hashrate goes · a decentralization gradient</div>
        <p className="mono dim" style={{ margin: "8px 0 14px", fontSize: "var(--fs-body)", lineHeight: 1.6, maxWidth: "72ch" }}>
          Three ways to point a miner, and they are not equivalent. P2Pool's own README puts it
          plainly: “While pool mining is the easiest to set up, it centralizes the Monero network and
          the pool admin gets full power over your hashrate and your unpaid funds. Solo mining is 100%
          independent and the best for the network. P2Pool mining has all the advantages of solo
          mining, but also makes regular payouts possible.” This page recommends P2Pool, and the
          walkthroughs below all target it.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          <Card style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div className="kicker" style={{ color: "var(--r-50)" }}>Hosted pool</div>
              <Pill tone="warn">centralizes</Pill>
            </div>
            <p className="mono dim" style={{ margin: "8px 0 0", fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
              Easiest: install a miner, point it at someone's server, done. In exchange the operator
              holds your unpaid funds, decides what you mine, and — in P2Pool's own words — “can
              execute attacks against the network”. Fees run 0–3%, minimum payouts 0.001–0.01 XMR.
            </p>
          </Card>

          <Card style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div className="kicker">Solo</div>
              <Pill>no custody</Pill>
            </div>
            <p className="mono dim" style={{ margin: "8px 0 0", fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
              Your node builds the block, so nobody else chooses anything. 0% fee, 100% under your
              control, as stable as your own node. The cost is rarity: you are paid when YOU find a
              block, which means a minimum payout of 0.6 XMR or more and long silences between.
            </p>
          </Card>

          <Card accentBorder style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div className="kicker" style={{ color: "var(--g-50)" }}>P2Pool · recommended</div>
              <Pill tone="live">no operator</Pill>
            </div>
            <p className="mono dim" style={{ margin: "8px 0 0", fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
              A separate blockchain merge-mined with Monero, so the pool has no server and no admin.
              “There is no pool wallet, funds are never in custody. All pool blocks pay out to miners
              directly.” 0% fee, no payout fee, minimum around 0.00027 XMR. You run a node and a
              P2Pool daemon beside your miner — that is the whole extra cost.
            </p>
          </Card>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginTop: 12 }}>
          <Card style={{ padding: 16 }}>
            <div className="kicker" style={{ color: "var(--y-50)" }}>The honest caveat on the recommendation</div>
            <p className="mono dim" style={{ margin: "8px 0 0", fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
              P2Pool states its own downside and so does this page: if the sidechain does not have
              enough hashrate to find Monero blocks faster than about every six hours, not all your
              shares result in a payout — and even above that, luck can carry a share through the
              window unpaid. Upstream's position is that it averages out over time. That is a claim
              about the long run, not a promise about your week.
            </p>
          </Card>
          <Card style={{ padding: 16 }}>
            <div className="kicker">Why no pool market-share figure appears here</div>
            <p className="mono dim" style={{ margin: "8px 0 0", fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
              Because it cannot be measured from the chain. A Monero coinbase transaction does not
              identify the pool that mined it, so any published pool ranking is somebody's survey of
              self-reported figures, not an on-chain fact — and this page has no way to check one.
              The{" "}
              <Link className="acc" to={`${R.LEARN_SIM}?p=skyline`}>Skyline simulator</Link> models
              pool concentration with figures it labels illustrative, for exactly that reason. A
              number here would be decoration wearing a data badge.
            </p>
          </Card>
        </div>
      </section>

      {/* ── The privacy callout ────────────────────────────────────────── */}
      <Card style={{ padding: 20, borderColor: "var(--y-50)" }}>
        <div className="kicker" style={{ color: "var(--y-50)" }}>Before you paste an address · read this once</div>
        <p className="mono" style={{ margin: "10px 0 0", fontSize: "var(--fs-body)", lineHeight: 1.65, color: "var(--ink-80)" }}>
          <b>Wallet addresses are public on P2Pool.</b> The sidechain is a real blockchain and payouts
          are made directly to miners, which means the address you mine to is visible to anyone
          reading it. Upstream's own recommendation is to create a new mainnet wallet for mining, and
          on a site about transaction privacy that recommendation is not a footnote — it is the first
          instruction. Monero's on-chain privacy is unaffected either way; what leaks here is the
          association between an address and a miner, and a fresh wallet is the whole fix.
        </p>
        <p className="mono dim" style={{ margin: "10px 0 0", fontSize: "var(--fs-body)", lineHeight: 1.65 }}>
          Two more from the same source, worth the ten seconds: run mining under a separate restricted
          user account on your OS, and note that P2Pool supports mining over Tor and I2P if your
          threat model asks for it.
        </p>
      </Card>

      {/* ── The four walkthroughs ──────────────────────────────────────── */}
      <section>
        <div className="kicker">Four walkthroughs · pick your platform</div>
        <p className="mono dim" style={{ margin: "8px 0 14px", fontSize: "var(--fs-body)", lineHeight: 1.6, maxWidth: "72ch" }}>
          Each block is complete on its own — install, configure, point at P2Pool and your node, then
          check it is really hashing. Every command is quoted from P2Pool's or XMRig's own
          documentation rather than composed here. Substitute your own wallet address wherever{" "}
          <code className="hash">YOUR_WALLET_ADDRESS</code> appears; it is a primary address, the one
          starting with 4.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Disclosure
            id="windows"
            label="Windows"
            summary="Released binaries for all three programs — no compiler needed."
            meta={<Pill>binaries</Pill>}
            open={openPlatform === "windows"}
            onToggle={() => setOpenPlatform("windows")}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 6px" }}>
              <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
                Download the latest P2Pool and XMRig releases and expand them into one folder, then
                create a <code className="hash">Monero</code> folder inside it and put the Monero
                binaries there. Windows SmartScreen may block files downloaded from the internet:
                open each once, choose “More info”, then “Run anyway”, and close it again. XMRig needs
                huge pages, which on Windows 10 and above means running it as Administrator once.
              </p>
              <div className="kicker">1 · start your node</div>
              {cmd("w1", ".\\Monero\\monerod.exe --zmq-pub tcp://127.0.0.1:18083 --out-peers 32 --in-peers 64 --add-priority-node=p2pmd.xmrvsbeast.com:18080 --add-priority-node=nodes.hashvault.pro:18080 --enforce-dns-checkpointing --enable-dns-blocklist")}
              <div className="kicker">2 · start p2pool, once the node is synced</div>
              {cmd("w2", ".\\p2pool.exe --host 127.0.0.1 --wallet YOUR_WALLET_ADDRESS --mini")}
              <div className="kicker">3 · start the miner</div>
              {cmd("w3", ".\\xmrig.exe -o 127.0.0.1:3333")}
              <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
                XMRig prints its own speed once it connects, and P2Pool logs each share it accepts
                from you — those two together are the check that it is really working. Any wallet
                address configured in XMRig is ignored when mining to P2Pool: the address in step 2
                is the one that gets paid.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                <Src href={SRC.p2poolRel}>P2Pool releases</Src>
                <Src href={SRC.xmrigRel}>XMRig releases</Src>
              </div>
            </div>
          </Disclosure>

          <Disclosure
            id="linux"
            label="Linux"
            summary="Static binaries, or build from source. The reference platform upstream."
            meta={<Pill>binaries or source</Pill>}
            open={openPlatform === "linux"}
            onToggle={() => setOpenPlatform("linux")}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 6px" }}>
              <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
                Take the latest P2Pool release and the <code className="hash">linux-static-x64</code>{" "}
                XMRig build, or compile both. All three programs want huge pages, so reserve them
                first. Open ports 18080 (Monero peer-to-peer) and 37888 (P2Pool mini) in your firewall
                for better connectivity.
              </p>
              <div className="kicker">1 · reserve huge pages for all three programs</div>
              {cmd("l0", "sudo sysctl vm.nr_hugepages=3072")}
              <div className="kicker">2 · start your node</div>
              {cmd("l1", "./monerod --zmq-pub tcp://127.0.0.1:18083 --out-peers 32 --in-peers 64 --add-priority-node=p2pmd.xmrvsbeast.com:18080 --add-priority-node=nodes.hashvault.pro:18080 --enforce-dns-checkpointing --enable-dns-blocklist")}
              <div className="kicker">3 · start p2pool, once the node is synced</div>
              {cmd("l2", "./p2pool --host 127.0.0.1 --wallet YOUR_WALLET_ADDRESS --mini")}
              <div className="kicker">4 · start the miner</div>
              {cmd("l3", "./xmrig -o 127.0.0.1:3333")}
              <div className="kicker">5 · check it is really working</div>
              {cmd("l4", "grep -E 'WARNING|ERROR' p2pool.log")}
              <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
                A quiet log plus XMRig's own speed readout is the healthy state. Initial P2Pool sync
                should not take more than five to ten minutes. If your upload bandwidth is under
                10 Mbit, upstream suggests <code className="hash">--out-peers 8 --in-peers 16</code>{" "}
                instead. To build rather than download, P2Pool's README carries the exact package
                list per distribution.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                <Src href={SRC.p2pool}>SChernykh/p2pool</Src>
                <Src href={SRC.xmrigRel}>XMRig releases</Src>
              </div>
            </div>
          </Disclosure>

          <Disclosure
            id="macos"
            label="macOS"
            summary="XMRig ships a macOS binary; P2Pool is a short Homebrew build."
            meta={<Pill>homebrew</Pill>}
            open={openPlatform === "macos"}
            onToggle={() => setOpenPlatform("macos")}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 6px" }}>
              <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
                XMRig publishes official macOS binaries. P2Pool is built from source, which is five
                commands and needs no prior C++ knowledge. For the node itself,{" "}
                <Link className="acc" to={R.OPERATE_NODE}>the node page</Link> covers the
                click-to-install macOS bundle.
              </p>
              <div className="kicker">1 · dependencies</div>
              {cmd("m1", "brew update && brew install git cmake libuv zmq libpgm curl")}
              <div className="kicker">2 · build p2pool</div>
              {cmd("m2", "git clone --recursive https://github.com/SChernykh/p2pool")}
              {cmd("m3", "cd p2pool && mkdir build && cd build && cmake .. && make -j$(sysctl -n hw.logicalcpu)")}
              <div className="kicker">3 · start your node</div>
              {cmd("m4", "./monerod --zmq-pub tcp://127.0.0.1:18083 --out-peers 32 --in-peers 64 --enforce-dns-checkpointing --enable-dns-blocklist")}
              <div className="kicker">4 · p2pool, then the miner</div>
              {cmd("m5", "./p2pool --host 127.0.0.1 --wallet YOUR_WALLET_ADDRESS --mini")}
              {cmd("m6", "./xmrig -o 127.0.0.1:3333")}
              <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
                A laptop mining under load runs hot and loud, and thermal throttling will quietly take
                the speed back. If the fans matter to you, cap XMRig's thread count rather than
                leaving it to claim the machine.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                <Src href={SRC.p2pool}>SChernykh/p2pool</Src>
                <Src href={SRC.xmrigRel}>XMRig releases</Src>
              </div>
            </div>
          </Disclosure>

          <Disclosure
            id="android"
            label="Android"
            summary="Termux and a compiler. A participation path, not a profit one."
            meta={<Pill tone="warn">termux · build required</Pill>}
            open={openPlatform === "android"}
            onToggle={() => setOpenPlatform("android")}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 6px" }}>
              <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
                Android mining is a Termux job, and it is the one platform here with no ready-made
                binary at either end. Install Termux from F-Droid or from its own GitHub releases —
                Termux's maintainers describe the Google Play build as an experimental branch with
                missing functionality, and recommend F-Droid or GitHub for everyone who can use them.
                Do not mix APKs from different sources; they are signed with different keys and will
                refuse to install over each other.
              </p>
              <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
                Two hard constraints before you start. The device must be 64-bit: P2Pool does not
                support ARMv7 or any 32-bit CPU, because RandomX is too slow in 32-bit mode. And there
                is no packaged XMRig in Termux, so it is compiled — with hwloc disabled, since Termux
                does not package that library either.
              </p>
              <div className="kicker">1 · toolchain and libraries</div>
              {cmd("a1", "pkg install git build-essential cmake libuv libzmq libcurl openssl")}
              <div className="kicker">2 · build the miner</div>
              {cmd("a2", "git clone https://github.com/xmrig/xmrig && mkdir xmrig/build && cd xmrig/build")}
              {cmd("a3", "cmake .. -DWITH_HWLOC=OFF && make -j$(nproc)")}
              <div className="kicker">3 · point it at a P2Pool you already run</div>
              {cmd("a4", "./xmrig -o 192.168.1.10:3333")}
              <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
                Replace that address with your own P2Pool host on your LAN. Running the full stack on
                the phone is possible — P2Pool's README carries a Termux build for the daemon too —
                but a phone is a poor place for a synced node, and pointing it at a machine you
                already run is the shape that actually makes sense.
              </p>
              <div className="kicker" style={{ color: "var(--y-50)" }}>What it costs the device</div>
              <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.65 }}>
                Sustained full-core load on a phone means heat, a flat battery and a throttled CPU
                within minutes, and heat is what ages a battery fastest. Mine on a charger, on a cool
                surface, in short sessions, and treat the result as participation rather than income.
                That is the honest framing for every device on this page, and it is unavoidable on
                this one.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                <Src href={SRC.termux}>Termux on F-Droid</Src>
                <Src href={SRC.xmrig}>xmrig/xmrig</Src>
                <Src href={SRC.p2pool}>SChernykh/p2pool</Src>
              </div>
            </div>
          </Disclosure>
        </div>

        <Card style={{ padding: 16, marginTop: 12 }}>
          <div className="kicker">One disclosure that belongs with the miner, not after it</div>
          <p className="mono dim" style={{ margin: "8px 0 0", fontSize: "var(--fs-body)", lineHeight: 1.65 }}>
            XMRig donates <b>1% of your mining time to its authors by default</b> — one minute in
            every hundred — and its README says so plainly. The level is a configuration option and
            can be turned down. This page is telling you to run the software, so it is this page's job
            to tell you that, rather than leaving you to find it in a config file later.
          </p>
        </Card>
      </section>

      {/* ── The visual ─────────────────────────────────────────────────── */}
      <section>
        <div className="kicker">What “hyper-decentralized” looks like</div>
        <p className="mono dim" style={{ margin: "8px 0 14px", fontSize: "var(--fs-body)", lineHeight: 1.6, maxWidth: "72ch" }}>
          A network of equals, which is what a CPU-friendly proof of work plus a pool with no operator
          actually produces. Nothing in the picture is bigger than anything else, and there is no
          middle for anyone to occupy.
        </p>
        <DecentralField />
      </section>

      {/* ── Cross-links ────────────────────────────────────────────────── */}
      <section>
        <div className="kicker">Where to go next</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12, marginTop: 12 }}>
          <Card style={{ padding: 16 }}>
            <div className="serif" style={{ fontSize: 17, color: "var(--ink-100)" }}>Run a node first</div>
            <p className="mono dim" style={{ margin: "8px 0 10px", fontSize: "var(--fs-body)", lineHeight: 1.55 }}>
              Every walkthrough above starts with a synced node of your own. That is the prerequisite
              page, and it is the item directly above this one in the Operate section.
            </p>
            <Link className="acc mono" to={R.OPERATE_NODE} style={{ fontSize: "var(--fs-label)" }}>/operate/node →</Link>
          </Card>

          <Card style={{ padding: 16 }}>
            <div className="serif" style={{ fontSize: 17, color: "var(--ink-100)" }}>Already run an Umbrel box?</div>
            <p className="mono dim" style={{ margin: "8px 0 10px", fontSize: "var(--fs-body)", lineHeight: 1.55 }}>
              The Superbrain community store packages P2Pool and XMRig as one Umbrel app that accepts
              external miners over your LAN or Tailscale — the fifth path, and the shortest one if you
              already run that box. The hub publishes the single line that points a miner at it, and
              this page deliberately does not restate it: one surface owns that command, so there is
              no second copy to drift.
            </p>
            <Link className="acc mono" to={R.OPERATE_SUPERSTRESS} style={{ fontSize: "var(--fs-label)" }}>/operate/superstress →</Link>
          </Card>

          <Card style={{ padding: 16 }}>
            <div className="serif" style={{ fontSize: 17, color: "var(--ink-100)" }}>Is mining legal where you are?</div>
            <p className="mono dim" style={{ margin: "8px 0 10px", fontSize: "var(--fs-body)", lineHeight: 1.55 }}>
              The legality matrix carries a dedicated <code className="hash">mine</code> column, per
              jurisdiction, each row dated and cited. That is the answer to this question, and
              restating it here would only give it a second place to go stale.
            </p>
            <Link className="acc mono" to={`${R.MONERO}/legality`} style={{ fontSize: "var(--fs-label)" }}>/monero/legality →</Link>
          </Card>

          <Card style={{ padding: 16 }}>
            <div className="serif" style={{ fontSize: 17, color: "var(--ink-100)" }}>When RandomX arrived</div>
            <p className="mono dim" style={{ margin: "8px 0 10px", fontSize: "var(--fs-body)", lineHeight: 1.55 }}>
              Activated on the Monero network on 30 November 2019, after four independent security
              audits that year. The timeline has the event; the network page has the live seed hash
              and the difficulty it feeds.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link className="acc mono" to={`${R.LEARN}/timeline?e=randomx-activated`} style={{ fontSize: "var(--fs-label)" }}>/learn/timeline →</Link>
              <Link className="acc mono" to={R.LIVE_NETWORK} style={{ fontSize: "var(--fs-label)" }}>/live/network →</Link>
            </div>
          </Card>
        </div>
      </section>
    </PageShell>
  );
}
