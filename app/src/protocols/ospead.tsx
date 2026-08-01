// protocols/ospead.tsx — CAMOUFLAGE TAILOR
// The sequel to decoy-selection.tsx. That sim shows the mechanism; this one
// shows what's wrong with it: the decoy distribution the wallet samples from
// does not match the distribution of how outputs are really spent, and every
// unit of mismatch is leverage for someone guessing which ring member is real.
//
// ACCURACY NOTE — the figures here are Rucknium's published OSPEAD estimates
// (attack success 23.5% / effective ring 4.2 today; 7.6% / 13.2 after the
// refit), NOT invented values and NOT measurements taken by this site. They
// are explicitly preliminary and not peer-reviewed, and OSPEAD is not shipped.
// The two curves are illustrative shapes standing in for the estimated
// densities, not the estimator's actual output.
//
// Pure MODEL surface — the `data` prop is intentionally never read.

import * as React from "react";
import { Link } from "react-router-dom";
import { ProtoArtboard, ProtoStep } from "@/design/ProtoArtboard";
import { ProtoCanvas } from "@/protocols/use-proto-canvas";
import type { ProtoDrawFn } from "@/protocols/use-proto-canvas";
import { Stat } from "@/design/primitives";
import { Provenance } from "@/design/provenance";
import type { MoneroLive } from "@/data/types";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

const MONO = '"JetBrains Mono", ui-monospace, monospace';
const AGE_MIN = 0.02; // days — ~30 minutes, the earliest spendable age
const AGE_MAX = 365;

/** Published OSPEAD estimates. Preliminary, not peer-reviewed, not deployed. */
const TODAY = { attack: 23.5, ring: 4.2 };
const REFIT = { attack: 7.6, ring: 13.2 };
const BASELINE = { attack: 6.25, ring: 16 };

const lx = (age: number) => Math.log(age / AGE_MIN) / Math.log(AGE_MAX / AGE_MIN);
const bump = (u: number, mu: number, sd: number) => Math.exp(-Math.pow(u - mu, 2) / (2 * sd * sd));

/**
 * Resolve --accent-data to a concrete colour for canvas — canvas cannot
 * consume var(), and ctx.fillStyle = "var(--accent-data)" fails silently
 * (previous colour just persists, no error). Call once per draw pass, never
 * per curve()/fillStyle call. Falls back to --tk-accent (always declared,
 * orange in both current themes) rather than a hardcoded hex, so this file
 * carries no literal duplicate of the token's value. Sibling of the
 * same-named helper in cuprate.tsx and of cssColor() in
 * mempool/useMemCanvas.ts.
 */
function resolveAccentData(): string {
  if (typeof document === "undefined") return "#ffffff";
  const root = getComputedStyle(document.documentElement);
  const v = root.getPropertyValue("--accent-data").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  const fallback = root.getPropertyValue("--tk-accent").trim();
  return /^#[0-9a-fA-F]{6}$/.test(fallback) ? fallback : "#ffffff";
}

/** Wallet2's gamma decoy sampler, as a density over log-age. */
const decoyPdf = (u: number) => bump(u, 0.58, 0.20) * 0.92 + bump(u, 0.80, 0.30) * 0.30;
/** Estimated real-spend density — mass sits markedly younger than the decoys. */
const realPdf = (u: number) => bump(u, 0.36, 0.13) * 1.00 + bump(u, 0.62, 0.26) * 0.34;
/** A refit decoy distribution: shaped to track real spending. */
const refitPdf = (u: number) => realPdf(u) * 0.97 + bump(u, 0.50, 0.34) * 0.06;

