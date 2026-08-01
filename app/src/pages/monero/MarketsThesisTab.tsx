/**
 * pages/monero/MarketsThesisTab.tsx — Price action · thesis · macro view · 2026.
 * Ported verbatim from five01 monero-pages.jsx → MoneroMarketsThesis (lines 598–807).
 */

import * as React from "react";
import { PageHeader } from "@/layout/AppShell";
import { Card } from "@/design/primitives";
import { AXIS, ChartCrosshair, ChartTip, GRID, VB_W, useSvgCursor, type ChartTipRow } from "@/design/chart-kit";
import { useReducedMotion } from "@/design/useReducedMotion";
import type { MoneroTabProps } from "./tabs";

const THESIS_STATS = [
  { v: "$625,000", w: "IRS bounty for cracking Monero. They failed." },
  { v: "$22M",     w: "Chainalysis contract to trace it. Their own leaked training admits they cannot." },
  { v: "73",       w: "Exchange delistings in 2025 alone. Because they cannot comply with surveillance laws while offering true privacy." },
  { v: "+195%",    w: "Monero's price in 2025. Because demand for privacy is not a crime — it is a human right." },
] as const;

const CATALYST_CARDS = [
  { h: "Political shift",    c: "var(--tk-accent)", b: "High-profile US policymakers reframed privacy as a 'constitutional right' alongside global economic uncertainty driving capital toward financial-autonomy assets." },
  { h: "Technical breakout", c: "var(--c-50)",      b: "Cleared multi-year resistance into price discovery. Capital rotation out of transparent chains into privacy-focused assets accelerated the move." },
  { h: "Zcash collapse",     c: "var(--y-50)",      b: "ECC dev team resignation triggered a ~20% ZEC drawdown. Major capital rotation directly into Monero." },
  { h: "Paradox validation", c: "var(--p-50)",      b: "Dubai DFSA ban on privacy tokens paradoxically validated Monero's tech. CLARITY Act progress highlighted the surveillance-vs-privacy divide." },
  { h: "The descent",        c: "var(--r-50)",      b: "By early February, XMR retraced 57% — driven by accelerated delistings including Binance. Pattern: pump on validation, retrace on access restriction, higher lows each cycle." },
] as const;

const DEMAND_DRIVERS = [
  {
    n: "I", t: "CLARITY · GENIUS · DAC8",
    h: "The 'tracked economy' reaction",
    c: "var(--tk-accent)",
    b: "The GENIUS and CLARITY Acts now require all digital-currency trading to follow disclosure and registration rules similar to other regulated assets. New IRS rules require Form 1099-DA reporting starting 2026; the EU's DAC8 directive (live since Jan 1 2026) forces CASPs to disclose customer and transaction details to tax officials. Every new reporting mandate is essentially free marketing for the one asset that can't be surveilled.",
  },
  {
    n: "II", t: "Sanctions evasion · geopolitics",
    h: "Iran, the IRGC, and the BTC→XMR migration",
    c: "var(--r-50)",
    b: "Iran built a multi-billion-dollar parallel economy on state-sponsored BTC mining and stablecoins. IRGC accounts received >$3B in 2025 alone. Cost to mine 1 BTC in Iran ≈ $1,320 (subsidized power) vs. market ~$68,000 — a massive arbitrage. As Chainalysis improves BTC tracing of IRGC wallets, the logical next step for sanctioned actors is migration toward untraceable assets. State-driven sanctions evasion volume surged 694% in 2025.",
  },
  {
    n: "III", t: "Darknet markets · already happening",
    h: "Privacy as a network effect",
    c: "var(--p-50)",
    b: "TRM Labs data shows 48% of newly launched darknet marketplaces in 2025 now support XMR exclusively — a sharp acceleration from prior years. Monero is mandatory or preferred on 89% of active markets, with monthly transaction volume estimated at $450M+. Every Chainalysis upgrade, every BTC seizure using on-chain forensics, pushes more volume into XMR permanently.",
  },
  {
    n: "IV", t: "CBDC surveillance state",
    h: "The macro tailwind",
    c: "var(--c-50)",
    b: "BIS reports 91 of 93 surveyed central banks are actively investigating retail or wholesale CBDCs. China's digital yuan is already live; EU is deep into digital-euro pilots. During the ECB consultation, 41% of public comments centered on privacy concerns. Every CBDC launch creates a new cohort of users who realize their government can now see every transaction, freeze funds programmatically, and restrict spending categories. Monero becomes the escape valve.",
  },
  {
    n: "V", t: "Technical upgrades making XMR stronger",
    h: "FCMP++, Cuprate, Seraphis, Jamtis",
    c: "var(--g-50)",
    b: "FCMP++ (mid-2026, tentative) replaces 16-decoy rings with proofs over the entire 150M+ UTXO set, making chain analysis computationally impractical. Cuprate (Rust node) cuts sync times sharply, supporting decentralization under political pressure. Seraphis & Jamtis modernize the transaction structure and add human-readable addresses — currently in beta/audit.",
  },
  {
    n: "VI", t: "The meta-thesis",
    h: "Structural inevitability",
    c: "var(--ink-100)",
    b: "The world is simultaneously doing two contradictory things: making transparent crypto the regulated norm (GENIUS, CLARITY, DAC8, 1099-DA, Travel Rule) while expanding state surveillance capacity (CBDCs, chain analytics, KYC everywhere). Every step in that direction creates organic, non-speculative demand for the one asset that provides genuine financial privacy by default. The supply side matters too — Monero is already in tail emission with 0.6 XMR / block forever. 73 exchanges delisted in 2025; on-chain activity stayed flat or grew.",
  },
] as const;

