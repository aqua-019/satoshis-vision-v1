// AUTO-PORTED from protocols/ringct.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import { useTick, ArtBackground } from "@/design/ArtBackground";
import {
  Stat, Pill, PanelFrame, Sparkline, MiniBar, Crumbs, Card,
} from "@/design/primitives";
import { ProtoArtboard, ProtoStep, ProtoHeader } from "@/design/ProtoArtboard";
import { NavTop } from "@/layout/NavTop";
import { NetRail } from "@/layout/NetRail";
import { Footer } from "@/layout/Footer";
import { useMoneroLive } from "@/data/DataContext";
import { fmtN, fmtFee, fmtBytes, shortHash as ShortHash, randHex } from "@/data/types";
import type { MoneroLive } from "@/data/types";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

// ringct.jsx — CRYPTOGRAPHIC ASSEMBLY LINE
// A confidential transaction is built across 5 stations, left to right.
// Input commitment → ring of decoys → blinded output commitments →
// Bulletproofs+ range proof → CLSAG ring signature seal.

export function AssemblyStation({ n, title, kind, on, done, tick, w = 200, h = 220 }: any) {
  const renderInside = () => {
    if (kind === "input") {
      // an input commitment "vault" with a Pedersen lock
      return (
        <g>
          <rect x="20" y="30" width={w - 40} height={h - 70} fill="rgba(0,0,0,0.35)" stroke="rgba(255,122,26,0.6)" />
          <rect x="36" y="50" width={w - 72} height="22" fill="rgba(255,122,26,0.2)" />
          <text x={w / 2} y="66" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-100)">C = aG + xH</text>
          <text x={w / 2} y="92" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-60)">value · blinded</text>
          {/* lock */}
          <circle cx={w / 2} cy={130} r="14" fill="rgba(255,122,26,0.18)" stroke="var(--tk-accent)" />
          <rect x={w / 2 - 4} y={126} width="8" height="10" fill="var(--tk-accent)" />
        </g>
      );
    }
    if (kind === "ring") {
      // 16 candles in a circle
      return (
        <g>
          {Array.from({ length: 16 }).map((_, i) => {
            const ang = (i / 16) * Math.PI * 2 - Math.PI / 2;
            const cx = w / 2 + Math.cos(ang) * 56;
            const cy = h / 2 - 10 + Math.sin(ang) * 56;
            const isReal = i === 9;
            const flicker = 0.6 + 0.4 * Math.sin((tick + i * 7) * 0.2);
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={isReal ? 5 : 3.2}
                  fill={isReal ? "#ffce8a" : "rgba(255,180,80,0.85)"}
                  opacity={flicker}
                  style={{ filter: isReal ? "drop-shadow(0 0 4px var(--tk-accent))" : "drop-shadow(0 0 3px rgba(255,122,26,0.6))" }} />
                <text x={cx} y={cy + 14} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="6" fill="var(--ink-40)">{i}</text>
              </g>
            );
          })}
          <text x={w / 2} y={h / 2 - 4} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--tk-accent)" letterSpacing="0.18em">RING 16</text>
        </g>
      );
    }
    if (kind === "outputs") {
      // 2 blinded output commitments
      return (
        <g>
          {[0, 1].map((i) => {
            const x = 32 + i * (w - 80);
            return (
              <g key={i}>
                <rect x={x} y={42} width={w - 100} height={h - 90}
                  fill={`linear-gradient(to bottom, rgba(94,211,244,0.18), rgba(94,211,244,0.05))`}
                  stroke="rgba(94,211,244,0.6)" />
                <text x={x + (w - 100) / 2} y={64} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="#5ed3f4">out_{i}</text>
                <text x={x + (w - 100) / 2} y={86} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-60)">C = a'G + x'H</text>
                <text x={x + (w - 100) / 2} y={104} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-60)">x' = stealth</text>
                {/* "sealing" pulse */}
                {on ? (
                  <rect x={x} y={42} width={w - 100} height={h - 90} fill="none" stroke="#5ed3f4" strokeWidth="1.5">
                    <animate attributeName="opacity" values="0.2;1;0.2" dur="1.4s" repeatCount="indefinite" />
                  </rect>
                ) : null}
              </g>
            );
          })}
          {/* balance equation */}
          <text x={w / 2} y={h - 26} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--g-50)">Σ in − Σ out = 0</text>
        </g>
      );
    }
    if (kind === "rangeproof") {
      // bulletproofs as a "compression mill"
      const t = (tick % 40) / 40;
      return (
        <g>
          {/* rolling bars - data being compressed */}
          {Array.from({ length: 8 }).map((_, i) => {
            const x = 24 + i * 18;
            const hh = 80 - (Math.sin((tick + i * 4) * 0.3) + 1) * 18;
            return <rect key={i} x={x} y={40} width="10" height={hh} fill="rgba(184,122,255,0.55)" style={{ filter: "drop-shadow(0 0 4px #b87aff)" }} />;
          })}
          {/* mill */}
          <rect x="14" y={130} width={w - 28} height="10" fill="rgba(184,122,255,0.18)" stroke="rgba(184,122,255,0.5)" />
          <rect x={14 + t * (w - 38)} y={128} width="20" height="14" fill="#b87aff" style={{ filter: "drop-shadow(0 0 6px #b87aff)" }} />
          <text x={w / 2} y={170} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="#b87aff" letterSpacing="0.16em" style={{ textShadow: "var(--glow-p)" }}>
            BULLETPROOFS+
          </text>
          <text x={w / 2} y={186} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-60)">
            range proof · O(log n)
          </text>
        </g>
      );
    }
    if (kind === "sign") {
      // CLSAG seal — wax-stamp aesthetic
      const pulse = on ? (Math.sin(tick * 0.2) + 1) * 0.5 : 0.6;
      return (
        <g>
          <circle cx={w / 2} cy={h / 2 - 16} r="46" fill="none"
            stroke="var(--tk-accent)" strokeWidth="0.6" strokeDasharray="2 4"
            style={{ transformOrigin: `${w / 2}px ${h / 2 - 16}px`, animation: "spin 14s linear infinite" }} />
          <circle cx={w / 2} cy={h / 2 - 16} r="34" fill="rgba(255,122,26,0.25)" stroke="var(--tk-accent)" strokeWidth="2"
            style={{ filter: "drop-shadow(0 0 6px var(--tk-accent))" }} />
          <text x={w / 2} y={h / 2 - 18} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="11" fill="var(--ink-80)" letterSpacing="0.1em" style={{ textShadow: "var(--glow-1)" }}>CLSAG</text>
          <text x={w / 2} y={h / 2 - 4} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-60)">σ · 16-ring</text>
          {/* seal rays */}
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <line key={i} x1={w / 2 + Math.cos(a) * 40} y1={h / 2 - 16 + Math.sin(a) * 40}
              x2={w / 2 + Math.cos(a) * 60} y2={h / 2 - 16 + Math.sin(a) * 60}
              stroke="var(--tk-accent)" strokeWidth="0.6" opacity={pulse} />;
          })}
          <text x={w / 2} y={h - 22} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--g-50)" letterSpacing="0.14em">SEALED ✓</text>
        </g>
      );
    }
  };

  return (
    <div style={{
      position: "relative",
      background: "rgba(10,9,7,0.7)",
      border: "1px solid " + (on ? "var(--tk-accent)" : "var(--rule)"),
      boxShadow: on ? "0 0 20px rgba(255,122,26,0.18)" : "none",
      width: w, minHeight: h,
      transition: "box-shadow 0.3s, border-color 0.3s",
    }}>
      <span className="tick tl" />
      <span className="tick tr" />
      <span className="tick bl" />
      <span className="tick br" />
      <div style={{ position: "absolute", top: -1, left: -1, padding: "3px 8px",
        background: done ? "var(--g-50)" : on ? "var(--tk-accent)" : "var(--bg-2)",
        color: done ? "var(--bg-0)" : on ? "var(--bg-0)" : "var(--ink-60)",
        fontFamily: "var(--f-mono)", fontSize: 9, letterSpacing: "0.16em",
        textTransform: "uppercase", zIndex: 2,
      }}>{n} · {title}</div>
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ display: "block" }}>
        {renderInside()}
      </svg>
    </div>
  );
}

