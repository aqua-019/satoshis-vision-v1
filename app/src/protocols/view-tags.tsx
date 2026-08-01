// AUTO-PORTED from protocols/view-tags.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import { ArtBackground } from "@/design/ArtBackground";
import { useAnimationSeconds } from "@/design/useAnimationClock";
import { useReducedMotion } from "@/design/useReducedMotion";
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

export function ScannerWall({ t, viewTag, onCounter, frozen = false }: { t: number; viewTag: boolean; onCounter?: (n: number) => void; frozen?: boolean }) {
  // 16 cols × 16 rows = 256 cells per visible slab
  const COLS = 16, ROWS = 16, TOTAL = COLS * ROWS;
  const cells = React.useMemo(() => {
    return Array.from({ length: TOTAL }).map((_, i) => ({
      i,
      tag: Math.floor(Math.random() * 256),
      mine: Math.random() < 0.0035,
    }));
  }, [viewTag]);

  // Animation cursor moves through all cells; speed differs per side.
  // `t` is seconds, so these are cells/second — the old per-frame 18 / 0.4 at
  // 20fps, scaled up by 20 to keep the same wall-clock pacing.
  const speed = viewTag ? 360 : 8;
  // `frozen` is the reduced-motion path, and it is NOT `t = 0`. Zeroing the
  // clock would leave cursor and counter at 0: no cell scanned, and — because
  // ViewTagsView's <Stat> readouts are DERIVED from these counters — both
  // panes reporting "1 ms". That reads as "view tags save you nothing", which
  // is the precise opposite of the lesson, so a zeroed duration would not be a
  // reduced-motion variant of this view; it would be a wrong one. Freeze at the
  // COMPLETED state instead: every output scanned, counters at TOTAL, so the
  // stats resolve to the real 256 ms vs 4 ms and the matched cells are visible.
  // The comparison survives with nothing moving, which is the actual contract.
  const cursor = frozen ? TOTAL : Math.floor(t * speed) % (TOTAL + 60);
  const counter = frozen ? TOTAL : Math.min(TOTAL, Math.floor(t * speed));

  React.useEffect(() => {
    if (onCounter) onCounter(counter);
  }, [counter, onCounter]);

  return (
    <div style={{ position: "relative" }}>
      {/* CLASS, not an inline grid — and that is the whole point, same reasoning
          styles.css records for the legality matrix. The mobile layer's blanket
          rule (styles.css `.proto-body [style*="grid-template-columns"]`) matches
          on the inline style ATTRIBUTE and forces `1fr !important`. This wall is
          256 `aspect-ratio: 1` cells: collapsed to one column each cell became as
          wide as the pane (~708px) and the document grew to 175,397px tall at
          390 and 366,156px at 768 — a page no one can use and a full-page
          screenshot that intermittently exceeded 60s. A class the selector cannot
          see needs no escape hatch; `.keep-cols` would "work" but drags in
          `min-width: max-content !important`, which is what put the legality
          header off-screen. Column count lives in styles.css and is mirrored by
          COLS above — change one, change both. */}
      <div className="vt-wall">
        {cells.map((c, i) => {
          const scanned = i <= cursor;
          // With view tags: pre-rejected cells dim instantly (255/256), only ~1/256 require full scan
          const preReject = viewTag && c.tag !== 200 && !c.mine;     // most cells are pre-rejected
          const candidate = viewTag && (c.tag === 200 || c.mine);    // ~4/256 cells need full scan
          const matched = scanned && c.mine;
          let bg;
          if (viewTag) {
            if (matched) bg = "linear-gradient(135deg, #b87aff 0%, var(--accent-data) 100%)";
            else if (preReject) bg = "rgba(255,255,255,0.025)";
            else if (candidate) bg = "rgba(255,180,80,0.4)";
            else bg = "rgba(255,255,255,0.04)";
          } else {
            if (matched) bg = "linear-gradient(135deg, #b87aff 0%, var(--accent-data) 100%)";
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
              transition: "background var(--d-2) var(--e-standard)", // D0651: 0.15s exact → --d-2
            }} title={`output #${i} · tag=0x${c.tag.toString(16).padStart(2, "0")}`}>
              {matched ? (
                // D0651: pulseScale 1.5s reuses styles.css's global @keyframes pulseScale as an
                // ambient "matched" pulse — not an interaction, same category as panel-breathe.
                <div style={{
                  position: "absolute", inset: -3,
                  border: "1.5px solid #b87aff",
                  pointerEvents: "none",
                  // Held still under reduce. The ring itself still marks the
                  // matched cell — the pulse was drawing attention, not carrying
                  // the fact, so suppressing it loses nothing.
                  animation: frozen ? "none" : "pulseScale 1.5s ease-in-out infinite",
                }} />
              ) : null}
              {viewTag && candidate && !matched ? (
                <div style={{
                  position: "absolute", inset: 1, display: "grid", placeItems: "center",
                  fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--ink-60)",
                }}>?</div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Full-row sweep cursor (no view tag). Dropped when frozen: it marks
          where the scan HAS REACHED, and at the completed state that is "past
          the end" — a bar parked below the last row would imply a scan still in
          progress. The completed wall and the 256/256 readout carry the state. */}
      {!viewTag && !frozen ? (
        <div style={{
          position: "absolute", left: 0, top: Math.floor(cursor / COLS) * (100 / ROWS) + "%",
          width: "100%", height: 100 / ROWS + "%",
          background: "linear-gradient(90deg, transparent, rgba(255,122,26,0.18), transparent)",
          pointerEvents: "none",
        }} />
      ) : null}

      {/* count display */}
      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", color: "var(--ink-60)" }}>
        <span>Scanned <span className="acc">{counter}/{TOTAL}</span> outputs</span>
        <span className={viewTag ? "acc" : ""}>{viewTag ? "Full ECDH on ~4 candidates" : "Full ECDH on all 256"}</span>
      </div>
    </div>
  );
}

export function ViewTagsView({ data, bg }: ViewProps) {
  // v6.0.8: was `useTick(50)` — its own 20Hz setInterval driving two
  // ScannerWalls of 256 cells each through React, running in hidden tabs.
  // Now the shared rAF clock (20fps high / 12 mid / 6 low), and expressed in
  // SECONDS so the demo's pacing is identical on every device — a teaching
  // animation that runs 3× slower on a phone teaches the wrong thing.
  // useAnimationClock/useAnimationSeconds do NOT check reduced motion the way
  // useTick freezes itself — the call site must gate them (see the note in
  // design/useReducedMotion.ts, and constellation.tsx:68 for the correct shape).
  // This one didn't, so the scanner race kept running for every visitor with
  // reduced motion set: the one surface in this file that is pure movement.
  const reduced = useReducedMotion();
  const t = useAnimationSeconds({ fps: 20, enabled: !reduced });
  const [leftCount, setLeftCount] = React.useState(0);
  const [rightCount, setRightCount] = React.useState(0);
  // 150 ticks at the old 50ms == one cycle every 7.5s.
  const cycle = Math.floor(t / 7.5);
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
          <div style={{ position: "absolute", top: 0, right: 0, fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--ink-40)", letterSpacing: "0.18em" }}>
            FIG. 03 · LIGHTHOUSE-IN-FOG · SCAN RACE
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* LEFT — pre-2022, no view tags */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div className="kicker" style={{ color: "var(--ink-60)" }}>WITHOUT VIEW TAGS · pre-2022</div>
                <div style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", color: "var(--ink-100)" }}>~256 ms/block</div>
              </div>
              <ScannerWall t={t + tagSeed * 5} viewTag={false} onCounter={setLeftCount} frozen={reduced} />
            </div>

            {/* RIGHT — view tags */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div className="kicker" style={{ color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>WITH VIEW TAGS · v15+</div>
                <div style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>~1 ms/block</div>
              </div>
              <ScannerWall t={t + tagSeed * 5} viewTag={true} onCounter={setRightCount} frozen={reduced} />
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