const TRACKED_ECONOMY_ITEMS = [
  "Regulation tightens.",
  "Surveillance expands.",
  "CBDCs launch.",
  "Chain analytics improves.",
  "Reporting mandates multiply.",
  "The tracked economy becomes inescapable.",
] as const;

const OTHER_SIDE_ITEMS = [
  "One protocol.",
  "Mathematically private.",
  "Perpetually maintained.",
  "Increasingly hardened.",
  "Supply fixed at tail emission.",
  "Access window narrows with every delisting.",
] as const;

// Numeric mirrors of the historical facts already stated in `peak` / `drawdown`
// below — same figures, just typed for the chart's geometry. No new numbers:
// `peakUsd`/`peakDate` are the dollar amount and month parenthesised in `peak`;
// `drawdownPct` is the percentage in `drawdown`; `troughUsd` is the trough
// dollar figure in `drawdown` where one is stated. The 2026 row states a
// retrace percentage but no trough dollar figure yet, so `troughUsd` is
// intentionally omitted there rather than derived/estimated.
interface CycleHigh {
  cyc: string;
  peak: string;
  peakUsd: number;
  peakDate: string; // "YYYY-MM", month precision only — no day is stated in copy
  drawdown: string;
  drawdownPct: number; // negative
  troughUsd?: number;
  note: string;
}

