// AUTO-PORTED from protocols/stealth.jsx
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

// stealth.jsx — TWO-KEY CHAMBER
// Alice and Bob never communicate. Each computes the same secret using
// only Bob's public key + Alice's ephemeral private scalar. A new one-time
// address materializes that only Bob's view key can recognize.

export function ChamberPanel({ side, tick, phase }: any) {
  const isAlice = side === "alice";
  const color = isAlice ? "#ff7a1a" : "#5ed3f4";
  const glow = isAlice ? "var(--glow-1)" : "0 0 14px rgba(94,211,244,0.55)";
  return (
    <div style={{
      flex: 1, position: "relative",
      border: "1px solid " + color, padding: 22,
      background: `linear-gradient(180deg, rgba(${isAlice ? "255,122,26" : "94,211,244"},0.06), transparent)`,
      boxShadow: "0 0 30px rgba(" + (isAlice ? "255,122,26" : "94,211,244") + ",0.1) inset",
      minHeight: 360,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
        <div className="kicker" style={{ color, textShadow: glow }}>{isAlice ? "ALICE · sender" : "BOB · receiver"}</div>
        <div className="kicker">{isAlice ? "ephemeral" : "long-term"}</div>
      </div>

      {/* portrait silhouette */}
      <svg viewBox="0 0 200 90" width="100%" height="80" style={{ marginBottom: 10 }}>
        <ellipse cx="100" cy="40" rx="22" ry="26" fill="none" stroke={color} strokeWidth="1" opacity="0.4" />
        <path d="M 70 90 Q 70 60 100 60 Q 130 60 130 90 Z" fill="none" stroke={color} strokeWidth="1" opacity="0.4" />
        <text x="100" y="44" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="14" fill={color} letterSpacing="0.12em" style={{ textShadow: glow }}>
          {isAlice ? "A" : "B"}
        </text>
      </svg>

      {/* steps */}
      <div style={{ fontFamily: "var(--f-mono)", fontSize: 11, lineHeight: 1.7 }}>
        {isAlice ? (
          <>
            <div className={"kv " + (phase >= 0 ? "" : "muted")}>
              <span className="k">step 1</span>
              <span className={phase >= 0 ? "v acc" : "v dim2"}>
                r ← random scalar
              </span>
            </div>
            <div className={"kv " + (phase >= 1 ? "" : "muted")}>
              <span className="k">step 2</span>
              <span className={phase >= 1 ? "v acc" : "v dim2"}>
                R = r · G
              </span>
            </div>
            <div className={"kv " + (phase >= 2 ? "" : "muted")}>
              <span className="k">step 3</span>
              <span className={phase >= 2 ? "v acc" : "v dim2"}>
                share R on-chain
              </span>
            </div>
            <div className={"kv " + (phase >= 3 ? "" : "muted")}>
              <span className="k">step 4</span>
              <span className={phase >= 3 ? "v acc" : "v dim2"}>
                <span style={{ color }}>s = H(r · A) </span>
              </span>
            </div>
            <div className={"kv " + (phase >= 4 ? "" : "muted")}>
              <span className="k">step 5</span>
              <span className={phase >= 4 ? "v acc" : "v dim2"}>
                P = s·G + B
              </span>
            </div>
            <div className="kv" style={{ marginTop: 10 }}><span className="k">forgets</span><span className="v dn">r (after send)</span></div>
          </>
        ) : (
          <>
            <div className={"kv " + (phase >= 2 ? "" : "muted")}>
              <span className="k">observe</span>
              <span className={phase >= 2 ? "v" : "v dim2"} style={{ color: phase >= 2 ? color : undefined }}>
                R from chain
              </span>
            </div>
            <div className={"kv " + (phase >= 3 ? "" : "muted")}>
              <span className="k">computes</span>
              <span className={phase >= 3 ? "v" : "v dim2"} style={{ color: phase >= 3 ? color : undefined }}>
                <span>s = H(a · R)</span>
              </span>
            </div>
            <div className={"kv " + (phase >= 4 ? "" : "muted")}>
              <span className="k">checks</span>
              <span className={phase >= 4 ? "v" : "v dim2"} style={{ color: phase >= 4 ? color : undefined }}>
                s·G + B == P ?
              </span>
            </div>
            <div className={"kv " + (phase >= 4 ? "" : "muted")}>
              <span className="k">if yes</span>
              <span className={phase >= 4 ? "v g" : "v dim2"}>
                spend key: x = s + b
              </span>
            </div>
            <div className="kv" style={{ marginTop: 10 }}><span className="k">never reveals</span><span className="v p">a · b</span></div>
          </>
        )}
      </div>

      {/* glow markers when active */}
      {phase === 0 && isAlice ? <div style={{ position: "absolute", top: 18, right: 18, width: 6, height: 6, borderRadius: "50%", background: color, animation: "ledpulse 1s infinite", boxShadow: glow }} /> : null}
      {phase === 3 && !isAlice ? <div style={{ position: "absolute", top: 18, right: 18, width: 6, height: 6, borderRadius: "50%", background: color, animation: "ledpulse 1s infinite", boxShadow: glow }} /> : null}
    </div>
  );
}

export function ChamberMath({ phase, tick }: any) {
  // The central mirror — both sides compute the SAME secret without comms.
  // s = H(r·A) (Alice's view) === H(a·R) (Bob's view)
  const matched = phase >= 4;
  return (
    <div style={{
      position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
      padding: "0 28px",
    }}>
      <div style={{ width: 220, height: 320, position: "relative" }}>
        <svg viewBox="0 0 220 320" width="220" height="320">
          <defs>
            <linearGradient id="chamberFrame" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="rgba(255,200,120,0.5)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.3)" />
              <stop offset="100%" stopColor="rgba(94,211,244,0.5)" />
            </linearGradient>
            <radialGradient id="chamberCore">
              <stop offset="0%" stopColor="#ffce8a" stopOpacity="0.9" />
              <stop offset="50%" stopColor="rgba(255,180,80,0.4)" />
              <stop offset="100%" stopColor="rgba(94,211,244,0)" />
            </radialGradient>
          </defs>

          {/* outer chamber */}
          <rect x="20" y="40" width="180" height="240" fill="none" stroke="url(#chamberFrame)" strokeWidth="1" />
          {/* trim ticks */}
          {[40, 100, 160, 220, 280].map((y, i) => (
            <g key={i}>
              <line x1="14" y1={y} x2="20" y2={y} stroke="rgba(255,255,255,0.3)" />
              <line x1="200" y1={y} x2="206" y2={y} stroke="rgba(255,255,255,0.3)" />
            </g>
          ))}

          {/* secret materializes */}
          <circle cx="110" cy="120" r={matched ? 36 : 8} fill="url(#chamberCore)"
            style={{ filter: matched ? "drop-shadow(0 0 22px rgba(255,200,120,0.8))" : undefined, transition: "r 0.4s, filter 0.4s" }} />
          {matched ? (
            <circle cx="110" cy="120" r="36" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="0.5">
              <animate attributeName="r" values="36;50;36" dur="2.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0;0.7" dur="2.5s" repeatCount="indefinite" />
            </circle>
          ) : null}
          <text x="110" y="123" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="11" fontWeight="500"
            fill={matched ? "#1a0a02" : "var(--ink-40)"}>s</text>

          {/* equation */}
          <text x="110" y="180" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="11" fill="var(--ink-100)">
            H(r·A)
          </text>
          <text x="110" y="200" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="14" fill={matched ? "var(--g-50)" : "var(--ink-40)"}>
            ≡
          </text>
          <text x="110" y="220" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="11" fill="var(--ink-100)">
            H(a·R)
          </text>

          <text x="110" y="252" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-60)" letterSpacing="0.16em">
            DIFFIE-HELLMAN
          </text>
          <text x="110" y="266" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill={matched ? "var(--g-50)" : "var(--ink-40)"} letterSpacing="0.16em">
            {matched ? "✓ SAME SECRET" : "computing…"}
          </text>
        </svg>
      </div>

      {/* one-time address */}
      <div style={{ width: 220, padding: "10px 12px", border: "1px solid " + (matched ? "var(--g-50)" : "var(--ink-20)"), background: "rgba(0,0,0,0.5)" }}>
        <div className="kicker" style={{ marginBottom: 4 }}>ONE-TIME OUTPUT KEY</div>
        <div style={{ fontFamily: "var(--f-mono)", fontSize: 10.5, color: matched ? "var(--g-50)" : "var(--ink-40)", wordBreak: "break-all", letterSpacing: "-0.02em" }}>
          P = {matched ? "8b6a7c91f4d8…3e7" : "—"}
        </div>
        <div className="dim2" style={{ fontSize: 9, marginTop: 4 }}>
          {matched ? "visible to all · spendable by Bob" : "awaiting derivation"}
        </div>
      </div>
    </div>
  );
}

export function StealthView({ data, bg }: ViewProps) {
  const tick = useTick(80);
  const cycle = Math.floor(tick / 22) % 8;
  const phase = Math.min(4, cycle);

  return (
    <ProtoArtboard
      label="P5 · Stealth Address"
      kicker="MONERO PROTOCOL · 05 · DIFFIE-HELLMAN · ONE-TIME OUTPUTS"
      title='Stealth address — Alice and Bob never <em>talk</em>'
      sub="Alice and Bob compute the same secret without exchanging a single byte beyond Bob's public address. Every transaction lands at a one-time output key that only Bob can recognize and only Bob can spend."
      badges={[
        { label: "Diffie-Hellman", tone: "" },
        { label: "ed25519", tone: "" },
        { label: "View key + Spend key", tone: "priv" },
        { label: "Ready", tone: "ready" },
      ]}
      bg={bg}
      stage={
        <>
          <div style={{ position: "absolute", top: 0, right: 0, fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--ink-40)", letterSpacing: "0.18em" }}>
            FIG. 05 · TWO-KEY CHAMBER · DH ≡
          </div>

          <div style={{ display: "flex", gap: 18, alignItems: "stretch", marginTop: 8 }}>
            <ChamberPanel side="alice" tick={tick} phase={phase} />
            <ChamberMath phase={phase} tick={tick} />
            <ChamberPanel side="bob" tick={tick} phase={phase} />
          </div>

          <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <Stat k="ADDRESS COMPONENTS" v="A · B" sub="view + spend pubs" />
            <Stat k="EPHEMERAL" v="r" sub="alice tosses" tone="acc" />
            <Stat k="DERIVED" v="P, x" sub="output key + spend key" tone="p" />
            <Stat k="LINKABILITY" v="0" sub="across txs" tone="g" />
          </div>
        </>
      }
      panel={
        <>
          <div>
            <h6>The metaphor</h6>
            <div className="lede">
              A <span style={{ color: "var(--tk-accent)" }}>two-key chamber</span>. Two strangers stand in opposite rooms. Each holds half the math. Neither speaks. In the middle, the same secret materializes — and from it, a one-time door that only one of them can unlock.
            </div>
          </div>

          <div className="body">
            Every Monero address is two public keys: <b>A</b> (view) and <b>B</b> (spend). When Alice pays Bob, she generates a fresh scalar <em>r</em>, publishes <em>R = r·G</em> with the tx, and computes the same shared secret Bob can compute with his private view key <em>a</em>. From that secret she derives a brand-new one-time output key <em>P</em>.
          </div>

          <div>
            <h6>The two computations · same result</h6>
            <ProtoStep n={"A" as any} done title="Alice's side">
              s = H( <em>r · A</em> ) — she controls <em>r</em>, she has Bob's public A.
            </ProtoStep>
            <ProtoStep n={"B" as any} done title="Bob's side">
              s = H( <em>a · R</em> ) — he controls <em>a</em>, he sees R on chain.
            </ProtoStep>
            <ProtoStep n={"=" as any} done title="Both arrive at the same s">
              Because <em>r · A = r·(a·G) = a·(r·G) = a · R</em>. This is Diffie-Hellman.
            </ProtoStep>
            <ProtoStep n={"P" as any} on title="One-time output key">
              <em>P = s·G + B</em>. Visible to everyone. Spendable by Bob, who knows <em>x = s + b</em>.
            </ProtoStep>
          </div>

          <div>
            <h6>What this gives you</h6>
            <div className="proto-ctrl-row"><span className="k">Recipient privacy</span><span className="v g">no address reuse</span></div>
            <div className="proto-ctrl-row"><span className="k">Watch-only wallets</span><span className="v">view key sees, can't spend</span></div>
            <div className="proto-ctrl-row"><span className="k">Sub-addresses</span><span className="v">unlimited from one seed</span></div>
            <div className="proto-ctrl-row"><span className="k">Linkability</span><span className="v g">none — even Alice can't recognize her own past payments to Bob</span></div>
          </div>

          <div className="body" style={{ borderTop: "1px dashed var(--ink-10)", paddingTop: 12 }}>
            <em>Tied to view tags:</em> the same shared secret <em>s</em> derives the 1-byte view tag — so the prefilter works on every output, without giving an attacker any new information. See <span style={{ color: "var(--tk-accent)" }}>P3 · View Tags</span>.
          </div>
        </>
      }
    />
  );
}


