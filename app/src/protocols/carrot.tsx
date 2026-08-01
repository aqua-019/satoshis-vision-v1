// protocols/carrot.tsx — THE KEYHOLE
// Two panes, one boundary. Hand a business's accountant a bounded view key
// and only incoming payments illuminate; outgoing spends, change outputs and
// the running balance stay in a sealed vault the auditor pane structurally
// cannot render. Toggle "today's full view key" to see how much wider that
// door swings open under the status quo — that contrast is the whole pitch.
//
// STATUS: Carrot is a DESIGN-stage spec draft (jeffro256), not finalised or
// deployed. Cross-check github.com/jeffro256/carrot before treating anything
// below as a settled cryptographic mechanism — where the exact key-splitting
// approach is still undecided, the copy says so rather than inventing detail.

import * as React from "react";
import { Stat } from "@/design/primitives";
import { ProtoArtboard, ProtoStep } from "@/design/ProtoArtboard";
import { ProtoCanvas } from "@/protocols/use-proto-canvas";
import type { ProtoDrawFn } from "@/protocols/use-proto-canvas";
import { Provenance } from "@/design/provenance";
import { randHex } from "@/protocols/sim-random";
import type { MoneroLive } from "@/data/types";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

interface IncomingEvent { id: string; amountXmr: number }
// No amount field, by design — the sealed pane's draw fn is handed this
// shape and this shape alone, so there is nothing in it that could ever
// render as a figure. See the SealedCanvas comment below.
interface SealedEvent { id: string; kind: "spend" | "change" | "balance" }

const SEALED_EVENTS: SealedEvent[] = [
  { id: "sp-1", kind: "spend" },
  { id: "sp-2", kind: "spend" },
  { id: "ch-1", kind: "change" },
  { id: "sp-3", kind: "spend" },
  { id: "ch-2", kind: "change" },
  { id: "bal-1", kind: "balance" },
];

const FONT = "11px 'JetBrains Mono', ui-monospace, monospace";

