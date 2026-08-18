/**
 * pages/operate/StressnetExplorerPage.tsx — /operate/superstress/explorer.
 * The classic mempool-explorer LAYOUT, driven entirely by the wind tunnel.
 * p4·07.
 *
 * ── THE ONE THING TO UNDERSTAND BEFORE EDITING THIS FILE ────────────────
 * Every other page on this site is either live data or an openly-labelled
 * simulator inside `/learn/sim`. This one wears an explorer's clothes — block
 * tiles, confirmation counts, a fee structure, a transaction feed — while
 * every number in it is invented by `protocols/stressnet-chain.ts`. A crop of
 * this page is one badge away from looking like a chain reading, and that is
 * the whole risk the release manages.
 *
 * So the honesty contract is not decoration on top of the page. It IS the
 * page, and it has four clauses, all four of them inherited from the rule
 * /operate/superstress wrote down in p3·19 before there was anything to apply
 * it to (see SuperstressPage.tsx's `[data-betanet-rule]`):
 *
 *   1. A PERSISTENT banner. `position: sticky` at the top of the scroller, so
 *      it is on screen at every scroll position rather than only at the top of
 *      a 3,000px page. verify-explorer §1 measures it at BOTH extremes and at
 *      390px, because "the element exists" is satisfied by a banner that has
 *      scrolled a screenful out of sight.
 *   2. AN ACCENT USED NOWHERE ELSE. `BETANET_ACCENT` below appears in no other
 *      file in the repo — verify-explorer §6 sweeps the tree to prove it, and
 *      pairs that with a computed-style check so the sweep cannot pass on an
 *      unused constant. Sharing a colour with mainnet numbers is exactly how a
 *      screenshot of this page becomes indistinguishable from /live/mempool.
 *   3. ITS OWN PROVENANCE BADGE. Every badge here is `model`, an existing
 *      ProvSource member — no new provenance type was minted. §3 asserts the
 *      other four are absent, which is the half that actually fails.
 *   4. NEVER SHARING A PANEL WITH MAINNET NUMBERS. There are none on this
 *      page. It reads no feed, imports no `MoneroLive`, and renders nothing
 *      that came from a node.
 *
 * ── WHY THIS DOES NOT IMPORT MemViewShell, WHICH DOES EXIST ─────────────
 * The obvious build is "reuse the classic view with a synthetic MoneroLive".
 * It was read and refused, and the reason is specific rather than stylistic:
 *
 *   - `MemViewShell` (mempool-shared.tsx:372) renders `MempoolHeartbeat`
 *     UNCONDITIONALLY, and that component prints "LIVE · updated Ns ago" with
 *     a title reading "Feed polling ~every 2.5s". On a simulated page that is
 *     not a styling mismatch, it is a false statement in the chrome.
 *   - `classic.tsx:586` renders `<NodeProvenance source="node" …>` and `:143`
 *     `source="session"`. NODE means "telemetry from the node this site
 *     reads". Reusing the component means shipping that badge.
 *
 * The mempool primitives are otherwise perfectly reusable — a scoped sweep of
 * `src/mempool/` and `src/views/` finds no import of `useMoneroLive` or of any
 * router hook, so they take their data as a parameter. The blocker is
 * semantic, not structural. What is reused here is therefore the IDIOM (the
 * four-tier bucketing, the confirmation-depth reading, the tile ribbon) and
 * not the components; `stressnet-chain.ts`'s `SIM_TIERS` deliberately mirrors
 * `classic.tsx`'s `CLASSIC_TIERS` vocabulary so a reader moving between the
 * two surfaces is not learning a second scheme.
 *
 * ── NO PULSING LEDS, ANYWHERE ───────────────────────────────────────────
 * `Pill`'s `dot` prop renders a PULSING led. p4·06 recorded that exact defect
 * one release ago — a constant dressed as a live reading because the crumbs
 * LED pulsed beside it. Nothing on this page pulses, and `dot` is never
 * passed.
 *
 * ── ZERO NEW STYLESHEET RULES ───────────────────────────────────────────
 * `cssGz` had 416 B of margin at this PR's base. Everything below reuses
 * existing classes (`.mono`, `.dim`, `.kicker`, `.stat`, `.pill`, `.panel`,
 * `.v6-res`, `.table-scroll`) plus inline styles, so this page adds nothing to
 * that budget at all.
 */