export function OspeadView({ bg }: ViewProps) {
  const [refit, setRefit] = React.useState(false);
  const refitRef = React.useRef(refit);
  refitRef.current = refit;
  const cur = refit ? REFIT : TODAY;

  const draw: ProtoDrawFn = (ctx, w, h, t) => {
    const on = refitRef.current;
    const accentData = resolveAccentData(); // resolved once per draw pass — canvas can't read var()
    ctx.clearRect(0, 0, w, h);
    const padL = 44, padR = 14, padT = 26, padB = 40;
    const iw = w - padL - padR, ih = h - padT - padB;
    const decoy = on ? refitPdf : decoyPdf;
    const X = (u: number) => padL + u * iw;
    const Y = (v: number) => padT + ih - v * ih * 0.86;
    const N = 120;

    // axis + age gridlines (labelled in text, so the plot doesn't rely on hue)
    ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT + ih); ctx.lineTo(padL + iw, padT + ih); ctx.stroke();
    ctx.font = `11px ${MONO}`; ctx.fillStyle = "rgba(168,160,148,0.7)"; ctx.textAlign = "center";
    for (const [age, lab] of [[0.08, "2h"], [1, "1d"], [7, "1w"], [30, "1mo"], [365, "1y"]] as Array<[number, string]>) {
      const x = X(lx(age));
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + ih); ctx.stroke();
      ctx.fillText(lab, x, padT + ih + 15);
    }
    ctx.textAlign = "left";
    ctx.fillText("OUTPUT AGE  ⟶ (log scale)", padL, h - 8);

    // the mismatch — shaded between the two curves. This is the finding.
    ctx.beginPath();
    for (let i = 0; i <= N; i++) ctx.lineTo(X(i / N), Y(realPdf(i / N)));
    for (let i = N; i >= 0; i--) ctx.lineTo(X(i / N), Y(decoy(i / N)));
    ctx.closePath();
    ctx.fillStyle = on ? "rgba(74,222,128,0.16)" : "rgba(255,77,109,0.20)";
    ctx.fill();

    // curves — distinguished by dash pattern as well as colour
    const curve = (f: (u: number) => number, col: string, dash: number[], width: number) => {
      ctx.beginPath();
      for (let i = 0; i <= N; i++) ctx.lineTo(X(i / N), Y(f(i / N)));
      ctx.strokeStyle = col; ctx.lineWidth = width; ctx.setLineDash(dash);
      ctx.stroke(); ctx.setLineDash([]);
    };
    curve(realPdf, "#ffd400", [5, 4], 1.8);
    curve(decoy, on ? "#4ade80" : accentData, [], 2);

    // sweeping read-head — starts mid-plot so the frozen reduced-motion frame
    // is still informative rather than parked in a corner.
    const u = 0.5 + 0.42 * Math.sin(t * 0.32);
    const gap = realPdf(u) - decoy(u);
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(X(u), padT); ctx.lineTo(X(u), padT + ih); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = Math.abs(gap) < 0.06 ? "#4ade80" : "#ff4d6d";
    ctx.beginPath(); ctx.arc(X(u), Y(realPdf(u)), 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = `11px ${MONO}`; ctx.textAlign = X(u) > w * 0.6 ? "right" : "left";
    ctx.fillText(
      `${Math.abs(gap) < 0.06 ? "matched" : gap > 0 ? "too few decoys here" : "too many decoys here"} · Δ ${(gap * 100).toFixed(0)}`,
      X(u) + (X(u) > w * 0.6 ? -8 : 8), padT + 12,
    );

    // legend
    ctx.textAlign = "left"; ctx.font = `11px ${MONO}`;
    ctx.fillStyle = "#ffd400"; ctx.fillText("╌╌ estimated REAL spends", padL, padT - 10);
    ctx.fillStyle = on ? "#4ade80" : accentData;
    ctx.fillText(on ? "── OSPEAD refit decoys" : "── current gamma decoys", padL + 190, padT - 10);

    // effective-ring bar — what the mismatch actually costs, in ring members.
    const eff = on ? REFIT.ring : TODAY.ring;
    const barY = padT + ih + 24, barH = 9;
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fillRect(padL, barY, iw, barH);
    ctx.fillStyle = on ? "rgba(74,222,128,0.85)" : "rgba(255,77,109,0.85)";
    ctx.fillRect(padL, barY, (eff / BASELINE.ring) * iw, barH);
    ctx.fillStyle = "rgba(168,160,148,0.85)"; ctx.font = `11px ${MONO}`; ctx.textAlign = "left";
    ctx.fillText(`EFFECTIVE RING ${eff} of ${BASELINE.ring} nominal`, padL, barY - 5);
  };

  const label =
    (refit
      ? "Distribution plot, OSPEAD refit selected: the refitted decoy curve tracks the estimated real-spend curve closely and the shaded mismatch between them nearly disappears. "
      : "Distribution plot, current sampler selected: the wallet's gamma decoy curve peaks at older output ages than the estimated real-spend curve, leaving a large shaded mismatch — real spends of young outputs are under-covered by decoys. ") +
    `Estimated attack success ${cur.attack} percent, effective ring size ${cur.ring} out of a nominal 16. ` +
    "Illustrative curves; the figures are Rucknium's preliminary OSPEAD estimates, not measurements.";

  return (
    <ProtoArtboard
      label="OSPEAD · Camouflage Tailor"
      kicker="MONERO RESEARCH · ECONOMICS OF DECOYS · CAMOUFLAGE TAILOR"
      title='OSPEAD — the camouflage doesn&apos;t match the <em>forest</em>'
      sub="Ring signatures only hide you if your decoys look like real spends. Monero Research Lab's OSPEAD work estimates the true spend distribution and compares it against the distribution wallets actually sample from. The gap between the two curves is the finding."
      badges={[
        { label: "ACTIVE RESEARCH · not shipped", tone: "" },
        { label: "Not peer-reviewed", tone: "" },
        { label: "Rucknium · MRL", tone: "priv" },
      ]}
      right={<Provenance source="model" />}
      bg={bg}
      stage={
        <>
          <div style={{ position: "absolute", top: 0, right: 0, fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--ink-40)", letterSpacing: "0.18em" }}>
            FIG. O1 · DECOY vs REAL-SPEND DENSITY · ILLUSTRATIVE
          </div>

          <ProtoCanvas draw={draw} height={340} label={label} />

          <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <button type="button" className="proto-btn" onClick={() => setRefit(false)} disabled={!refit}>
              Current gamma sampler
            </button>
            <button type="button" className="proto-btn" onClick={() => setRefit(true)} disabled={refit}>
              Apply OSPEAD refit
            </button>
            <span style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", color: refit ? "var(--g-50)" : "#ff4d6d" }}>
              {refit ? "✓ mismatch largely closed" : "✗ mismatch — decoys skew older than real spends"}
            </span>
          </div>

          <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <Stat k="NOMINAL RING" v={String(BASELINE.ring)} sub={`ideal ${BASELINE.attack}% guess`} />
            <Stat k="ATTACK SUCCESS" v={cur.attack + "%"} sub={refit ? "with refit" : "estimated, today"} tone={refit ? "g" : "dn"} />
            <Stat k="EFFECTIVE RING" v={String(cur.ring)} sub={`of ${BASELINE.ring} nominal`} tone={refit ? "g" : "dn"} />
            <Stat k="STATUS" v="RESEARCH" sub="not deployed" tone="acc" />
          </div>
        </>
      }
      panel={
        <>
          <div>
            <h6>The metaphor</h6>
            <div className="lede">
              A <span style={{ color: "var(--tk-accent)" }}>camouflage tailor</span>. The pattern was cut decades ago from a photograph of the forest. The forest has since changed. You are still wearing the old pattern — and that is exactly how you get spotted.
            </div>
          </div>

          <div className="body">
            Every ring hides one real spend among fifteen decoys sampled from a fixed <b>gamma</b> distribution over output age. The hiding only works if that distribution matches how outputs are <em>really</em> spent. <b>OSPEAD</b> — Optimal Static Parametric Estimation of Arbitrary Distributions, by <b>Rucknium</b> at the Monero Research Lab, CCS-funded — estimates the real distribution and measures the divergence.
          </div>

          <div>
            <h6>The argument, in four moves</h6>
            <ProtoStep n={1} done title="You cannot observe real spends directly">Every ring member looks alike on-chain. The real-spend distribution has to be recovered statistically, not read off.</ProtoStep>
            <ProtoStep n={2} done title="Separate the mixture">A Bonhomme–Jochmans–Robin estimator separates rings built by the standard algorithm from those built by third-party wallets; a Patra–Sen inversion then separates the decoy density from the real-spend density.</ProtoStep>
            <ProtoStep n={3} on={!refit} title="The mismatch is the finding">The estimated real-spend curve sits markedly <em>younger</em> than the gamma. Where decoys are scarce relative to real spends, the real one stands out — estimated attack success <b>{TODAY.attack}%</b>, an effective ring of <b>{TODAY.ring}</b> rather than {BASELINE.ring}.</ProtoStep>
            <ProtoStep n={4} on={refit} title="Refit the pattern">Sample decoys from a distribution shaped like real spending and the gap closes: estimated attack success <b>{REFIT.attack}%</b>, effective ring <b>{REFIT.ring}</b> — close to the {BASELINE.attack}% ideal.</ProtoStep>
            <ProtoStep n={5} title="Why this is not a shipped fix">The estimates are preliminary and not peer-reviewed; they rest on assumptions about ring-member independence and on how many users run patched wallets. A change to decoy selection is only safe if wallets adopt it near-uniformly — a split population is itself a fingerprint.</ProtoStep>
          </div>

          <div>
            <h6>Figures · Rucknium / MRL, preliminary</h6>
            <div className="proto-ctrl-row"><span className="k">Today · attack success</span><span className="v">{TODAY.attack}% (ring ≈ {TODAY.ring})</span></div>
            <div className="proto-ctrl-row"><span className="k">With refit</span><span className="v g">{REFIT.attack}% (ring ≈ {REFIT.ring})</span></div>
            <div className="proto-ctrl-row"><span className="k">Ideal</span><span className="v">{BASELINE.attack}% (ring {BASELINE.ring})</span></div>
            <div className="proto-ctrl-row"><span className="k">Worst affected</span><span className="v">spends of young outputs</span></div>
            <div className="proto-ctrl-row"><span className="k">Peer review</span><span className="v dn">not yet</span></div>
            <div className="proto-ctrl-row"><span className="k">Deployment</span><span className="v dn">not before the next fork</span></div>
          </div>

          <div>
            <h6>Why young outputs suffer most</h6>
            <div className="body">
              Most real spends happen soon after an output is received — you get paid, you pay someone. The gamma sampler places comparatively little decoy mass in that first stretch, so a genuinely young true spend sits in a ring whose other members are mostly older. The attacker does not need to break any cryptography: they just ask which ring member the sampler was <em>unlikely</em> to have chosen. Spending an older output is, today, the better-camouflaged act — which is precisely backwards from how people actually use money.
            </div>
          </div>

          <div className="body" style={{ borderTop: "1px dashed var(--ink-10)", paddingTop: 12 }}>
            <em>Where this sits:</em> the mechanism itself is in{" "}
            <Link to="/simulate?p=decoy" style={{ color: "var(--tk-accent)" }}>Decoy selection · Time tide →</Link>{" "}
            — read that first; this is its sequel. And note the horizon: <b>FCMP++</b> retires decoy sampling altogether by proving membership in the whole chain, at which point there is no distribution left to fit or to attack.
          </div>
        </>
      }
    />
  );
}
