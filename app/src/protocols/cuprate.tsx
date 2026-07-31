// protocols/cuprate.tsx — TWIN ENGINES
// monerod and Cuprate sync the same chain in parallel. Every block, both
// engines independently compute a verdict; the stage's real "story" is the
// per-block cross-check, not a sync-speed race. A real button injects a
// simulated consensus bug into Cuprate; the divergence is caught, flagged,
// and frozen on-screen until the operator repairs it. Pure MODEL surface —
// the `data` prop is intentionally never read.

import * as React from "react";
import { useReducedMotion } from "@/design/useReducedMotion";
import { ProtoArtboard, ProtoStep } from "@/design/ProtoArtboard";
import { ProtoCanvas } from "@/protocols/use-proto-canvas";
import type { ProtoDrawFn } from "@/protocols/use-proto-canvas";
import { Stat, Provenance } from "@/design/primitives";
import { randHex } from "@/protocols/sim-random";
import type { MoneroLive } from "@/data/types";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

const MONO = '"JetBrains Mono", ui-monospace, monospace';
const BASE_HEIGHT = 3305233; // illustrative anchor height, not live chain data
const BLOCK_SEC = 1.6; // seconds per simulated block, at normal playback speed
const START_OFFSET = 7; // blocks of "history" already synced when the stage mounts

function memoHash(cache: Map<number, string>, height: number): string {
  let v = cache.get(height);
  if (!v) { v = randHex(10); cache.set(height, v); }
  return v;
}

function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, colW: number, boxH: number, color: string, height: number, hash: string, isTip: boolean) {
  const bw = colW - 14;
  ctx.fillStyle = color + "1f";
  ctx.strokeStyle = isTip ? color : color + "99";
  ctx.lineWidth = isTip ? 2 : 1;
  ctx.fillRect(x - bw / 2, y - boxH / 2, bw, boxH);
  ctx.strokeRect(x - bw / 2, y - boxH / 2, bw, boxH);
  ctx.textAlign = "center";
  ctx.fillStyle = "#a8a094";
  ctx.font = `11px ${MONO}`;
  ctx.fillText(String(height), x, y - boxH / 2 - 9);
  ctx.fillStyle = color;
  ctx.font = `12px ${MONO}`;
  ctx.fillText(hash.slice(0, 8), x, y + 4);
}