import * as React from "react";
import { Link } from "react-router-dom";
import { R } from "../../../scripts/routes.mjs";
import { PageShell } from "@/layout/PageShell";
import { PageHeader } from "@/layout/AppShell";
import { Card, Crumbs, Stat } from "@/design/primitives";
import { Provenance } from "@/design/provenance";
import { useReducedMotion } from "@/design/useReducedMotion";
import { useAnimationSeconds } from "@/design/useAnimationClock";
import {
  MODEL_SOURCE, SOURCE_LABEL, SIM_TIERS, SIM_SPEED, CHAIN_DEPTH,
  BLOCK_SEC, CAP_KB, kb,
} from "@/protocols/stressnet-chain";
import type { SimChain, SimTx } from "@/protocols/stressnet-chain";

/**
 * The betanet accent — clause 2 of the p3·19 rule, and it is MEASURED rather
 * than chosen by eye:
 *
 *   - It appears in NO other file under `src/` or in any stylesheet. Verified
 *     by sweep, and verify-explorer §6 re-runs that sweep on every CI run so
 *     it cannot quietly become shared.
 *   - Its contrast against every one of this site's three theme grounds is
 *     ≥ 7.14:1 (#050505 7.80 · #0a0907 7.62 · #11100c 7.29 · indigo #121218
 *     7.14 · phosphor #0b1410 7.17) — WCAG AAA for normal text on all of them,
 *     which matters because the banner is the one element that must stay
 *     legible in every theme.
 *   - It is hue-distinct from all five semantic palette members: green
 *     #4ade80 (confirm), red #ff4d6d (drop), yellow #ffd400 (warning), purple
 *     #b87aff (Monero privacy), cyan #5ed3f4 (secondary data), and from
 *     `--tk-accent`, which on this site means crypto data and nothing else.
 *
 * It is a literal rather than a CSS custom property on purpose: a token in
 * `styles.css` costs the `cssGz` budget and, more importantly, invites reuse.
 * This colour's entire job is to be unshared.
 */
const BETANET_ACCENT = "#ff5cf0";

/** Where the simulated chain's heights start. Deliberately NOT near any real
 *  chain's height — a plausible mainnet number printed beside simulated blocks
 *  is precisely the confusion the banner exists to prevent. */
const TIP_BASE = 40_000;

/** The dial's resting position. Chosen so every readout on the page is alive
 *  at first paint — at 42 the chain is over its median (a ~15% reward penalty,
 *  fees at ~1.9×) and still comfortably under the hard cap, so the ratchet is
 *  legible and the failure is still something the reader dials INTO rather
 *  than something they arrive at. At the simulator's own default of 28 the
 *  penalty is exactly 0 and two of the four stats read as dead. */
const DEFAULT_STORM = 42;

const MONO = "var(--f-mono)";

/* ── the persistent banner ───────────────────────────────────────────────── */

/**
 * Sticky rather than fixed. `main.main` is the scroller above 768px (`.art` is
 * `height:100vh; overflow:hidden`), so `position: sticky; top: 0` pins this to
 * the top of the reading column at every scroll offset without taking it out
 * of flow and overlaying content — which a `fixed` banner would do on a phone,
 * where the document scrolls instead.
 */
