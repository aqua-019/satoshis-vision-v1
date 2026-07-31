// protocols/seraphis.tsx — THE NEW ENGINE
// Act one: a transaction's three proofs — membership, ownership, amount — as
// separable, swappable modules instead of one entangled ring-signature blob.
// Act two: the six-tier wallet key hierarchy as a permission ladder, mapped
// onto three real holders (exchange address server / payment processor /
// hardware wallet). BETA, audit in progress; ships after FCMP++ as fork v18.
import * as React from "react";
import { ProtoArtboard, ProtoStep } from "@/design/ProtoArtboard";
import { Stat } from "@/design/primitives";
import { Provenance } from "@/design/provenance";
import { ProtoCanvas, type ProtoDrawFn } from "@/protocols/use-proto-canvas";
import type { MoneroLive } from "@/data/types";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const ACCENT = "#ff7a1a"; // Seraphis card colour
const PURPLE = "#b87aff";
const CYAN = "#5ed3f4";
const GREEN = "#4ade80";
const INK_80 = "rgba(168,160,148,0.85)";
const INK_60 = "rgba(168,160,148,0.55)";
const INK_40 = "rgba(168,160,148,0.32)";
const RULE = "rgba(255,255,255,0.12)";

type Backend = "grootle" | "fcmp";

// Illustrative before/after readout, keyed to the membership-proof picker.
// grootle = Seraphis's current reference design (the −30%/+40% the FUTURE
// card quotes). fcmp = a hypothetical future backend slotted into the same
// membership component — shown to demonstrate pluggability, not a spec'd or
// measured pairing.
const BACKENDS: Record<Backend, { label: string; sig: string; verify: string; note: string }> = {
  grootle: {
    label: "Grootle · Seraphis default",
    sig: "−30%",
    verify: "+40%",
    note: "The numbers Seraphis's spec currently targets, measured against today's CLSAG ring signature.",
  },
  fcmp: {
    label: "FCMP++ slot · projected",
    sig: "≈−48%*",
    verify: "≈+70%*",
    note: "*Illustrative only — FCMP++ pairing with Seraphis is discussed, not specified or measured.",
  },
};

interface Tier {
  n: number;
  key: string;
  label: string;
  can: string;
  cannot: string;
  holder?: string;
  tag?: string;
}

// Six-tier key hierarchy, tracking UkoeHB's published Seraphis wallet-key
// spec: generate-address < find-received < unlock-amounts < view-balance <
// prove-spend < master. Pre-audit — boundaries can still shift before v18.
const TIERS: Tier[] = [
  { n: 1, key: "s_ga", label: "Generate-address", can: "mint new one-time and sub-addresses",
    cannot: "see a payment, a balance, or spend", holder: "Exchange address server", tag: "XCHG" },
  { n: 2, key: "k_fr", label: "Find-received", can: "flag which chain outputs are ours (view-tag match)",
    cannot: "read the amount, see the balance, or spend" },
  { n: 3, key: "s_ua", label: "Unlock-amounts", can: "decrypt the amount of an output already flagged ours (\"view-received\")",
    cannot: "see spends, total balance, or spend funds", holder: "Payment processor", tag: "PAY" },
  { n: 4, key: "k_vb", label: "View-balance", can: "see incoming and outgoing — the full balance history",
    cannot: "produce a spend" },
  { n: 5, key: "k_ps", label: "Prove-spend", can: "produce the spend-authorization piece of a proof",
    cannot: "derive any key above it in the hierarchy" },
  { n: 6, key: "k_m", label: "Master", can: "derive every key below and spend outright",
    cannot: "", holder: "Hardware wallet", tag: "HW" },
];

