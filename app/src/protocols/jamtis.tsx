// protocols/jamtis.tsx — ADDRESS LOOM
//
// A classic Monero address is 95 characters of undifferentiated base58 — one
// ribbon, no internal structure. Jamtis (tevador, alongside Seraphis) weaves
// the same information into 75 characters across six named, checksummed
// spans. The centerpiece: mutate one character in a live address and watch
// the checksum — recomputed over every span — visibly, unmistakably fail.
//
// The checksum implemented below is an HONEST MODEL: a small deterministic
// hash written for this demo, not tevador's real algorithm. See the panel's
// "Model, not spec" section and the spec link for the actual scheme:
// https://gist.github.com/tevador/50160d160d24cfc6c52ae02eb3d17024

import * as React from "react";
import { ProtoArtboard, ProtoStep } from "@/design/ProtoArtboard";
import { Stat, Provenance } from "@/design/primitives";
import { ProtoCanvas } from "@/protocols/use-proto-canvas";
import type { MoneroLive } from "@/data/types";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

interface AddrParts {
  prefix: string; viewbal: string; viewrecv: string;
  spend: string; tag: string; checksum: string;
}

// Deterministic hash → base58 checksum. A model of "some function that
// changes if any upstream character changes" — not the real Jamtis scheme.
function computeChecksum(payload: string, len = 8): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = "";
  for (let i = 0; i < len; i++) {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    out += BASE58[Math.abs(h) % BASE58.length];
  }
  return out;
}

const randBase58 = (len: number) => {
  let s = "";
  for (let i = 0; i < len; i++) s += BASE58[(Math.random() * BASE58.length) | 0];
  return s;
};

function buildAddress(): AddrParts {
  const prefix = randBase58(4), viewbal = randBase58(16), viewrecv = randBase58(16);
  const spend = randBase58(16), tag = randBase58(15);
  return { prefix, viewbal, viewrecv, spend, tag, checksum: computeChecksum(prefix + viewbal + viewrecv + spend + tag) };
}

// Fixed seed → same illustration on every render, reproducible in review.
const seededBase58 = (seed: number, len: number) => {
  let s = seed >>> 0, out = "";
  for (let i = 0; i < len; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; out += BASE58[s % BASE58.length]; }
  return out;
};
const LEGACY_GENUINE = "4" + seededBase58(0xc0ffee, 94);
const LEGACY_DIFF_IDX = 51;
const LEGACY_FAKE = (() => {
  const chars = LEGACY_GENUINE.split("");
  const orig = chars[LEGACY_DIFF_IDX];
  chars[LEGACY_DIFF_IDX] = BASE58[(BASE58.indexOf(orig) + 29) % BASE58.length];
  return chars.join("");
})();

interface SpanDef { key: keyof AddrParts; label: string; rgb: string; css: string; desc: string; }
const SPANS: SpanDef[] = [
  { key: "prefix", label: "Network prefix", rgb: "255,140,40", css: "var(--tk-accent)",
    desc: "Which network this address belongs to — mainnet, stagenet, testnet." },
  { key: "viewbal", label: "View-balance key", rgb: "94,211,244", css: "var(--c-50)",
    desc: "Proves the FULL balance — incoming and outgoing — to an auditor. Cannot spend." },
  { key: "viewrecv", label: "View-received key", rgb: "184,122,255", css: "var(--p-50)",
    desc: "Sees incoming payments only. What a light wallet or PoS terminal needs — nothing more." },
  { key: "spend", label: "Spend key", rgb: "74,222,128", css: "#4ade80",
    desc: "The only span that authorizes moving funds. Never leaves cold storage." },
  { key: "tag", label: "Address tag", rgb: "255,212,0", css: "var(--y-50)",
    desc: "Native sub-address identifier baked into the address — no lookup table to scan." },
  { key: "checksum", label: "Checksum", rgb: "255,77,109", css: "#ff4d6d",
    desc: "Recomputed from every other span. One wrong character upstream and this stops matching." },
];