// cuprate.jsx — TWIN ENGINES
// Two independent implementations sync the same chain. The cross-check
// between them — not the race to sync — is the point of the demo.
export function CuprateView({ bg }: ViewProps) {
  const [diverged, setDiverged] = React.useState(false);
  const [bugBlock, setBugBlock] = React.useState<number | null>(null);
  const [catchCount, setCatchCount] = React.useState(0);
  const [canvasKey, setCanvasKey] = React.useState(0);
  // Under reduced motion there is no rAF loop to pick the state change up, so
  // these handlers bump canvasKey to force a repaint. Read through the shared
  // hook (the repo's single definition) rather than calling matchMedia here:
  // a call inside a handler re-queries every click and never subscribes, so a
  // mid-session preference change was invisible to React.
  const reduce = useReducedMotion();

  // "freeze" / "resume" are consumed by the very next draw() call, using that
  // frame's real elapsed time — this is what lets the demo work identically
  // under prefers-reduced-motion (one forced static frame) and full motion
  // (the next rAF tick), driven from state rather than only from elapsed t.
  const pendingRef = React.useRef<"freeze" | "resume" | null>(null);
  const shiftRef = React.useRef(-START_OFFSET * BLOCK_SEC);
  const frozenRef = React.useRef(0);
  const goodCache = React.useRef(new Map<number, string>()).current;
  const poisonCache = React.useRef(new Map<number, string>()).current;

  const onInject = () => {
    if (diverged || pendingRef.current) return;
    pendingRef.current = "freeze";
    if (reduce) setCanvasKey((k) => k + 1);
  };
  const onReset = () => {
    if (!diverged) return;
    pendingRef.current = "resume";
    if (reduce) setCanvasKey((k) => k + 1);
  };

  const draw: ProtoDrawFn = (ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    let flagged = diverged;
    let curBug = bugBlock;
    if (pendingRef.current === "freeze") {
      pendingRef.current = null;
      const curTick = Math.max(0, Math.floor((t - shiftRef.current) / BLOCK_SEC));
      frozenRef.current = curTick * BLOCK_SEC;
      flagged = true; curBug = curTick;
      setDiverged(true); setBugBlock(curTick); setCatchCount((c) => c + 1);
    } else if (pendingRef.current === "resume") {
      pendingRef.current = null;
      shiftRef.current = t - frozenRef.current;
      flagged = false; curBug = null;
      setDiverged(false); setBugBlock(null);
    }
    const dispT = flagged ? frozenRef.current : t - shiftRef.current;
    const dispTick = Math.max(0, Math.floor(dispT / BLOCK_SEC));

    const padX = 16;
    const colW = Math.max(64, Math.min(120, (w - padX * 2) / 8));
    const visible = Math.max(4, Math.floor((w - padX * 2) / colW));
    const yTop = h * 0.32, yBot = h * 0.76, boxH = Math.min(38, h * 0.16);

    ctx.textAlign = "left"; ctx.font = `700 12px ${MONO}`;
    ctx.fillStyle = "#ff7a1a"; ctx.fillText("MONEROD · reference, C++", padX, 16);
    ctx.fillStyle = "#ffd400"; ctx.fillText("CUPRATE · alpha, Rust", padX, h - 26);
    ctx.textAlign = "right"; ctx.font = `11px ${MONO}`;
    ctx.fillStyle = "rgba(168,160,148,0.6)";
    ctx.fillText(`tip · block ${BASE_HEIGHT + dispTick}`, w - padX, 16);

    if (dispTick - (visible - 1) > 0) {
      ctx.textAlign = "left"; ctx.font = `11px ${MONO}`;
      ctx.fillStyle = "rgba(168,160,148,0.35)";
      ctx.fillText("⋯ earlier blocks", padX, h / 2 + 4);
    }

    for (let k = 0; k < visible; k++) {
      const tick = dispTick - (visible - 1 - k);
      if (tick < 0) continue;
      const x = padX + k * colW + colW / 2;
      const height = BASE_HEIGHT + tick;
      const mHash = memoHash(goodCache, tick);
      const isBug = flagged && curBug === tick;
      const cHash = isBug ? memoHash(poisonCache, tick) : mHash;
      const agree = mHash === cHash;
      const isTip = tick === dispTick;

      if (k > 0) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "rgba(255,122,26,0.3)";
        ctx.beginPath(); ctx.moveTo(x - colW, yTop); ctx.lineTo(x - colW / 2 - 12, yTop); ctx.stroke();
        ctx.strokeStyle = "rgba(255,212,0,0.3)";
        ctx.beginPath(); ctx.moveTo(x - colW, yBot); ctx.lineTo(x - colW / 2 - 12, yBot); ctx.stroke();
      }

      drawBlock(ctx, x, yTop, colW, boxH, "#ff7a1a", height, mHash, isTip);
      drawBlock(ctx, x, yBot, colW, boxH, "#ffd400", height, cHash, isTip);

      ctx.lineWidth = agree ? 1 : 2;
      ctx.strokeStyle = agree ? "rgba(74,222,128,0.5)" : "#ff4d6d";
      ctx.setLineDash(agree ? [] : [3, 3]);
      ctx.beginPath(); ctx.moveTo(x, yTop + boxH / 2); ctx.lineTo(x, yBot - boxH / 2); ctx.stroke();
      ctx.setLineDash([]);

      const midY = (yTop + boxH / 2 + yBot - boxH / 2) / 2;
      ctx.beginPath(); ctx.arc(x, midY, 10, 0, Math.PI * 2);
      ctx.fillStyle = agree ? "rgba(74,222,128,0.15)" : "rgba(255,77,109,0.22)"; ctx.fill();
      ctx.strokeStyle = agree ? "#4ade80" : "#ff4d6d"; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = agree ? "#4ade80" : "#ff4d6d";
      ctx.font = `700 13px ${MONO}`; ctx.textAlign = "center";
      ctx.fillText(agree ? "✓" : "✗", x, midY + 1);

      if (!agree) {
        ctx.strokeStyle = "#ff4d6d"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
        ctx.strokeRect(x - colW / 2 + 4, yTop - boxH / 2 - 6, colW - 8, yBot - yTop + boxH + 12);
        ctx.setLineDash([]);
        ctx.fillStyle = "#ff4d6d"; ctx.font = `700 11px ${MONO}`; ctx.textAlign = "center";
        ctx.fillText("DIVERGES", x, yTop - boxH / 2 - 16);
      }
    }

    ctx.textAlign = "left"; ctx.font = `11px ${MONO}`;
    ctx.fillStyle = "rgba(168,160,148,0.55)";
    ctx.fillText("✓ same verdict, both engines     ✗ verdict diverges — flagged, not accepted", padX, h - 8);
  };

  const canvasLabel = diverged
    ? `Consensus cross-check: monerod and Cuprate disagree at block ${BASE_HEIGHT + (bugBlock ?? 0)}. Cuprate's block hash differs from monerod's reference hash. The block is flagged and sync is paused pending repair.`
    : "Consensus cross-check: monerod and Cuprate are syncing in parallel, independently agreeing on every block hash so far.";

  return (
    <ProtoArtboard
      label="Cuprate · Twin Engines"
      kicker="MONERO PROTOCOL · CONSENSUS · TWIN ENGINES"
      title='Cuprate — a second engine that has to <em>agree</em>'
      sub="Since 2014, every reachable Monero node has run monerod. One consensus bug, one poisoned dependency, one bad release, and the network stutters as one — there's no second opinion. Cuprate is an independent Rust implementation that must reach the identical verdict on every block, or the divergence is visible."
      badges={[
        { label: "Rust · AGPL-3.0/MIT", tone: "acc" },
        { label: "ALPHA", tone: "priv" },
        { label: diverged ? "⚠ divergence flagged" : "✓ consensus agrees", tone: diverged ? "" : "ready" },
      ]}
      right={<Provenance source="model" />}
      bg={bg}
      stage={
        <>
          <div style={{ position: "absolute", top: 0, right: 0, fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--ink-40)", letterSpacing: "0.18em" }}>
            FIG. C1 · TWIN ENGINES · BLOCK-BY-BLOCK CROSS-CHECK
          </div>

          <ProtoCanvas key={canvasKey} draw={draw} height={320} label={canvasLabel} />

          <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <button type="button" className="proto-btn" onClick={onInject} disabled={diverged}>
              Inject consensus bug
            </button>
            <button type="button" className="proto-btn" onClick={onReset} disabled={!diverged}>
              Reset / repair
            </button>
            <div style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", color: diverged ? "var(--r-50)" : "var(--g-50)" }}>
              {diverged ? `STATUS: divergence caught at block ${BASE_HEIGHT + (bugBlock ?? 0)}` : "STATUS: engines agree, block-by-block"}
            </div>
          </div>

          <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <Stat k="LANGUAGE" v="Rust" sub="vs monerod's C++" />
            <Stat k="SYNC SPEED" v="~1.4×" sub="model, not benchmark" tone="acc" />
            <Stat k="CLIENTS" v="1 → 2" sub="since 2014 → 2024" tone="p" />
            <Stat k="DIVERGENCES CAUGHT" v={catchCount} sub={diverged ? "block flagged now" : "none pending"} tone={diverged ? "dn" : "g"} />
          </div>
        </>
      }
      panel={
        <>
          <div>
            <h6>The metaphor</h6>
            <div className="lede">
              <span style={{ color: "#ffd400" }}>Twin engines</span>, reading the same map from two different manuals. If they land on the same coordinates on every page, the map is probably right. If they don't — one manual has a typo, and for the first time there are two manuals to compare, not one.
            </div>
          </div>

          <div className="body">
            <b>monerod</b> is the reference C++ implementation — the only lens the network has looked through since 2014. <b>Cuprate</b>, built by <b>boog900</b> and <b>hinto-janai</b>, is a from-scratch Rust rewrite that must independently derive the same consensus verdict on every block. Its first full mainnet sync landed in June 2024.
          </div>

          <div>
            <h6>What the stage shows</h6>
            <ProtoStep n={1} done title="Independent implementation">Cuprate re-derives Monero's consensus rules from the protocol itself — not a port of monerod's C++.</ProtoStep>
            <ProtoStep n={2} done title="Parallel validation">Both engines receive the same block from the P2P network and validate it independently.</ProtoStep>
            <ProtoStep n={3} on={!diverged} title="Cross-check, block by block">Each engine's resulting hash is compared. Agreement is the default, expected outcome — every ✓ above.</ProtoStep>
            <ProtoStep n={4} on={diverged} title="Divergence caught">Press <em>Inject consensus bug</em> — one engine now disagrees, and the block is flagged instead of silently accepted.</ProtoStep>
            <ProtoStep n={5} done={catchCount > 0 && !diverged} title="Repair and resume">Press <em>Reset / repair</em>. With only monerod, there would be nothing to compare against — the bad block would simply have been the truth.</ProtoStep>
          </div>

          <div>
            <h6>Status · reference</h6>
            <div className="proto-ctrl-row"><span className="k">Monoculture since</span><span className="v">2014 · monerod only</span></div>
            <div className="proto-ctrl-row"><span className="k">Cuprate status</span><span className="v acc">ALPHA · full sync working</span></div>
            <div className="proto-ctrl-row"><span className="k">First mainnet sync</span><span className="v">2024-06</span></div>
            <div className="proto-ctrl-row"><span className="k">License</span><span className="v">AGPL-3.0 / MIT</span></div>
            <div className="proto-ctrl-row"><span className="k">Roadmap</span><span className="v">P2P hardening → RPC parity</span></div>
          </div>

          <div className="body" style={{ borderTop: "1px dashed var(--ink-10)", paddingTop: 12 }}>
            <em>Not yet a drop-in replacement:</em> Cuprate is alpha software — the goal isn't replacing monerod, it's a meaningful share of reachable nodes running independent code, so one bug, one dependency, or one bad release can no longer take the whole network down at once.
          </div>
        </>
      }
    />
  );
}