export function SeraphisView({ bg }: ViewProps) {
  const [backend, setBackend] = React.useState<Backend>("grootle");
  const [tier, setTier] = React.useState(1);
  const active = TIERS[tier - 1];
  const b = BACKENDS[backend];

  // ── Act one: three modules bolting into one tx, vs one entangled blob ──
  const drawAssembly: ProtoDrawFn = (ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    const pad = 14;
    const leftW = Math.min(150, w * 0.32);
    const cx = pad + leftW / 2;
    const cy = h / 2 - 4;
    const baseR = Math.min(leftW, h - 40) * 0.3;

    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const wob = Math.sin(a * 3 + t * 0.6) * baseR * 0.22 + Math.sin(a * 5 - t * 0.35) * baseR * 0.12;
      const r = baseR + wob;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(255,122,26,0.10)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,122,26,0.55)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = INK_40;
    ctx.font = `11px ${MONO}`;
    ctx.textAlign = "left";
    ctx.fillText("TODAY · CLSAG", pad, 16);
    ctx.fillStyle = INK_80;
    ctx.font = `10px ${MONO}`;
    ctx.textAlign = "center";
    ctx.fillText("membership + ownership", cx, cy - 2);
    ctx.fillText("+ amount, one blob", cx, cy + 11);

    const arrowX = pad + leftW + 8;
    ctx.strokeStyle = INK_40;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(arrowX, cy);
    ctx.lineTo(arrowX + 20, cy);
    ctx.moveTo(arrowX + 14, cy - 5);
    ctx.lineTo(arrowX + 20, cy);
    ctx.lineTo(arrowX + 14, cy + 5);
    ctx.stroke();

    const rx = arrowX + 30, rw = w - rx - pad, rowH = (h - 32) / 3;
    const rows: [string, string, string][] = [
      ["MEMBERSHIP", backend === "fcmp" ? "FCMP++ slot (projected)" : "Grootle (beta)", backend === "fcmp" ? PURPLE : ACCENT],
      ["OWNERSHIP", "composition proof", CYAN],
      ["AMOUNT", "Bulletproof+ range", GREEN],
    ];
    rows.forEach(([label, sub, color], i) => {
      const ry = 28 + i * rowH + Math.sin(t * 0.7 + i * 0.6) * 1.4;
      const bh = rowH - 7;
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(rx, ry, rw, bh);
      ctx.strokeStyle = color;
      ctx.lineWidth = i === 0 ? 1.6 : 1;
      ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, bh - 1);
      ctx.fillStyle = color;
      ctx.font = `11px ${MONO}`;
      ctx.textAlign = "left";
      ctx.fillText(label, rx + 8, ry + bh / 2 - 2);
      ctx.fillStyle = INK_60;
      ctx.font = `10px ${MONO}`;
      ctx.fillText(sub, rx + 8, ry + bh / 2 + 11);
    });

    ctx.fillStyle = INK_40;
    ctx.font = `11px ${MONO}`;
    ctx.textAlign = "right";
    ctx.fillText("SERAPHIS · separable", w - pad, 16);
  };

  // ── Act two: the six-tier permission ladder ──
  const drawLadder: ProtoDrawFn = (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const pad = 20, y = h * 0.58;
    const x0 = pad, x1 = w - pad, step = (x1 - x0) / (TIERS.length - 1);

    ctx.strokeStyle = RULE;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();

    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + step * (tier - 1), y); ctx.stroke();

    for (const tr of TIERS) {
      const x = x0 + step * (tr.n - 1);
      const on = tr.n === tier, passed = tr.n <= tier;
      ctx.beginPath();
      ctx.arc(x, y, on ? 7 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = on ? ACCENT : passed ? "rgba(255,122,26,0.5)" : "rgba(255,255,255,0.14)";
      ctx.fill();
      if (on) {
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.font = `10px ${MONO}`;
      ctx.textAlign = "center";
      ctx.fillStyle = on ? ACCENT : INK_60;
      ctx.fillText(String(tr.n), x, y + 20);
      if (tr.tag) {
        ctx.font = `9px ${MONO}`;
        ctx.fillStyle = on ? ACCENT : INK_40;
        ctx.fillText(tr.tag, x, y - 14);
      }
    }

    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = INK_40;
    ctx.textAlign = "left";
    ctx.fillText("ADDRESS ONLY", x0, 16);
    ctx.textAlign = "right";
    ctx.fillText("FULL SPEND", x1, 16);
  };

  const assemblyLabel = `Assembly diagram: membership proof set to ${b.label}, alongside a separate ownership proof and amount proof, versus today's single entangled ring-signature blob.`;
  const ladderLabel = `Key hierarchy ladder, tier ${tier} of 6 selected: ${active.label}. Can ${active.can}.${active.cannot ? " Cannot " + active.cannot + "." : ""}${active.holder ? " Real-world holder: " + active.holder + "." : ""}`;

  return (
    <ProtoArtboard
      label="FUTURE · Seraphis"
      kicker="MONERO PROTOCOL · FUTURE · SERAPHIS · FORK V18 TARGET 2027"
      title='Seraphis — one blob becomes <em>three separable proofs</em>'
      sub="Today a single ring signature proves output membership, key ownership, and amount validity all at once. Seraphis pulls those into independent, swappable pieces — and re-wires the wallet with a six-tier key hierarchy instead of one master secret. BETA, audit in progress; ships after FCMP++ as fork v18."
      badges={[
        { label: "BETA · audit in progress", tone: "" },
        { label: "Fork v18 · 2027", tone: "" },
        { label: "Pairs with Jamtis", tone: "priv" },
        { label: "Ships after FCMP++", tone: "acc" },
      ]}
      right={<Provenance source="model" />}
      bg={bg}
      stage={
        <>
          <div style={{ position: "absolute", top: 0, right: 0, fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--ink-40)", letterSpacing: "0.18em" }}>
            FIG. SERAPHIS · MODULAR PROOFS · KEY LADDER
          </div>

          <div className="kicker" style={{ color: "var(--tk-accent)", marginBottom: 6 }}>ACT ONE · SEPARABLE PROOFS</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }} role="group" aria-label="Choose the membership-proof backend">
            {(Object.keys(BACKENDS) as Backend[]).map((k) => (
              <button key={k} type="button" className="proto-btn" aria-pressed={backend === k}
                style={{ opacity: backend === k ? 1 : 0.5, fontSize: "var(--fs-label)", padding: "5px 9px" }}
                onClick={() => setBackend(k)}>
                {backend === k ? "› " : ""}{BACKENDS[k].label}
              </button>
            ))}
          </div>
          <ProtoCanvas height={190} label={assemblyLabel} draw={drawAssembly} />
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <Stat k="SIGNATURE SIZE" v={b.sig} sub="vs today's CLSAG" tone="acc" />
            <Stat k="VERIFY TIME" v={b.verify} sub="batch verification" tone="g" />
            <Stat k="MEMBERSHIP BACKEND" v={backend === "fcmp" ? "FCMP++ slot" : "Grootle"} sub={backend === "fcmp" ? "unpaired, projected" : "beta default"} />
            <Stat k="OWNERSHIP + AMOUNT" v="untouched" sub="the swap stops at membership" tone="g" />
          </div>
          <div className="body" style={{ fontSize: "var(--fs-label)", marginTop: 6 }}>{b.note}</div>

          <div style={{ borderTop: "1px dashed var(--ink-10)", margin: "22px 0 14px" }} />

          <div className="kicker" style={{ color: "var(--tk-accent)", marginBottom: 6 }}>ACT TWO · KEY HIERARCHY</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }} role="group" aria-label="Select a wallet-key tier">
            {TIERS.map((tr) => (
              <button key={tr.n} type="button" className="proto-btn" aria-pressed={tier === tr.n}
                style={{ opacity: tier === tr.n ? 1 : 0.5, fontSize: "var(--fs-label)", padding: "5px 8px" }}
                onClick={() => setTier(tr.n)}>
                {tier === tr.n ? "› " : ""}{tr.n} · {tr.label}
              </button>
            ))}
          </div>
          <ProtoCanvas height={130} label={ladderLabel} draw={drawLadder} />
          <div className="proto-ctrl-row" style={{ marginTop: 8 }}>
            <span className="k">tier {active.n} · {active.key}</span>
            <span className="v acc">{active.label}</span>
          </div>
          <div className="body" style={{ fontSize: "var(--fs-body)" }}>
            Can {active.can}.{active.cannot ? ` Cannot ${active.cannot}.` : ""}
            {active.holder ? <> Real holder: <b style={{ color: "var(--tk-accent)" }}>{active.holder}</b>.</> : null}
          </div>
        </>
      }
      panel={
        <>
          <div>
            <h6>The metaphor</h6>
            <div className="lede">
              A <span style={{ color: "var(--tk-accent)" }}>modular engine</span>, not a single cast part. Today's ring signature is forged as one piece — pull on any thread and the whole proof unravels. Seraphis machines three separate parts that bolt onto the same transaction, and hands the wallet a keyring instead of one master key.
            </div>
          </div>

          <div className="body">
            Seraphis is a clean-room redesign of Monero's transaction structure by UkoeHB, currently <b>BETA</b> with its audit in progress. It targets hard fork v18 (2027) and ships after FCMP++ lands — the two are complementary upgrades, not competing ones.
          </div>

          <div>
            <h6>The narrative</h6>
            <ProtoStep n={1} done title="One blob, three jobs">
              Today's CLSAG ring signature proves output membership, key ownership, and amount validity as one entangled construction. Touch one property and you re-derive the whole thing.
            </ProtoStep>
            <ProtoStep n={2} done title="Split into three provable claims">
              Seraphis defines a <em>membership</em> proof, an <em>ownership</em> proof (a composition proof over the spend key and key image), and an <em>amount</em> proof (a Bulletproof+ range proof) — independent pieces assembled into one transaction.
            </ProtoStep>
            <ProtoStep n={3} on={backend === "fcmp"} done={backend !== "fcmp"} title="Swap the membership backend">
              Try the picker above. Seraphis's design goal is that the membership slot can take a different proof system later without re-deriving ownership or amount — the FCMP++ pairing shown is illustrative, not a specified integration.
            </ProtoStep>
            <ProtoStep n={4} on={tier > 1} done={tier === 1} title="Six keys instead of one">
              The wallet gets a graded hierarchy — generate-address, find-received, unlock-amounts, view-balance, prove-spend, master — so different software holds exactly the capability it needs. Try the tiers above.
            </ProtoStep>
            <ProtoStep n={5} title="Name the holders">
              An exchange's address server needs only tier 1 to mint deposit addresses. A payment processor needs tier 3 to confirm "paid" without seeing the whole balance. A hardware wallet is the one place tier 6 — spend authority — should live.
            </ProtoStep>
          </div>

          <div className="body" style={{ borderTop: "1px dashed var(--ink-10)", paddingTop: 12 }}>
            <em>Not finalized:</em> tier boundaries above track UkoeHB's published wallet-key-hierarchy spec, but Seraphis is pre-audit and the largest consensus change in Monero's history — names and numbers can still shift before v18.
          </div>
        </>
      }
    />
  );
}