export function JamtisView({ bg }: ViewProps) {
  const [addr, setAddr] = React.useState<AddrParts>(buildAddress);
  const [activeKey, setActiveKey] = React.useState<keyof AddrParts>("spend");
  const [mutatedKey, setMutatedKey] = React.useState<keyof AddrParts | null>(null);

  const payload = addr.prefix + addr.viewbal + addr.viewrecv + addr.spend + addr.tag;
  const valid = computeChecksum(payload) === addr.checksum;
  const activeSpan = SPANS.find((s) => s.key === activeKey)!;

  const mutate = () => {
    setAddr((prev) => {
      const chars = prev[activeKey].split("");
      const idx = (Math.random() * chars.length) | 0;
      let ch = BASE58[(Math.random() * BASE58.length) | 0];
      while (ch === chars[idx]) ch = BASE58[(Math.random() * BASE58.length) | 0];
      chars[idx] = ch;
      return { ...prev, [activeKey]: chars.join("") };
    });
    setMutatedKey(activeKey);
  };
  const regen = () => { setAddr(buildAddress()); setMutatedKey(null); };

  const canvasLabel = valid
    ? `Address loom, six colored threads for the six spans of a 75-character Jamtis address: ${SPANS.map((s) => s.label).join(", ")}. Checksum currently valid.`
    : `Address loom: the checksum thread has snapped. The ${SPANS.find((s) => s.key === mutatedKey)?.label ?? "payload"} span was altered and the checksum no longer matches — a wallet would reject this address.`;

  const draw = React.useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    ctx.clearRect(0, 0, w, h);
    const rowH = h / SPANS.length;
    SPANS.forEach((sp, i) => {
      const y = rowH * i + rowH / 2;
      const broken = !valid && sp.key === "checksum";
      const active = sp.key === activeKey;
      ctx.beginPath();
      for (let x = 16; x <= w - 10; x += 6) {
        const wob = broken ? Math.sin(x * 0.7 + t * 4) * 6 : Math.sin(t * 1.1 + i * 0.7 + x * 0.02) * 2.2;
        if (x === 16) ctx.moveTo(x, y + wob); else ctx.lineTo(x, y + wob);
      }
      ctx.strokeStyle = broken ? "rgba(255,60,60,0.9)" : `rgba(${sp.rgb},${active ? 0.95 : 0.5})`;
      ctx.lineWidth = active ? 3 : 1.5;
      ctx.stroke();
      // A CSS custom property never resolves inside ctx.font — the assignment
      // is silently ignored and the canvas keeps its 10px sans-serif default.
      // Name the stack literally, as the other five sims do.
      ctx.font = "11px 'JetBrains Mono', ui-monospace, monospace";
      ctx.fillStyle = broken ? "rgba(255,60,60,0.95)" : `rgba(${sp.rgb},0.9)`;
      ctx.fillText(sp.key.toUpperCase().slice(0, 7), 16, y - 6);
    });
  }, [valid, activeKey]);

  return (
    <ProtoArtboard
      label="F2 · Jamtis"
      kicker="FUTURE PROTOCOL · 02 · ADDRESS FORMAT · BETA · SHIPS WITH SERAPHIS · FORK v18"
      title='Jamtis — the address that <em>defends itself</em>'
      sub="95 characters of undifferentiated base58 become a 75-character format with six named spans and a checksum over all of them. Swap one character anywhere and the address stops verifying — before a single atomic unit moves."
      badges={[
        { label: "tevador", tone: "" },
        { label: "75 ch · −21%", tone: "acc" },
        { label: "BETA", tone: "priv" },
      ]}
      right={<Provenance source="model" />}
      bg={bg}
      stage={
        <>
          <div style={{ position: "absolute", top: 0, right: 0, fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--ink-40)", letterSpacing: "0.18em" }}>
            FIG. 02 · ADDRESS LOOM · 6 SPANS
          </div>

          <ProtoCanvas draw={draw} height={140} label={canvasLabel} />

          <div style={{ marginTop: 18 }}>
            <div className="kicker" style={{ marginBottom: 8 }}>THE ADDRESS · TAB TO A SPAN, THEN MUTATE</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {SPANS.map((sp) => {
                const text = addr[sp.key];
                const active = activeKey === sp.key;
                const broken = !valid && sp.key === "checksum";
                const changed = mutatedKey === sp.key && sp.key !== "checksum";
                return (
                  <button key={sp.key} type="button"
                    onFocus={() => setActiveKey(sp.key)}
                    onMouseEnter={() => setActiveKey(sp.key)}
                    onClick={() => setActiveKey(sp.key)}
                    aria-pressed={active}
                    aria-label={`${sp.label}: ${text}${broken ? " — checksum mismatch" : changed ? " — changed" : ""}`}
                    style={{
                      fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", cursor: "pointer",
                      background: active ? `rgba(${sp.rgb},0.14)` : "transparent",
                      color: broken ? "#ff4d6d" : sp.css,
                      border: "1px solid " + (broken ? "#ff4d6d" : changed ? "var(--y-50)" : active ? sp.css : "var(--ink-20)"),
                      borderStyle: broken ? "dashed" : changed ? "dashed" : "solid",
                      padding: "3px 4px", letterSpacing: "-0.01em", wordBreak: "break-all",
                    }}>
                    {text}
                    {broken ? <sup style={{ marginLeft: 2 }}>✕</sup> : changed ? <sup style={{ marginLeft: 2 }}>Δ</sup> : null}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", color: activeSpan.css }}>{activeSpan.label}</span>
              <span style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--ink-60)" }}>{activeSpan.desc}</span>
            </div>

            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="proto-btn" onClick={mutate}>Mutate a character in {activeSpan.label}</button>
              <button type="button" className="proto-btn" onClick={regen}>New address</button>
              <span aria-live="polite" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", color: valid ? "var(--g-50)" : "#ff4d6d" }}>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  {valid
                    ? <path d="M2 7 L5.5 10.5 L12 3" fill="none" stroke="var(--g-50)" strokeWidth="2" />
                    : <g stroke="#ff4d6d" strokeWidth="2"><line x1="3" y1="3" x2="11" y2="11" /><line x1="11" y1="3" x2="3" y2="11" /></g>}
                </svg>
                {valid ? "CHECKSUM VALID" : `CHECKSUM MISMATCH — REJECTED${mutatedKey ? " (" + SPANS.find((s) => s.key === mutatedKey)!.label + " changed)" : ""}`}
              </span>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <div className="kicker" style={{ marginBottom: 6 }}>LEGACY ADDRESS · NO STRUCTURE, NO CHECKSUM SIGNAL</div>
            <div style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", color: "var(--ink-60)", wordBreak: "break-all", lineHeight: 1.7 }}>
              <div>Real&nbsp; <span style={{ color: "var(--ink-100)" }}>{LEGACY_GENUINE}</span></div>
              <div>Sent to <span style={{ color: "var(--ink-100)" }}>{LEGACY_FAKE}</span></div>
            </div>
            <div style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--y-50)", marginTop: 4 }}>
              One character differs at position {LEGACY_DIFF_IDX + 1} of 95. Nothing in the string tells you that — no span, no checksum. The funds are gone.
            </div>
          </div>

          <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            <div className="proto-ctrl">
              <div className="kicker" style={{ marginBottom: 4, color: "var(--c-50)" }}>LIGHT WALLET / POS TERMINAL</div>
              <div className="proto-ctrl-row"><span className="k">Holds</span><span className="v">view-received key only</span></div>
              <div className="proto-ctrl-row"><span className="k">Sees</span><span className="v acc">incoming payments</span></div>
              <div className="proto-ctrl-row"><span className="k">Cannot see</span><span className="v">outgoing spends, full balance</span></div>
            </div>
            <div className="proto-ctrl">
              <div className="kicker" style={{ marginBottom: 4, color: "var(--p-50)" }}>AUDITOR / ACCOUNTANT</div>
              <div className="proto-ctrl-row"><span className="k">Holds</span><span className="v">view-balance key</span></div>
              <div className="proto-ctrl-row"><span className="k">Sees</span><span className="v acc">full balance, in + out</span></div>
              <div className="proto-ctrl-row"><span className="k">Cannot</span><span className="v">spend a single atomic unit</span></div>
            </div>
          </div>

          <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <Stat k="LENGTH" v="75 ch" sub="vs 95 legacy (−21%)" tone="acc" />
            <Stat k="CHECKSUM" v={valid ? "OK" : "FAIL"} sub="in-file model" tone={valid ? "g" : "dn"} />
            <Stat k="VIEW KEYS" v="2" sub="balance / received split" tone="p" />
            <Stat k="STATUS" v="BETA" sub="ships with Seraphis · v18" />
          </div>
        </>
      }
      panel={
        <>
          <div>
            <h6>The metaphor</h6>
            <div className="lede">
              A <span style={{ color: "#4ade80" }}>loom</span>, not a hash. A standard address is one undifferentiated ribbon — start pulling and there's nothing to grab. Jamtis weaves six distinct, load-bearing threads into the same string.
            </div>
          </div>

          <div className="body">
            A classic Monero address is 95 characters of base58 with no internal structure a human — or a wallet UI — can point to. Jamtis, designed by <b>tevador</b> (author of RandomX) alongside Seraphis, replaces it with a 75-character format where every span has exactly one job.
          </div>

          <div>
            <h6>Six spans, one string</h6>
            <ProtoStep n={1} done title="Network prefix — 4 chars">Mainnet, stagenet or testnet — visible at a glance, checkable by machine.</ProtoStep>
            <ProtoStep n={2} done title="Two view keys, not one">view-balance sees every in-and-out flow; view-received sees money arriving only. Handing out the wrong one used to mean handing over your whole history.</ProtoStep>
            <ProtoStep n={3} title="Spend key + native tag">The spend key never leaves cold storage. The tag replaces a separate sub-address table — wallets scan less to find the same outputs.</ProtoStep>
            <ProtoStep n={4} on title="Checksum over everything upstream">Recomputed from all five other spans. Flip one character anywhere and it stops matching — try it on the left.</ProtoStep>
            <ProtoStep n={5} title="The scam it kills">A look-alike address that fools the eye still fails the checksum. A wallet UI can point at the exact span that's wrong instead of asking a human to compare 75 characters.</ProtoStep>
          </div>

          <div>
            <h6>Model, not spec</h6>
            <div className="proto-ctrl-row"><span className="k">This checksum</span><span className="v">deterministic hash, in-file</span></div>
            <div className="proto-ctrl-row"><span className="k">tevador's checksum</span><span className="v acc">different algorithm</span></div>
            <div className="proto-ctrl-row"><span className="k">Real spec</span><span className="v">gist.github.com/tevador</span></div>
          </div>

          <div className="body" style={{ borderTop: "1px dashed var(--ink-10)", paddingTop: 12 }}>
            <em>Paired protocol:</em> Jamtis is the addressing layer for <span style={{ color: "#ff7a1a" }}>Seraphis</span>'s transaction format — see <span style={{ color: "#ff7a1a" }}>F1 · Seraphis</span>. Neither ships without the other.
          </div>
        </>
      }
    />
  );
}