export function RingctView({ data, bg }: ViewProps) {
  const tick = useTick(80);
  // animate the "active station" walking left to right
  const STATIONS = 5;
  const phase = Math.floor(tick / 25) % (STATIONS + 4);
  const isStation = (i: number) => phase === i;
  const isDone = (i: number) => phase > i;

  const stations = [
    { kind: "input",      n: "01", title: "Input" },
    { kind: "ring",       n: "02", title: "Ring" },
    { kind: "outputs",    n: "03", title: "Outputs" },
    { kind: "rangeproof", n: "04", title: "Bulletproofs+" },
    { kind: "sign",       n: "05", title: "CLSAG" },
  ];

  return (
    <ProtoArtboard
      label="P4 · RingCT"
      kicker="MONERO PROTOCOL · 04 · CLSAG + BULLETPROOFS+"
      title='RingCT — building a <em>confidential</em> transaction'
      sub="A Monero transaction is assembled across five cryptographic stations: input commitment, decoy ring, blinded outputs, range proof, and finally a ring signature seal. Each station hides a different property of the transaction."
      badges={[
        { label: "RingCT", tone: "" },
        { label: "CLSAG", tone: "acc" },
        { label: "Bulletproofs+", tone: "priv" },
        { label: "Ready", tone: "ready" },
      ]}
      bg={bg}
      stage={
        <>
          <div style={{ position: "absolute", top: 0, right: 0, fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--ink-40)", letterSpacing: "0.18em" }}>
            FIG. 04 · ASSEMBLY LINE · L → R · LIVE
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "center", marginTop: 20 }}>
            {stations.map((s, i) => (
              <React.Fragment key={i}>
                <AssemblyStation {...s} on={isStation(i)} done={isDone(i)} tick={tick} />
                {i < stations.length - 1 ? (
                  <div style={{
                    width: 30, marginTop: 100, display: "flex", alignItems: "center", justifyContent: "center",
                    color: isDone(i) ? "var(--g-50)" : "var(--ink-20)",
                    fontFamily: "var(--f-mono)", fontSize: 18,
                  }}>→</div>
                ) : null}
              </React.Fragment>
            ))}
          </div>

          {/* transaction record visualization */}
          <div style={{ marginTop: 36 }}>
            <div className="kicker" style={{ marginBottom: 8 }}>FINAL TX RECORD — what hits the wire</div>
            <pre style={{
              margin: 0, padding: 14,
              border: "1px solid var(--rule)",
              background: "rgba(0,0,0,0.45)",
              fontFamily: "var(--f-mono)", fontSize: 11, lineHeight: 1.5,
              color: "var(--ink-80)",
            }}>
{`tx {
  version    = 2
  unlock_time = 0
  vin   = [ { key_image: <I>, ring: [k0..k15] } ]
  vout  = [ { commitment: C₀, view_tag: 0x7a }, { commitment: C₁, view_tag: 0x21 } ]
  range_proof = `}<span style={{ color: "#b87aff", textShadow: "var(--glow-p)" }}>BP+(C₀, C₁)</span>{`         // ~700 bytes (was ~13 KB pre-BP)
  rct_signature = `}<span style={{ color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>CLSAG(ring, σ)</span>{`     // 1.5 KB (was 2.2 KB pre-CLSAG)
  extra = [ tx_pub_key, payment_id?, view_tags ]
}`}
            </pre>
          </div>

          {/* size readout */}
          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <Stat k="TX SIZE" v="1.8 KB" sub="typical 2-out" tone="acc" />
            <Stat k="VS 2017" v="−86%" sub="BP, BP+, CLSAG wins" tone="p" />
            <Stat k="VERIFY TIME" v="~7 ms" sub="batch verify" />
            <Stat k="ANON PER TX" v="16" sub="ring members" />
          </div>
        </>
      }
      panel={
        <>
          <div>
            <h6>The metaphor</h6>
            <div className="lede">
              A confidential transaction is built on a <span style={{ color: "var(--tk-accent)" }}>five-station assembly line</span>. Each station seals one property. By the time the package leaves the line, value is hidden, sender is hidden, amount-range is proven without revealing, and the whole thing is signed by one of sixteen possible authors.
            </div>
          </div>

          <div className="body">
            Crucially, none of the stations alone protects the transaction. <b>Privacy is the product of all five</b> running together. Drop any one and the others collapse — which is why FCMP++ replaces the entire ring-selection station rather than patching it.
          </div>

          <div>
            <h6>Stations · what each hides</h6>
            <ProtoStep n={1} done={phase > 0} on={phase === 0} title="Input commitment">Pedersen commitment <em>C = aG + xH</em> hides the value <em>x</em> behind a random blinding scalar <em>a</em>.</ProtoStep>
            <ProtoStep n={2} done={phase > 1} on={phase === 1} title="Ring 16">15 statistically indistinguishable decoys join the real spender. See <b>P1 · Decoy Selection</b>.</ProtoStep>
            <ProtoStep n={3} done={phase > 2} on={phase === 2} title="Outputs blinded">New commitments for each recipient. Sum check: Σ in − Σ out = 0 (proven in the rangeproof, not revealed).</ProtoStep>
            <ProtoStep n={4} done={phase > 3} on={phase === 3} title="Bulletproofs+">A logarithmic-size proof that <em>every output is in [0, 2⁶⁴]</em>. Prevents inflation. ~700 bytes.</ProtoStep>
            <ProtoStep n={5} done={phase > 4} on={phase === 4} title="CLSAG signature">A single linkable spontaneous anonymous group signature. 1 of 16 keys signed; verifier can't say which.</ProtoStep>
          </div>

          <div>
            <h6>Why so much math</h6>
            <div className="body">
              The hard problem: prove the transaction is <em>valid</em> (no inflation, signed by an owner) without revealing <em>sender</em>, <em>recipient</em>, or <em>amount</em>. RingCT is the answer assembled out of zero-knowledge primitives — each one specifically picked to surrender no information.
            </div>
          </div>
        </>
      }
    />
  );
}