function BetanetBanner() {
  return (
    <div
      data-betanet-banner
      role="note"
      style={{
        position: "sticky", top: 0, zIndex: 40,
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10,
        margin: "0 0 18px", padding: "9px 13px",
        background: "var(--bg-0)",
        border: `1px solid ${BETANET_ACCENT}`,
        borderLeft: `4px solid ${BETANET_ACCENT}`,
        fontFamily: MONO, fontSize: "var(--fs-label)", letterSpacing: "0.1em",
      }}
    >
      <span style={{ color: BETANET_ACCENT, fontWeight: 700 }}>
        BETANET · NOT MAINNET · TEST FUNDS ONLY
      </span>
      <span style={{ color: BETANET_ACCENT, fontWeight: 700 }}>· SIMULATED ·</span>
      <span className="dim" style={{ letterSpacing: "0.04em" }}>
        every number on this page is produced by a model on this site. Nothing here was measured
        from any chain.
      </span>
    </div>
  );
}

/* ── small presentational pieces, in the classic idiom ───────────────────── */

function BlockTile({ b, conf, onPick, active }: {
  b: SimChain["blocks"][number]; conf: number;
  onPick: () => void; active: boolean;
}) {
  const fill = Math.min(1, b.weightKB / CAP_KB);
  return (
    <button
      type="button"
      onClick={onPick}
      data-sim-block
      data-sim-height={b.height}
      data-sim-kb={b.weightKB.toFixed(1)}
      data-sim-conf={conf}
      aria-label={`Simulated block ${b.height}, ${kb(b.weightKB)}, ${b.txCount} transactions, ${conf} confirmations`}
      aria-pressed={active}
      style={{
        flex: "0 0 auto", width: 96, textAlign: "left", cursor: "pointer",
        background: active ? "rgba(255,92,240,0.09)" : "var(--bg-1)",
        border: `1px solid ${active ? BETANET_ACCENT : "var(--rule)"}`,
        padding: "8px 9px", fontFamily: MONO, color: "var(--ink-80)",
      }}
    >
      <div style={{ fontSize: "var(--fs-label)", color: BETANET_ACCENT, letterSpacing: "0.06em" }}>
        #{b.height}
      </div>
      <div style={{ fontSize: "var(--fs-mono)", color: "var(--ink-100)", margin: "3px 0" }}>
        {kb(b.weightKB)}
      </div>
      {/* Weight against the hard cap, as a bar. No numerals inside it — the
          figure is already printed above, and a second copy is a second thing
          that can disagree. */}
      <div style={{ height: 4, background: "rgba(255,255,255,0.07)", marginBottom: 5 }}>
        <div style={{
          height: 4, width: `${fill * 100}%`,
          background: b.capped ? "var(--r-50)" : BETANET_ACCENT,
        }} />
      </div>
      <div className="dim" style={{ fontSize: "var(--fs-label)" }}>{b.txCount} tx</div>
      <div className="dim" style={{ fontSize: "var(--fs-label)" }}>
        {conf} conf{conf === 1 ? "" : "s"}
      </div>
    </button>
  );
}

function TierRow({ tier, txs, idx }: { tier: typeof SIM_TIERS[number]; txs: SimTx[]; idx: number }) {
  const n = txs.length;
  const lo = n ? Math.min(...txs.map((t) => t.perB)) : 0;
  const hi = n ? Math.max(...txs.map((t) => t.perB)) : 0;
  return (
    <div
      data-sim-tier={tier.id}
      style={{
        display: "grid", gridTemplateColumns: "minmax(0,1fr) auto",
        gap: 8, alignItems: "baseline",
        padding: "8px 0", borderTop: idx === 0 ? "none" : "1px solid var(--rule)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--ink-100)", letterSpacing: "0.08em" }}>
          {tier.label}
        </div>
        <div className="dim" style={{ fontSize: "var(--fs-label)" }}>{tier.desc}</div>
      </div>
      <div className="mono" style={{ textAlign: "right", fontSize: "var(--fs-label)" }}>
        <div style={{ color: "var(--ink-100)" }}>{n} tx</div>
        <div className="dim">{n ? `${lo.toLocaleString()}–${hi.toLocaleString()} pn/B` : "—"}</div>
        <div className="dim">{tier.eta}</div>
      </div>
    </div>
  );
}

/* ── the page ────────────────────────────────────────────────────────────── */