export function CarrotView({ bg }: ViewProps) {
  const [keyGranted, setKeyGranted] = React.useState(false);
  const [legacyMode, setLegacyMode] = React.useState(false);

  const incomingEvents = React.useMemo<IncomingEvent[]>(
    () => Array.from({ length: 5 }, (_, i) => ({
      id: "in-" + i,
      amountXmr: Number((Math.random() * 3.4 + 0.05).toFixed(4)),
    })),
    [],
  );
  const totalIncoming = React.useMemo(
    () => incomingEvents.reduce((s, e) => s + e.amountXmr, 0),
    [incomingEvents],
  );
  const keySample = React.useMemo(() => randHex(10), []);

  // ── SEALED pane · reads SEALED_EVENTS only ──────────────────────────
  // No prop, no closure variable here can carry an amount — SealedEvent
  // has no amount field. keyGranted/legacyMode are never referenced, so no
  // control on this page can change what this function draws. That's the
  // "true by construction" guarantee, not a promise kept by discipline.
  const sealedDraw: ProtoDrawFn = React.useCallback((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(5,5,5,0.92)";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(168,160,148,0.05)";
    for (let x = -h; x < w; x += 15) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke();
    }
    const pulse = 0.5 + 0.15 * Math.sin(t * 1.3);
    const lx = w / 2, ly = 32;
    ctx.strokeStyle = `rgba(184,122,255,${pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(lx, ly, 9, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = `rgba(184,122,255,${pulse * 0.85})`;
    ctx.fillRect(lx - 12, ly, 24, 16);
    ctx.font = FONT;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(168,160,148,0.5)";
    ctx.fillText("SEALED · FOREVER", lx, ly + 38);

    const rowY = 92, rowH = 26;
    ctx.textAlign = "left";
    SEALED_EVENTS.forEach((ev, i) => {
      const y = rowY + i * rowH;
      if (y > h - 10) return;
      ctx.fillStyle = "rgba(168,160,148,0.4)";
      ctx.fillText(ev.kind.toUpperCase(), 16, y);
      ctx.fillStyle = ev.kind === "balance" ? "rgba(255,212,0,0.5)" : "rgba(184,122,255,0.45)";
      ctx.fillText("██████████", 112, y);
    });
  }, []);

  // ── AUDITOR pane · reads incomingEvents + keyGranted ────────────────
  // The horizontal sweep is decorative (uses t); every figure it draws
  // comes from incomingEvents, which never held a spend, change output,
  // or balance to begin with.
  const auditorDraw: ProtoDrawFn = React.useCallback((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(5,5,5,0.92)";
    ctx.fillRect(0, 0, w, h);
    ctx.font = FONT;

    if (!keyGranted) {
      const lx = w / 2, ly = h / 2 - 14;
      ctx.strokeStyle = "rgba(168,160,148,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(lx, ly, 13, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(lx - 6, ly + 9); ctx.lineTo(lx + 6, ly + 9);
      ctx.lineTo(lx + 3, ly + 26); ctx.lineTo(lx - 3, ly + 26); ctx.closePath();
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(168,160,148,0.4)";
      ctx.fillText("NO KEY GRANTED", lx, ly + 50);
      return;
    }

    const sweepX = w * 0.15 + ((t * 46) % (w * 0.7));
    const grad = ctx.createLinearGradient(sweepX - 44, 0, sweepX + 44, 0);
    grad.addColorStop(0, "rgba(94,211,244,0)");
    grad.addColorStop(0.5, "rgba(94,211,244,0.07)");
    grad.addColorStop(1, "rgba(94,211,244,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(94,211,244,0.85)";
    ctx.fillText("AUDITOR SEES", 16, 22);

    const rowY = 50, rowH = 26;
    incomingEvents.forEach((ev, i) => {
      const y = rowY + i * rowH;
      if (y > h - 40) return;
      ctx.fillStyle = "rgba(168,160,148,0.5)";
      ctx.textAlign = "left";
      ctx.fillText("incoming", 16, y);
      ctx.fillStyle = "rgba(94,211,244,0.95)";
      ctx.textAlign = "right";
      ctx.fillText("+" + ev.amountXmr.toFixed(4) + " XMR", w - 16, y);
    });

    const totalY = rowY + incomingEvents.length * rowH + 16;
    ctx.strokeStyle = "rgba(168,160,148,0.15)";
    ctx.beginPath(); ctx.moveTo(16, totalY - 12); ctx.lineTo(w - 16, totalY - 12); ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(168,160,148,0.5)";
    ctx.fillText("visible total (incoming only)", 16, totalY);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(74,222,128,0.9)";
    ctx.fillText(totalIncoming.toFixed(4) + " XMR", w - 16, totalY);
  }, [keyGranted, incomingEvents, totalIncoming]);

  const auditorLabel = keyGranted
    ? `Auditor view: bounded key granted. ${incomingEvents.length} incoming payments visible, totaling ${totalIncoming.toFixed(4)} XMR. Outgoing spends, change outputs and running balance are not shown.`
    : "Auditor view: no key granted. Nothing is visible yet.";
  const sealedLabel = `Sealed vault: ${SEALED_EVENTS.length} records — spends, change outputs, running balance — permanently redacted. This pane never renders their values, in any state.`;

  return (
    <ProtoArtboard
      label="Carrot · The keyhole"
      kicker="MONERO FUTURE · v19 · BOUNDED VIEW KEYS · DESIGN · SPEC DRAFT"
      title='Carrot — a <em>keyhole</em>, not the front door'
      sub="Carrot (Cryptonote Address on Rerandomizable-RingCT Output Transactions) is jeffro256's answer to the institutional question: how does a business prove revenue to an accountant without handing over surveillance-grade access to its whole financial life?"
      badges={[
        { label: "Spec draft · 2027+", tone: "" },
        { label: "No hard fork", tone: "acc" },
        { label: "Bounded disclosure", tone: "priv" },
      ]}
      right={<Provenance source="model" />}
      bg={bg}
      stage={
        <>
          <div style={{ position: "absolute", top: 0, right: 0, fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--ink-40)", letterSpacing: "0.18em" }}>
            FIG. 19 · THE KEYHOLE · BOUNDED DISCLOSURE
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 8 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <div className="kicker" style={{ color: "var(--p-50)" }}>SEALED · forever</div>
                <div className="dim2" style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)" }}>spends · change · balance</div>
              </div>
              <ProtoCanvas draw={sealedDraw} label={sealedLabel} height={280} style={{ border: "1px solid var(--p-50)" }} />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <div className="kicker" style={{ color: keyGranted ? "var(--c-50)" : "var(--ink-40)" }}>AUDITOR VIEW · bounded key</div>
                <div className="dim2" style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)" }}>incoming only</div>
              </div>
              <ProtoCanvas draw={auditorDraw} label={auditorLabel} height={280} style={{ border: "1px solid " + (keyGranted ? "var(--c-50)" : "var(--ink-20)") }} />
              {keyGranted ? (
                <div className="dim2" style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", marginTop: 4 }}>
                  handed to auditor: cVK_in_{keySample}…
                </div>
              ) : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
            <button type="button" className="proto-btn" onClick={() => setKeyGranted((v) => !v)}>
              {keyGranted ? "Revoke bounded view key" : "Hand over bounded view key"}
            </button>
            <button type="button" className="proto-btn" aria-pressed={legacyMode} onClick={() => setLegacyMode((v) => !v)}>
              {legacyMode ? "Hide today's key contrast" : "Compare: today's full view key"}
            </button>
          </div>

          {legacyMode ? (
            <div style={{ marginTop: 16, padding: "12px 14px", border: "1px dashed var(--y-50)", background: "rgba(255,212,0,0.05)" }}>
              <div className="kicker" style={{ color: "var(--y-50)", marginBottom: 6 }}>CONTRAST · TODAY'S FULL VIEW KEY</div>
              <div className="proto-ctrl-row"><span className="k">Carrot bounded key exposes</span><span className="v acc">1 of 4 categories — incoming only</span></div>
              <div className="proto-ctrl-row"><span className="k">Today's full view key exposes</span><span className="v" style={{ color: "var(--y-50)" }}>4 of 4 — incoming + spends + change + balance</span></div>
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <div style={{ flex: 1 }}>
                  <div className="dim2" style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", marginBottom: 3 }}>CARROT</div>
                  <div style={{ height: 6, background: "var(--ink-10)" }}><div style={{ height: "100%", width: "25%", background: "var(--c-50)", transition: "width var(--d-4) var(--e-standard)" /* D0651: 0.5s exact → --d-4 */ }} /></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="dim2" style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", marginBottom: 3 }}>TODAY</div>
                  <div style={{ height: 6, background: "var(--ink-10)" }}><div style={{ height: "100%", width: "100%", background: "var(--y-50)", transition: "width var(--d-4) var(--e-standard)" /* D0651: 0.5s exact → --d-4 */ }} /></div>
                </div>
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <Stat k="DISCLOSURE" v="incoming only" tone="acc" />
            <Stat k="SPENDS" v="sealed" tone="p" />
            <Stat k="BALANCE" v="sealed" tone="p" />
            <Stat k="FORK NEEDED" v="none" tone="g" />
          </div>
        </>
      }
      panel={
        <>
          <div>
            <h6>The metaphor</h6>
            <div className="lede">
              A <span style={{ color: "var(--c-50)" }}>keyhole</span> in a locked door, not a front-door key. An accountant standing outside can watch money arrive — never what sits in the vault, never what leaves by another door.
            </div>
          </div>

          <div className="body">
            A business needs to show an accountant its <b>revenue</b>. Today that usually means handing over the wallet's full view key — which also hands over every outgoing payment, every change output, and the running balance. Carrot is a wallet-side addressing protocol designed so <em>incoming-only</em> disclosure is a first-class option, not a manual redaction exercise.
          </div>

          <div>
            <h6>How the boundary holds</h6>
            <ProtoStep n={1} done title="The institutional problem">
              An accountant needs proof of revenue. Handing over surveillance-grade access to the whole treasury is not proof — it's overreach.
            </ProtoStep>
            <ProtoStep n={2} done title="Separate the view material">
              Conceptually, Carrot keeps the material that recognizes <em>incoming</em> payments apart from the material that traces outgoing spends or computes balance. The exact key-splitting mechanism is still spec-draft — treat this step as the design goal, not a finalized construction.
            </ProtoStep>
            <ProtoStep n={3} done={keyGranted} on={!keyGranted} title="Hand over only the incoming half">
              The auditor's wallet software can decrypt amounts and timestamps of payments received. Nothing else crosses the boundary.
            </ProtoStep>
            <ProtoStep n={4} done title="Spends and balance stay home">
              Outgoing transfers need the spend key or the full view key — neither crosses. Balance is a spend-side computation, so it's sealed by the same boundary, not hidden by convention.
            </ProtoStep>
            <ProtoStep n={5} done title="No fork, wallet-by-wallet">
              An addressing protocol, not a consensus change — Carrot rolls out per wallet, no hard fork, and is designed to stay compatible with today's addresses.
            </ProtoStep>
          </div>

          <div>
            <h6>Status</h6>
            <div className="proto-ctrl-row"><span className="k">Status</span><span className="v" style={{ color: "var(--y-50)" }}>DESIGN · spec draft</span></div>
            <div className="proto-ctrl-row"><span className="k">Author</span><span className="v">jeffro256</span></div>
            <div className="proto-ctrl-row"><span className="k">Era</span><span className="v">FCMP++</span></div>
            <div className="proto-ctrl-row"><span className="k">Timeline</span><span className="v">2027+ · wallet-side</span></div>
          </div>

          <div className="body" style={{ borderTop: "1px dashed var(--ink-10)", paddingTop: 12 }}>
            <em>Honesty check:</em> Carrot is not finalized or deployed. This sim illustrates the disclosure boundary the design targets — see <span style={{ color: "var(--c-50)" }}>github.com/jeffro256/carrot</span> for the current draft before treating any mechanism here as settled.
          </div>
        </>
      }
    />
  );
}