const CYCLE_HIGHS: readonly CycleHigh[] = [
  { cyc: "2017 cycle", peak: "$494 (Jan 2018)",    peakUsd: 494,    peakDate: "2018-01", drawdown: "−92% to $40",        drawdownPct: -92, troughUsd: 40,  note: "Pre-bulletproofs, fee shock, exchange hype" },
  { cyc: "2020 cycle", peak: "$517 (May 2021)",    peakUsd: 517,    peakDate: "2021-05", drawdown: "−74% to $135",       drawdownPct: -74, troughUsd: 135, note: "DeFi bull, ring-16 mandatory, Bulletproofs+" },
  { cyc: "2024 cycle", peak: "$487 (Mar 2025)",    peakUsd: 487,    peakDate: "2025-03", drawdown: "−42% to $282",       drawdownPct: -42, troughUsd: 282, note: "Post-MiCA panic, shallow drawdown · structural buyers" },
  { cyc: "2026 ATH",   peak: "$799.89 (Jan 2026)", peakUsd: 799.89, peakDate: "2026-01", drawdown: "−57% retrace · Feb", drawdownPct: -57,                 note: "Convergence: CLARITY · DAC8 · Zcash collapse · sanctions migration" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function yearFrac(iso: string): number {
  const [y, m] = iso.split("-").map(Number);
  return y + (m - 1) / 12;
}

function fmtDateLabel(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

function fmtPrice(v: number): string {
  return "$" + (v >= 100 ? v.toFixed(0) : v.toFixed(2));
}

function fmtPct(v: number): string {
  return (v < 0 ? "−" : "+") + Math.abs(v) + "%";
}

/** {1,2,5}×10^k ticks within [min, max] — a log-scale analogue of the linear
 * "nice ticks" idiom used elsewhere (see markets/charts.tsx niceTicks). */
function logTicks(min: number, max: number): number[] {
  if (!(min > 0) || !(max > min)) return [min];
  const out: number[] = [];
  const kLo = Math.floor(Math.log10(min));
  const kHi = Math.ceil(Math.log10(max));
  for (let k = kLo; k <= kHi; k++) {
    for (const s of [1, 2, 5]) {
      const v = s * Math.pow(10, k);
      if (v >= min && v <= max) out.push(v);
    }
  }
  return out;
}

/**
 * CycleHighsChart — the "refusing-to-die" chart. Marks each stated cycle high
 * (and, where the copy states a trough dollar figure, its drawdown) on a
 * log-price timeline. Deliberately NOT a continuous/interpolated price line:
 * CYCLE_HIGHS holds four sparse historical peaks, not a price series, so
 * connecting them with a smoothed curve would imply price action between
 * cycles that was never measured. Marked points only — see handoff notes.
 */
function CycleHighsChart() {
  const H = 320;
  const padL = 54, padR = 26, padT = 40, padB = 34;
  const innerW = VB_W - padL - padR, innerH = H - padT - padB;

  const xMin = 2014, xMax = 2027.3;
  const yMin = 30, yMax = 950;

  const xOf = (yf: number) => padL + ((yf - xMin) / (xMax - xMin)) * innerW;
  const py = (v: number) => padT + innerH - (Math.log10(v / yMin) / Math.log10(yMax / yMin)) * innerH;

  const yTicks = logTicks(yMin, yMax);
  const xTicks: number[] = [];
  for (let yr = Math.ceil(xMin); yr <= Math.floor(xMax); yr += 3) xTicks.push(yr);

  const reduced = useReducedMotion();
  const [fade, setFade] = React.useState(reduced ? 1 : 0);
  React.useEffect(() => {
    if (reduced) { setFade(1); return; }
    const id = requestAnimationFrame(() => setFade(1));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  const [ref, vx, handlers] = useSvgCursor(VB_W);
  // Points aren't evenly spaced in time, so snap to nearest by pixel distance
  // rather than chart-kit's nearestIndex (which assumes uniform spacing).
  const xs = CYCLE_HIGHS.map((c) => xOf(yearFrac(c.peakDate)));
  const hoverI = vx == null ? null : xs.reduce((best, x, i) => (Math.abs(x - vx) < Math.abs(xs[best] - vx) ? i : best), 0);
  const hover = hoverI != null ? CYCLE_HIGHS[hoverI] : null;

  const tipRows: ChartTipRow[] = hover
    ? [
        { label: "CYCLE", value: hover.cyc },
        { label: "DATE", value: fmtDateLabel(hover.peakDate) },
        { label: "PEAK", value: fmtPrice(hover.peakUsd), color: "var(--tk-accent)" },
        { label: "DRAWDOWN", value: hover.drawdown, color: "var(--r-50)" },
        { value: hover.note, color: "var(--ink-60)" },
      ]
    : [];

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${VB_W} ${H}`}
      width="100%"
      style={{ display: "block", touchAction: "pan-y", opacity: fade, transition: reduced ? "none" : "opacity 0.35s ease" }}
      {...handlers}
    >
      <text x={padL} y={20} fontFamily="var(--f-mono)" fontSize="9" fill="var(--tk-accent)" letterSpacing="0.1em">CYCLE HIGH · USD (log)</text>
      <text x={padL + 210} y={20} fontFamily="var(--f-mono)" fontSize="9" fill="var(--r-50)" letterSpacing="0.1em">DRAWDOWN → TROUGH</text>

      {/* y gridlines + log price ticks */}
      {yTicks.map((t) => (
        <g key={"yt" + t}>
          <line x1={padL} y1={py(t)} x2={padL + innerW} y2={py(t)} stroke={GRID} strokeDasharray="2 4" />
          <text x={padL - 8} y={py(t) + 3} textAnchor="end" fontFamily="var(--f-mono)" fontSize="10" fill={AXIS}>{fmtPrice(t)}</text>
        </g>
      ))}

      {/* x axis + year ticks */}
      <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke={GRID} />
      {xTicks.map((yr) => (
        <text key={"xt" + yr} x={xOf(yr)} y={H - 10} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9.5" fill={AXIS}>{yr}</text>
      ))}

      {/* marked cycle highs (+ stated troughs) — no interpolation between them */}
      {CYCLE_HIGHS.map((c) => {
        const x = xOf(yearFrac(c.peakDate));
        const yPeak = py(c.peakUsd);
        const yTrough = c.troughUsd != null ? py(c.troughUsd) : null;
        return (
          <g key={c.cyc}>
            {yTrough != null ? (
              <>
                <line x1={x} y1={yPeak} x2={x} y2={yTrough} stroke="var(--r-50)" strokeDasharray="2 3" strokeWidth={1} opacity={0.55} />
                <circle cx={x} cy={yTrough} r={3} fill="var(--r-50)" />
                <text x={x} y={yTrough + 14} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--r-50)">{fmtPct(c.drawdownPct)}</text>
              </>
            ) : null}
            <circle cx={x} cy={yPeak} r={3.5} fill="var(--tk-accent)" style={{ filter: "drop-shadow(0 0 3px var(--tk-accent))" }} />
            <text x={x} y={yPeak - 10} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9.5" fill="var(--ink-100)">{fmtPrice(c.peakUsd)}</text>
            <text x={x} y={yPeak - 22} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="8.5" fill="var(--ink-40)" letterSpacing="0.06em">{c.cyc.toUpperCase()}</text>
          </g>
        );
      })}

      {/* hover: crosshair + tooltip */}
      {hover && hoverI != null ? (
        <>
          <ChartCrosshair x={xs[hoverI]} y1={padT} y2={padT + innerH} />
          <ChartTip x={xs[hoverI]} bounds={{ left: padL, right: padL + innerW }} rows={tipRows} />
        </>
      ) : null}
    </svg>
  );
}

export function MarketsThesisTab(_props: MoneroTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader
        kicker="Price action · thesis · macro view · 2026"
        title='The <em style="color:var(--tk-accent);font-style:normal">refusing-to-die</em> chart.'
        sub="Eleven years of price action and a thesis for what's next. The market hasn't decided yet whether scarcity-of-privacy is a premium or a discount."
      />

      {/* ── THE THESIS · manifesto block ───────────────────── */}
      <Card style={{ padding: 32, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at top right, color-mix(in srgb, var(--accent-structural) 6%, transparent), transparent 60%)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div className="kicker">The thesis · what Monero represents</div>
          <h2 className="serif" style={{ margin: "12px 0 18px", fontSize: 30, fontWeight: 400, color: "var(--ink-100)", lineHeight: 1.2, letterSpacing: "-0.005em" }}>
            In a world where every transaction is tracked, every purchase logged,
            and every human reduced to a data point —
            Monero exists as the only <em style={{ color: "var(--tk-accent)", fontStyle: "normal" }}>mathematical guarantee</em> of financial privacy on Earth.
          </h2>
          <p className="serif" style={{ margin: "0 0 14px", fontSize: 17, lineHeight: 1.65, color: "var(--ink-80)", fontStyle: "italic" }}>
            This is not hyperbole. This is cryptographic fact.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginTop: 22 }}>
            <div>
              <p className="mono" style={{ fontSize: "var(--fs-body)", lineHeight: 1.85, color: "var(--ink-80)" }}>
                Those in power — governments, corporations, surveillance states — have visibility over everything. They see your bank accounts. They see your card purchases. They see your Bitcoin transactions on a permanent, public ledger. They know when you donate to causes they dislike. They know when you buy books they find subversive. They know when you send money to family in countries they've sanctioned.
              </p>
              <p className="serif" style={{ margin: "16px 0 0", fontSize: 22, lineHeight: 1.35, color: "var(--tk-accent)", fontWeight: 400 }}>
                With Monero, they see nothing.
              </p>
            </div>
            <div>
              <p className="mono" style={{ fontSize: "var(--fs-body)", lineHeight: 1.85, color: "var(--ink-80)" }}>
                <b style={{ color: "var(--p-50)" }}>Ring signatures</b> hide the sender. <b style={{ color: "var(--p-50)" }}>Stealth addresses</b> hide the receiver. <b style={{ color: "var(--p-50)" }}>RingCT</b> hides the amount. The entire transaction is a mathematical black box. Not private by policy. Not private by promise. <em style={{ color: "var(--ink-100)", fontStyle: "normal" }}>Private by mathematics.</em>
              </p>
              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                {THESIS_STATS.map((s) => (
                  <div key={s.v} style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 12, padding: "6px 0", borderTop: "1px dashed var(--ink-10)" }}>
                    <span className="mono acc" style={{ fontSize: 16, color: "var(--tk-accent)", textAlign: "right", textShadow: "var(--glow-1)" }}>{s.v}</span>
                    <span className="mono" style={{ fontSize: "var(--fs-body)", color: "var(--ink-80)", lineHeight: 1.55 }}>{s.w}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mono dim" style={{ marginTop: 20, fontSize: "var(--fs-label)", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-40)", textAlign: "right" }}>
            — The Monero Archive, 2026
          </p>
        </div>
      </Card>

      {/* ── THE 2026 CATALYST ───────────────────────────────── */}
      <Card style={{ padding: 26 }}>
        <div className="kicker">The catalyst · January 2026 ATH</div>
        <h3 className="serif" style={{ margin: "10px 0 6px", fontSize: 26, fontWeight: 400, color: "var(--ink-100)" }}>
          XMR hit <em style={{ color: "var(--tk-accent)", fontStyle: "normal", textShadow: "var(--glow-1)" }}>$799.89</em> in mid-January 2026 — a 195% move from early 2025.
        </h3>
        <p className="mono dim" style={{ fontSize: "var(--fs-body)", lineHeight: 1.7, margin: "10px 0 18px" }}>
          It wasn't one catalyst. It was the convergence of several forces — political, technical, and structural — that revalued financial privacy from "niche" to "necessary" over the span of twelve months.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
          {CATALYST_CARDS.map((p) => (
            <div key={p.h} style={{ padding: 12, borderTop: `2px solid ${p.c}` }}>
              <div className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.14em", textTransform: "uppercase", color: p.c }}>{p.h}</div>
              <p className="mono dim" style={{ margin: "8px 0 0", fontSize: "var(--fs-body)", lineHeight: 1.65 }}>{p.b}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── DEMAND DRIVERS ──────────────────────────────────── */}
      <div>
        <div className="kicker" style={{ marginBottom: 12 }}>Demand drivers · structural · 2026</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {DEMAND_DRIVERS.map((d) => (
            <Card key={d.n} style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span className="serif" style={{ fontSize: 32, color: d.c, fontWeight: 400, lineHeight: 1, letterSpacing: "-0.02em" }}>{d.n}</span>
                <div>
                  <div className="kicker" style={{ color: d.c }}>{d.t}</div>
                  <div className="serif" style={{ fontSize: 19, color: "var(--ink-100)", margin: "4px 0 0", fontWeight: 400 }}>{d.h}</div>
                </div>
              </div>
              <p className="mono dim" style={{ margin: "12px 0 0", fontSize: "var(--fs-body)", lineHeight: 1.75 }}>{d.b}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* ── THE CONVERGENCE ─────────────────────────────────── */}
      <Card style={{ padding: 32, background: "color-mix(in srgb, var(--accent-structural) 4%, transparent)", borderColor: "color-mix(in srgb, var(--accent-structural) 30%, transparent)" }}>
        <div className="kicker">The convergence</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 24, marginTop: 14, alignItems: "stretch" }}>
          <div>
            <div className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--r-50)", marginBottom: 10 }}>The tracked economy</div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {TRACKED_ECONOMY_ITEMS.map((l) => (
                <li key={l} className="mono" style={{ fontSize: "var(--fs-body)", color: "var(--ink-80)", paddingLeft: 14, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: "var(--r-50)" }}>×</span>{l}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ width: 1, background: "var(--rule)" }} />
          <div>
            <div className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--g-50)", marginBottom: 10 }}>And on the other side</div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {OTHER_SIDE_ITEMS.map((l) => (
                <li key={l} className="mono" style={{ fontSize: "var(--fs-body)", color: "var(--ink-80)", paddingLeft: 14, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: "var(--g-50)" }}>✓</span>{l}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--rule)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div className="serif" style={{ fontSize: 22, color: "var(--ink-100)", lineHeight: 1.3 }}>The demand is <em style={{ color: "var(--tk-accent)", fontStyle: "normal" }}>structural</em>.</div>
          <div className="serif" style={{ fontSize: 22, color: "var(--ink-100)", lineHeight: 1.3 }}>The supply is <em style={{ color: "var(--tk-accent)", fontStyle: "normal" }}>fixed</em>.</div>
          <div className="serif" style={{ fontSize: 22, color: "var(--ink-100)", lineHeight: 1.3 }}>The technology is <em style={{ color: "var(--tk-accent)", fontStyle: "normal" }}>unbroken</em>.</div>
        </div>
        <p className="mono dim" style={{ marginTop: 22, fontSize: "var(--fs-label)", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-40)", textAlign: "right" }}>
          — The Monero Archive, March 2026
        </p>
      </Card>

      {/* ── COUNTERARGUMENTS ────────────────────────────────── */}
      <Card style={{ padding: 22 }}>
        <div className="kicker">Counterarguments · eyes open</div>
        <p className="mono dim" style={{ fontSize: "var(--fs-body)", lineHeight: 1.75, margin: "10px 0 0" }}>
          The counterarguments are real — exchange delistings reduce liquidity, regulatory crackdowns could intensify, and quantum computing is a theoretical long-term risk. But every demand driver identified above is substantiated by what's actually happening on the ground right now.
        </p>
      </Card>

      {/* ── THE REFUSING-TO-DIE CHART · cycle highs marked ── */}
      <Card style={{ padding: 22 }}>
        <div className="kicker">Cycle highs · marked</div>
        <p className="mono dim" style={{ margin: "10px 0 0", fontSize: "var(--fs-mono)", lineHeight: 1.65 }}>
          Four cycles, four higher lows. Each point is a stated historical peak — hover for the
          cycle, date, price and drawdown.
        </p>
        <div style={{ marginTop: 14 }}>
          <CycleHighsChart />
        </div>
        {/* The grid stays below the chart as its legend rather than being
            replaced by it: the per-cycle `note` is editorial copy, and moving
            it behind a hover would make it invisible to anyone reading on
            touch or with a keyboard. */}
        <div className="mono kpi-grid" style={{ ["--kpi-cols" as any]: 4, gap: 10, marginTop: 14, fontSize: "var(--fs-mono)" }}>
          {CYCLE_HIGHS.map((c) => (
            <div key={c.cyc} style={{ padding: 12, border: "1px solid var(--rule)", borderRadius: 2 }}>
              <div className="kicker" style={{ color: "var(--tk-accent)" }}>{c.cyc}</div>
              <div className="serif" style={{ fontSize: 18, color: "var(--ink-100)", margin: "6px 0" }}>{c.peak}</div>
              <div className="dn" style={{ fontSize: "var(--fs-mono)" }}>{c.drawdown}</div>
              <p className="mono dim" style={{ margin: "8px 0 0", fontSize: "var(--fs-mono)", lineHeight: 1.55 }}>{c.note}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