export function StressnetExplorerPage() {
  const reduced = useReducedMotion();
  const [storm, setStorm] = React.useState(DEFAULT_STORM);
  const [picked, setPicked] = React.useState<number | null>(null);

  /* The clock. `useAnimationSeconds` rather than a hand-rolled rAF, and that
     is not a preference: verify-govern §5 is a SOURCE assertion over every rAF
     driver in src/, requiring each to reach the shared visibility machinery or
     carry an exemption marker. p4·05 shipped a page that rolled its own loop
     and the full chain named it (`UNPAUSED: CloverOverlay.tsx`) after its own
     68-assertion gate passed. Using the shared clock inherits the pause for
     free, and means a reader who backgrounds the tab does not return to a
     chain that advanced 400 blocks without them.

     Under reduced motion `enabled: false` makes this return a literal 0, so
     the tip sits at TIP_BASE and the whole chain is frozen — deterministic,
     complete, and identical for every reader. Nothing is lost, because the
     chain is seeded: the frozen state is the SAME chain, not one arbitrary
     draw of it. */
  const t = useAnimationSeconds({ fps: 4, enabled: !reduced });
  const tip = TIP_BASE + Math.floor((t * SIM_SPEED) / BLOCK_SEC);

  const chain: SimChain = React.useMemo(
    () => MODEL_SOURCE.read(storm, tip), [storm, tip]);

  const m = chain.m;
  const buckets = React.useMemo(() => {
    const out: SimTx[][] = [[], [], [], []];
    for (const tx of chain.mempool) out[tx.tierIdx].push(tx);
    return out;
  }, [chain]);

  const pickedBlock = picked == null ? null : chain.blocks.find((b) => b.height === picked) ?? null;
  const prov = <Provenance source="model" detail={SOURCE_LABEL[chain.source]} />;

  return (
    <PageShell width="standard">
      <div data-explorer-root>
        <BetanetBanner />

        <Crumbs path={R.OPERATE_SUPERSTRESS_EXPLORER} />
        {/* FIVE HEADER ELEMENTS, FIVE DIFFERENT FACTS — and the first draft had
            them saying one fact five times. Rendered at 390 the stack read:
            "BETA-CHAIN EXPLORER" (crumb) · "OPERATE · SUPERSTRESS · SIMULATED
            EXPLORER" (kicker) · "Beta-chain explorer — simulated" (h1) · "…no
            chain was read" (sub) · "SIMULATED" (pill) — the word "explorer"
            three times and "simulated" three times before a single number.
            That is p3·16's duplicate-label defect ("5 APPS" printed twice
            within 60px) and p4·06's repeat of it, found the same way both
            times: by looking at the render, because no assertion compares two
            labels for saying the same thing.

            The kicker now names what DRIVES the page, which nothing else here
            says, and the right slot carries the MODEL badge rather than a
            second copy of the h1's own adjective. */}
        <PageHeader
          kicker="MODEL · WIND TUNNEL · NOTHING HERE WAS MEASURED"
          title="Beta-chain explorer — <em>simulated</em>"
          sub="the classic explorer layout, driven by the wind tunnel"
          right={prov}
        />

        <Card style={{ padding: 20, marginTop: 18, display: "grid", gap: 12 }}>
          <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.7 }}>
            This is what a block explorer for the Umbrel Superstress Net would look like, built
            from the only thing this site actually has: the wind-tunnel model on{" "}
            <Link className="acc" to={`${R.LEARN_SIM}?p=stressnet`}>the stressnet simulator</Link>.
            Turn the storm dial and the chain below responds the way Monero&rsquo;s dynamic block
            size says it should — blocks grow until they hit the hard cap at twice the median,
            the reward penalty climbs as they do, and once demand passes the cap the surplus backs
            up in the pool and the fee market bids against itself.
          </p>
          <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.7 }}>
            What it is NOT: a reading. There is no public endpoint for the real beta chain and
            there is not going to be one on this site —{" "}
            <Link className="acc" to={R.OPERATE_SUPERSTRESS}>the hub explains why</Link>, and the
            short version is that this site&rsquo;s content-security policy reaches no origin but
            its own and your node is not ours to proxy. So rather than a reserved box waiting for
            data that is never coming, here is the model, labelled, with its arithmetic on the
            page. The chain&rsquo;s own parameters are still undocumented and are still not
            invented here.
          </p>
        </Card>

        {/* ── the dial ─────────────────────────────────────────────── */}
        <Card style={{ padding: 20, marginTop: 14 }}>
          <div className="kicker" style={{ marginBottom: 10 }}>STORM CAMPAIGN · THE ONLY INPUT</div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <label htmlFor="explorer-storm" className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--ink-80)" }}>
              Storm intensity
            </label>
            <input
              id="explorer-storm" data-storm type="range" min={0} max={100} step={1}
              value={storm}
              onChange={(e) => setStorm(Number(e.target.value))}
              style={{ flex: "1 1 200px", minWidth: 150, accentColor: BETANET_ACCENT }}
            />
            <span className="mono" style={{ fontSize: "var(--fs-mono)", color: BETANET_ACCENT }}>
              {storm} / 100
            </span>
            <span
              className="mono"
              data-sim-broken={m.broken ? "true" : "false"}
              style={{ fontSize: "var(--fs-mono)", color: m.broken ? "var(--r-50)" : "var(--g-50)" }}
            >
              {m.broken ? "✗ CAP EXCEEDED · backlog growing" : "✓ HOLDING · demand fits under the cap"}
            </span>
          </div>
          <p className="mono dim" style={{ margin: "12px 0 0", fontSize: "var(--fs-label)", lineHeight: 1.6 }}>
            The simulated clock runs {SIM_SPEED}× wall time, so a block lands every few seconds
            instead of every {BLOCK_SEC}. Intervals are drawn from an exponential distribution
            because block arrivals are Poisson — a constant {BLOCK_SEC}s is the one thing about
            block timing every reader already knows is false. Under{" "}
            <span className="mono">prefers-reduced-motion</span> the chain holds still; because it
            is seeded rather than random, the still chain is the same chain, with every figure on
            this page unchanged.
          </p>
        </Card>

        {/* ── stats ────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))", gap: 10, marginTop: 14 }}>
          <div data-explorer-stat="tip">
            <Stat k="SIMULATED TIP" v={"#" + chain.tip} sub={`depth ${CHAIN_DEPTH} shown`} />
          </div>
          <div data-explorer-stat="weight">
            <Stat k="BLOCK WEIGHT" v={kb(m.blockKB)} sub={`median ${kb(m.medianKB)} · cap ${kb(CAP_KB)}`} tone="acc" />
          </div>
          <div data-explorer-stat="penalty">
            <Stat k="REWARD PENALTY" v={m.penaltyPct.toFixed(1) + "%"} sub="((B/M)−1)² of base" tone={m.penaltyPct > 20 ? "dn" : undefined} />
          </div>
          <div data-explorer-stat="fee">
            <Stat k="FEE MULTIPLIER" v={m.feeMult.toFixed(1) + "×"} sub={m.tier + " tier"} tone="p" />
          </div>
          <div data-explorer-stat="backlog">
            <Stat k="POOL BACKLOG" v={m.broken ? "+" + kb(m.backlogKB) : "none"} sub={m.broken ? "per block, growing" : "drains every block"} tone={m.broken ? "dn" : "g"} />
          </div>
        </div>

        {/* ── the ribbon ───────────────────────────────────────────── */}
        <Card style={{ padding: 20, marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
            <div className="kicker">SIMULATED BLOCKS · newest first</div>
            {prov}
          </div>
          <div className="table-scroll">
            <div style={{ display: "flex", gap: 8, paddingBottom: 4 }}>
              {chain.blocks.map((b, i) => (
                <BlockTile
                  key={b.height} b={b} conf={i + 1}
                  active={picked === b.height}
                  onPick={() => setPicked(picked === b.height ? null : b.height)}
                />
              ))}
            </div>
          </div>
          <p className="mono dim" style={{ margin: "10px 0 0", fontSize: "var(--fs-label)" }}>
            Confirmations are tip − height, the same reading the mainnet explorer gives. The bar is
            the block&rsquo;s weight against the {kb(CAP_KB)} hard cap; it turns red on a block that
            hit the cap and left demand behind.
          </p>

          {pickedBlock ? (
            <div style={{ marginTop: 12, borderTop: `1px solid ${BETANET_ACCENT}`, paddingTop: 12 }} data-sim-block-detail>
              <div className="kicker" style={{ color: BETANET_ACCENT, marginBottom: 8 }}>
                SIMULATED BLOCK #{pickedBlock.height}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: 10 }}>
                <Stat k="WEIGHT" v={kb(pickedBlock.weightKB)} />
                <Stat k="TRANSACTIONS" v={String(pickedBlock.txCount)} />
                <Stat k="INTERVAL" v={Math.round(pickedBlock.intervalSec) + "s"} sub={`target ${BLOCK_SEC}s`} />
                <Stat k="PENALTY" v={pickedBlock.penaltyPct.toFixed(1) + "%"} tone={pickedBlock.capped ? "dn" : undefined} />
              </div>
            </div>
          ) : null}
        </Card>

        {/* ── fee structure ────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 14, marginTop: 14 }}>
          <Card style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
              <div className="kicker">FEE STRUCTURE · simulated pool</div>
              {prov}
            </div>
            {SIM_TIERS.map((tier, i) => (
              <TierRow key={tier.id} tier={tier} txs={buckets[i]} idx={i} />
            ))}
            <p className="mono dim" style={{ margin: "10px 0 0", fontSize: "var(--fs-label)" }}>
              Bucketed by quartile over the simulated pool — the same scheme the mainnet explorer
              uses, so the two surfaces do not teach two different four-tier vocabularies.
            </p>
          </Card>

          <Card style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <div className="kicker">NEXT SIMULATED BLOCK</div>
              {prov}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--ink-100)" }}>
                {kb(Math.min(m.demandKB, CAP_KB))} of {kb(m.demandKB)} demand fits
              </div>
              <div style={{ height: 10, background: "rgba(255,255,255,0.07)", position: "relative" }}>
                <div style={{
                  height: 10, width: `${Math.min(100, (Math.min(m.demandKB, CAP_KB) / CAP_KB) * 100)}%`,
                  background: m.broken ? "var(--r-50)" : BETANET_ACCENT,
                }} />
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute", top: -3, bottom: -3,
                    left: `${Math.min(100, (m.medianKB / CAP_KB) * 100)}%`,
                    width: 1, background: "var(--y-50)",
                  }}
                />
              </div>
              <div className="dim mono" style={{ fontSize: "var(--fs-label)" }}>
                the yellow rule is the median · the bar ends at the {kb(CAP_KB)} hard cap
              </div>
              <div className="mono" style={{ fontSize: "var(--fs-mono)", color: m.broken ? "var(--r-50)" : "var(--g-50)", marginTop: 4 }}>
                {m.broken
                  ? `${kb(m.backlogKB)} does not fit and stays pending`
                  : "the whole pool clears in the next simulated block"}
              </div>
              <div className="dim mono" style={{ fontSize: "var(--fs-label)", lineHeight: 1.6, marginTop: 4 }}>
                FCMP++ verification for a block this size is{" "}
                {(m.verifyMs / 1000).toFixed(1)}s of the {BLOCK_SEC}s budget ({m.verifyPct.toFixed(1)}%).
                That is the wind tunnel&rsquo;s finding restated: at this scale the binding
                constraint is the block-size ratchet, not proof verification.
              </div>
            </div>
          </Card>
        </div>

        {/* ── the pool ─────────────────────────────────────────────── */}
        <Card style={{ padding: 20, marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
            <div className="kicker">SIMULATED POOL · {chain.mempool.length} pending</div>
            {prov}
          </div>
          <div className="table-scroll">
            <table className="mono" style={{ width: "100%", minWidth: 520, borderCollapse: "collapse", fontSize: "var(--fs-label)" }}>
              {/* Explicit widths: with `auto` layout the txid column claimed
                  only its own text width and left a ~30% gap before TIER at
                  1440. Percentages rather than px so the same table still
                  swipes inside `.table-scroll` on a phone. */}
              <colgroup>
                <col style={{ width: "34%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "16%" }} />
              </colgroup>
              <caption className="dim" style={{ captionSide: "top", textAlign: "left", paddingBottom: 8, fontSize: "var(--fs-label)" }}>
                Every id below is synthetic and marked <span style={{ color: BETANET_ACCENT }}>sim:</span> —
                none of them is, or resembles, a real transaction hash.
              </caption>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--ink-60)" }}>
                  <th style={{ padding: "6px 8px 6px 0", fontWeight: 400 }}>TXID</th>
                  <th style={{ padding: "6px 8px", fontWeight: 400 }}>TIER</th>
                  <th style={{ padding: "6px 8px", fontWeight: 400, textAlign: "right" }}>pn/B</th>
                  <th style={{ padding: "6px 8px", fontWeight: 400, textAlign: "right" }}>SIZE</th>
                  <th style={{ padding: "6px 0 6px 8px", fontWeight: 400, textAlign: "right" }}>AGE</th>
                </tr>
              </thead>
              <tbody>
                {chain.mempool.map((tx) => (
                  <tr key={tx.id} style={{ borderTop: "1px solid var(--rule)" }}>
                    <td
                      data-sim-txid={tx.id}
                      style={{ padding: "5px 8px 5px 0", color: "var(--ink-80)", whiteSpace: "nowrap" }}
                    >
                      <span style={{ color: BETANET_ACCENT }}>sim:</span>
                      {tx.id.slice(4)}
                    </td>
                    <td style={{ padding: "5px 8px", color: "var(--ink-60)" }}>{SIM_TIERS[tx.tierIdx].label}</td>
                    <td style={{ padding: "5px 8px", textAlign: "right", color: "var(--ink-100)" }}>{tx.perB.toLocaleString()}</td>
                    <td style={{ padding: "5px 8px", textAlign: "right", color: "var(--ink-60)" }}>{(tx.sizeB / 1000).toFixed(1)} kB</td>
                    <td style={{ padding: "5px 0 5px 8px", textAlign: "right", color: "var(--ink-60)" }}>{tx.ageSec}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ── where to go next ─────────────────────────────────────── */}
        <Card style={{ padding: 20, marginTop: 14 }}>
          <div className="kicker" style={{ marginBottom: 10 }}>THE REAL THING</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} data-explorer-crosslinks>
            <Link className="v6-res" to={R.OPERATE_SUPERSTRESS}>
              <span className="led" style={{ background: "var(--g-50)", boxShadow: "0 0 6px var(--g-50)" }} />
              The Superstress hub →
            </Link>
            <Link className="v6-res" to={`${R.LEARN_SIM}?p=stressnet`}>
              <span className="led" style={{ background: "var(--tk-accent)", boxShadow: "0 0 6px var(--tk-accent)" }} />
              The wind tunnel this is built on →
            </Link>
            <Link className="v6-res" to={R.LIVE_MEMPOOL}>
              <span className="led" style={{ background: "var(--c-50)", boxShadow: "0 0 6px var(--c-50)" }} />
              A real mempool, on mainnet →
            </Link>
          </div>
          <p className="mono dim" style={{ margin: "12px 0 0", fontSize: "var(--fs-label)", lineHeight: 1.6 }}>
            The last of those is the honest comparison: same layout, same four-tier vocabulary,
            same confirmation reading — and a NODE badge on every panel instead of a MODEL one,
            because those numbers were measured.
          </p>
        </Card>
      </div>
    </PageShell>
  );
}
