// AUTO-PORTED from protocols/view-tags.jsx
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
import { fmtN, fmtFee, fmtBytes, shortHash as ShortHash } from "@/data/types";
import { randHex } from "@/protocols/sim-random";
import type { MoneroLive } from "@/data/types";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

// view-tags.jsx — LIGHTHOUSE IN FOG
// Side-by-side scanner race. Wallet must scan every output on chain to find
// its own. Left pane: pre-2022, full ECDH math per output. Right pane: with
// view tags — 1 byte prefilter rejects 255/256 instantly. ~256× speedup.

export function ScannerWall({ side, tick, viewTag, onCounter }: any) {
  // 16 cols × 16 rows = 256 cells per visible slab
  const COLS = 16, ROWS = 16, TOTAL = COLS * ROWS;
  const cells = React.useMemo(() => {
    return Array.from({ length: TOTAL }).map((_, i) => ({
      i,
      tag: Math.floor(Math.random() * 256),
      mine: Math.random() < 0.0035,
    }));
  }, [side, viewTag]);

  // Animation cursor moves through all cells; speed differs per side.
  const speed = viewTag ? 18 : 0.4;
  const cursor = Math.floor(tick * speed) % (TOTAL + 60);
  const counter = Math.min(TOTAL, Math.floor(tick * speed));

  React.useEffect(() => {
    if (onCounter) onCounter(counter);
  }, [counter, onCounter]);

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gap: 3,
      }}>
        {cells.map((c, i) => {
          const scanned = i <= cursor;
          // With view tags: pre-rejected cells dim instantly (255/256), only ~1/256 require full scan
          const preReject = viewTag && c.tag !== 200 && !c.mine;     // most cells are pre-rejected
          const candidate = viewTag && (c.tag === 200 || c.mine);    // ~4/256 cells need full scan
          const matched = scanned && c.mine;
          let bg;
          if (viewTag) {
            if (matched) bg = "linear-gradient(135deg, #b87aff 0%, #ff7a1a 100%)";
            else if (preReject) bg = "rgba(255,255,255,0.025)";
            else if (candidate) bg = "rgba(255,180,80,0.4)";
            else bg = "rgba(255,255,255,0.04)";
          } else {
            if (matched) bg = "linear-gradient(135deg, #b87aff 0%, #ff7a1a 100%)";
            else if (scanned) bg = "rgba(255,122,26,0.18)";
            else bg = "rgba(255,255,255,0.04)";
          }
          const isCursor = i === cursor;
          const showFullScanGlow = !viewTag && isCursor;
          return (
            <div key={i} style={{
              aspectRatio: "1",
              background: bg,
              border: matched ? "1px solid #b87aff" : (viewTag && candidate ? "1px solid rgba(255,180,80,0.6)" : "1px solid var(--ink-10)"),
              position: "relative",
              boxShadow: matched ? "0 0 8px #b87aff" : showFullScanGlow ? "0 0 4px var(--tk-accent)" : "none",
              transition: "background 0.15s",
            }} title={`output #${i} · tag=0x${c.tag.toString(16).padStart(2, "0")}`}>
              {matched ? (
                <div style={{
                  position: "absolute", inset: -3,
                  border: "1.5px solid #b87aff",
                  pointerEvents: "none",
                  animation: "pulseScale 1.5s ease-in-out infinite",
                }} />
              ) : null}
              {viewTag && candidate && !matched ? (
                <div style={{
                  position: "absolute", inset: 1, display: "grid", placeItems: "center",
                  fontFamily: "var(--f-mono)", fontSize: 7, color: "var(--ink-60)",
                }}>?</div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* full-row sweep cursor (no view tag) */}
      {!viewTag ? (
        <div style={{
          position: "absolute", left: 0, top: Math.floor(cursor / COLS) * (100 / ROWS) + "%",
          width: "100%", height: 100 / ROWS + "%",
          background: "linear-gradient(90deg, transparent, rgba(255,122,26,0.18), transparent)",
          pointerEvents: "none",
        }} />
      ) : null}

      {/* count display */}
      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--ink-60)" }}>
        <span>Scanned <span className="acc">{counter}/{TOTAL}</span> outputs</span>
        <span className={viewTag ? "acc" : ""}>{viewTag ? "Full ECDH on ~4 candidates" : "Full ECDH on all 256"}</span>
      </div>
    </div>
  );
}

export function ViewTagsView({ data, bg }: ViewProps) {
  const tick = useTick(50);
  const [leftCount, setLeftCount] = React.useState(0);
  const [rightCount, setRightCount] = React.useState(0);
  // Cycle the demo every ~6s
  const cycle = Math.floor(tick / 150);
  const tagSeed = cycle;

  return (
    <ProtoArtboard
      label="P3 · View Tags"
      kicker="MONERO PROTOCOL · 03 · WALLET SYNC · 2022 UPGRADE"
      title='View tags — a <em>256×</em> wallet speedup for free'
      sub="To find which on-chain outputs are yours, your wallet must compute ECDH against every output ever created. View tags are a 1-byte hint: 255/256 outputs are rejected by a fast equality check before any expensive math. Zero cost to privacy."
      badges={[
        { label: "1-byte hint", tone: "acc" },
        { label: "Hard-fork v15", tone: "" },
        { label: "Ready", tone: "ready" },
      ]}
      bg={bg}
      stage={
        <>
          <div style={{ position: "absolute", top: 0, right: 0, fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--ink-40)", letterSpacing: "0.18em" }}>
            FIG. 03 · LIGHTHOUSE-IN-FOG · SCAN RACE
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* LEFT — pre-2022, no view tags */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div className="kicker" style={{ color: "var(--ink-60)" }}>WITHOUT VIEW TAGS · pre-2022</div>
                <div style={{ fontFamily: "var(--f-mono)", fontSize: 12, color: "var(--ink-100)" }}>~256 ms/block</div>
              </div>
              <ScannerWall side="left" tick={tick + tagSeed * 100} viewTag={false} onCounter={setLeftCount} />
            </div>

            {/* RIGHT — view tags */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div className="kicker" style={{ color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>WITH VIEW TAGS · v15+</div>
                <div style={{ fontFamily: "var(--f-mono)", fontSize: 12, color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>~1 ms/block</div>
              </div>
              <ScannerWall side="right" tick={tick + tagSeed * 100} viewTag={true} onCounter={setRightCount} />
            </div>
          </div>

          {/* speedup readout */}
          <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <Stat k="OUTPUTS / BLOCK" v="~256" sub="typical" />
            <Stat k="PRE-2022 SCAN" v={Math.max(1, leftCount) + " ms"} sub="ECDH per output" />
            <Stat k="VIEW-TAGGED" v={Math.max(1, Math.ceil(rightCount / 64)) + " ms"} sub="memcmp prefilter" tone="acc" />
            <Stat k="SPEEDUP" v="256×" sub="no privacy cost" tone="p" />
          </div>
        </>
      }
      panel={
        <>
          <div>
            <h6>The metaphor</h6>
            <div className="lede">
              A lighthouse keeper, searching for one ship in fog. Without view tags she walks the cliff edge inspecting every silhouette. With view tags every <em>non-matching</em> ship has a different color signal lamp — she dismisses 255 of 256 with a glance.
            </div>
          </div>

          <div className="body">
            A view tag is a single byte derived from the same shared secret used for the full output ownership check. If the byte doesn't match what your view-key would produce, the output <b>cannot possibly be yours</b> — no need to do the slow ECDH. If it <em>does</em> match, you still do the full check (4 in 1024 false positives on average).
          </div>

          <div>
            <h6>The cost</h6>
            <div className="proto-ctrl-row"><span className="k">Tx size overhead</span><span className="v acc">+1 byte</span></div>
            <div className="proto-ctrl-row"><span className="k">Privacy delta</span><span className="v g">±0 bits</span></div>
            <div className="proto-ctrl-row"><span className="k">Wallet scan</span><span className="v acc">~256× faster</span></div>
            <div className="proto-ctrl-row"><span className="k">Mobile sync</span><span className="v g">minutes → seconds</span></div>
            <div className="proto-ctrl-row"><span className="k">Hardfork</span><span className="v">v15 · Aug 2022</span></div>
          </div>

          <div>
            <h6>Math · sketch</h6>
            <ProtoStep n={1} done title="Shared secret">Sender computes <em>r·A</em> with recipient's public view key A.</ProtoStep>
            <ProtoStep n={2} done title="Derive tag">tag = first byte of <em>H("view_tag" || r·A || idx)</em>.</ProtoStep>
            <ProtoStep n={3} done title="Attach">1 byte appended to the output. Visible to all.</ProtoStep>
            <ProtoStep n={4} on title="Scanner check">Wallet recomputes tag from <em>a·R</em>. If <em>tag ≠</em> → skip.</ProtoStep>
            <ProtoStep n={5} title="Full check">If tag == → do full ownership check. ~1/256 of outputs.</ProtoStep>
          </div>

          <div className="body" style={{ borderTop: "1px dashed var(--ink-10)", paddingTop: 12 }}>
            <em>Why this is privacy-neutral:</em> the tag leaks nothing an attacker couldn't already learn by trying to match. It's a self-inflicted false-positive rate for an enormous win in scan time. Adversaries observe the same 1/256 hit-rate <b>for every wallet</b> — no fingerprint.
          </div>
        </>
      }
    />
  );
}


