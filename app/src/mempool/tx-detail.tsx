// mempool/tx-detail.tsx — full-fidelity Monero transaction + block inspectors,
// driven by REAL node data (api/xmr.js → monerod get_transactions / get_block /
// get_outs). Every figure on screen comes from the node. Amounts are hidden by
// RingCT and are never a number.
//
// Confirmations come from the ONE accessor `confOf` (mempool/conf.ts), fed the
// REAL block height the node reports — so a txid copied into a public explorer
// matches the block height + confirmation count shown here.
//
// The synthesised path (former txSynthFromId/blockSynth) is gone: data fetching
// lives in mempool/live-detail.ts; this module renders it with explicit
// loading / error / placeholder states.

import * as React from "react";
import { Stat, NodeProvenance } from "@/design/primitives";
import { usePendingDelay } from "@/design/usePendingDelay";
import {
  useLiveTx,
  useLiveBlock,
  useLiveDecoys,
  detailPhase,
  type RealTxView,
  type RealBlockView,
} from "@/mempool/live-detail";
import type { MoneroLive } from "@/data/types";

/* ─── shared atoms ─────────────────────────────────────────────── */

function DKV({ k, v, mono = true, tone, copy, wrap }: any) {
  return (
    <div className={"dkv " + (tone || "")} style={{
      display: "grid", gridTemplateColumns: "180px 1fr",
      gap: "var(--sp-3)", padding: "var(--sp-2) 0",
      borderBottom: "1px dashed var(--ink-10)",
      alignItems: "baseline",
      ...(wrap ? { gridTemplateColumns: "180px 1fr auto" } : {}),
    }}>
      <div className="kicker" style={{ color: "var(--ink-40)" }}>{k}</div>
      <div className={mono ? "mono" : "serif"} style={{
        fontSize: mono ? "var(--fs-mono)" : "var(--fs-body)",
        color: tone === "acc" ? "var(--tk-accent)" : tone === "purple" ? "var(--p-50)" : tone === "cyan" ? "var(--c-50)" : tone === "dim" ? "var(--ink-60)" : "var(--ink-100)",
        wordBreak: "break-all",
        lineHeight: 1.55,
      }}>{v}</div>
      {copy ? (
        <button onClick={() => navigator.clipboard.writeText(copy)}
          style={{ appearance: "none", background: "transparent", border: "1px solid var(--ink-20)",
            color: "var(--ink-60)", padding: "3px var(--sp-2)", fontSize: "var(--fs-label)",
            fontFamily: "var(--f-mono)", letterSpacing: "0.1em",
            cursor: "pointer", borderRadius: 3 }}
          title={"Copy " + k}>COPY</button>
      ) : null}
    </div>
  );
}

function Section({ title, right, children, kicker }: any) {
  return (
    <section style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--sp-2)", gap: "var(--sp-4)", paddingBottom: "var(--sp-1)", borderBottom: "1px solid var(--rule)" }}>
        <div>
          {kicker ? <div className="kicker" style={{ marginBottom: "var(--sp-1)" }}>{kicker}</div> : null}
          <h3 className="serif" style={{ margin: 0, fontSize: 18, fontWeight: 400, color: "var(--ink-100)" }}>{title}</h3>
        </div>
        {right ? <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--ink-60)" }}>{right}</div> : null}
      </div>
      {children}
    </section>
  );
}

function PrivacyBadges() {
  return ["CLSAG", "BP+", "View Tags", "Stealth", "Dandelion++"].map((b) => (
    <span key={b} style={{
      padding: "var(--sp-1) var(--sp-2)", border: "1px solid var(--g-50)", color: "var(--g-50)",
      background: "color-mix(in srgb, var(--status-up) 6%, transparent)", borderRadius: 3,
      fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", letterSpacing: "0.1em", textTransform: "uppercase",
    }}>{b}</span>
  ));
}

const BackBtn = ({ onBack }: { onBack?: () => void }) => onBack ? (
  <button type="button" onClick={onBack}
    style={{ appearance: "none", cursor: "pointer", background: "transparent",
      border: "1px solid var(--ink-20)", color: "var(--ink-60)",
      padding: "var(--sp-1) var(--sp-3)", borderRadius: 3,
      fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", marginBottom: "var(--sp-4)" }}>← Back</button>
) : null;

const fmtKB = (b: number | null) => b == null ? "—" : (b / 1024).toFixed(2);
const fmtAge = (s: number | null) => s == null ? "—" : s < 60 ? s + "s" : Math.floor(s / 60) + "m " + (s % 60) + "s";

/* ─── stateful wrappers (loading / error / ready) ──────────────── */

export function LiveTxDetail({ txid, data, onBack }: {
  txid: string;
  data: MoneroLive;
  onBack?: () => void;
}) {
  const { status, tx } = useLiveTx(txid, data);
  // D0697 — gate the PENDING INDICATOR, never the data. A tx already in the
  // feed resolves from memory, so the row below renders and unmounts inside one
  // frame; that flicker reads as instability rather than as feedback. The txid
  // and the back button still render immediately, because they are known before
  // the lookup starts and hiding them would replace a 90ms spinner with a 90ms
  // hole. Declared before the early return so the hook order is unconditional.
  const showPending = usePendingDelay(status === "loading");
  if (status === "loading") {
    return (
      <div style={{ padding: "20px 28px 60px" }}>
        <BackBtn onBack={onBack} />
        <div className="kicker">Transaction</div>
        <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--c-50)", marginTop: "var(--sp-1)", wordBreak: "break-all" }}>{txid}</div>
        {showPending ? (
          <div className="mono dim" style={{ marginTop: "var(--sp-3)", fontSize: "var(--fs-mono)", display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
            <span className="led pulse" /> resolving from the node…
            <span style={{ color: "var(--ink-40)" }}>pending · awaiting first block</span>
          </div>
        ) : null}
      </div>
    );
  }
  if (status === "error" || !tx) {
    return (
      <div style={{ padding: "20px 28px 60px" }}>
        <BackBtn onBack={onBack} />
        <div className="kicker">Transaction</div>
        <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--c-50)", marginTop: "var(--sp-1)", wordBreak: "break-all" }}>{txid}</div>
        <div style={{ marginTop: "var(--sp-4)", padding: "var(--sp-4) var(--sp-4)", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--surface-raised)" }}>
          <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--tk-accent)", marginBottom: "var(--sp-1)" }}>Not returned by the node</div>
          <div className="mono dim" style={{ fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
            The node did not return this transaction. It may be too recent to have propagated, pruned,
            or the RPC relay is unreachable from this browser. No data is shown rather than invented values.
          </div>
        </div>
      </div>
    );
  }
  return <FullTxDetail tx={tx} data={data} txStatus={status} onBack={onBack} />;
}

export function LiveBlockDetail({ height, data, onBack, onPickTx }: {
  height: number;
  data: MoneroLive;
  onBack?: () => void;
  onPickTx?: (id: string, blockHeight: number) => void;
}) {
  const { status, block } = useLiveBlock(height, data);
  // D0697 — same shape as LiveTxDetail above: the height is known before the
  // lookup and renders at once; only the spinner waits out the threshold.
  const showPending = usePendingDelay(status === "loading");
  if (status === "loading") {
    return (
      <div style={{ padding: "20px 28px 60px" }}>
        <BackBtn onBack={onBack} />
        <div className="kicker">Block</div>
        <h2 className="serif acc" style={{ margin: "var(--sp-1) 0 0", fontSize: 36, fontWeight: 400, lineHeight: 1, color: "var(--tk-accent)" }}>#{height.toLocaleString()}</h2>
        {showPending ? (
          <div className="mono dim" style={{ marginTop: "var(--sp-3)", fontSize: "var(--fs-mono)", display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
            <span className="led pulse" /> resolving from the node…
          </div>
        ) : null}
      </div>
    );
  }
  if (status === "error" || !block) {
    return (
      <div style={{ padding: "20px 28px 60px" }}>
        <BackBtn onBack={onBack} />
        <div className="kicker">Block</div>
        <h2 className="serif acc" style={{ margin: "var(--sp-1) 0 0", fontSize: 36, fontWeight: 400, lineHeight: 1, color: "var(--tk-accent)" }}>#{height.toLocaleString()}</h2>
        <div style={{ marginTop: "var(--sp-4)", padding: "var(--sp-4) var(--sp-4)", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--surface-raised)" }}>
          <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--tk-accent)", marginBottom: "var(--sp-1)" }}>Not returned by the node</div>
          <div className="mono dim" style={{ fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
            The node did not return this block. The RPC relay may be unreachable from this browser.
            No data is shown rather than invented values.
          </div>
        </div>
      </div>
    );
  }
  return <FullBlockDetail block={block} blockStatus={status} onBack={onBack} onPickTx={onPickTx} />;
}

/* ─── FULL TX DETAIL ───────────────────────────────────────────── */

export function FullTxDetail({ tx, data, txStatus, onBack }: {
  tx: RealTxView;
  data: MoneroLive;
  txStatus: "loading" | "ready" | "error";
  onBack?: () => void;
}) {
  const [showJson, setShowJson] = React.useState(false);
  const [openIn, setOpenIn] = React.useState(0);
  const [wantDecoys, setWantDecoys] = React.useState(false);
  const decoys = useLiveDecoys(tx.id, wantDecoys);
  // D0697 — the ring-age resolve is an explicit user action, so unlike the two
  // skeletons above it always has a visible cause; the threshold only stops
  // "resolving…" strobing when the node answers immediately.
  const showDecoysPending = usePendingDelay(decoys.status === "loading");

  const remaining = Math.max(0, 10 - tx.confirmations);

  return (
    <div style={{ padding: "20px 28px 60px" }}>
      <BackBtn onBack={onBack} />

      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "var(--sp-5)", alignItems: "flex-start", paddingBottom: "var(--sp-4)", borderBottom: "1px solid var(--rule)" }}>
        <div>
          <div className="kicker">Transaction</div>
          <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--c-50)", marginTop: "var(--sp-1)", wordBreak: "break-all", lineHeight: 1.4 }}>{tx.id}</div>
          <div style={{ display: "flex", gap: "var(--sp-3)", marginTop: "var(--sp-2)", fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", color: "var(--ink-60)", flexWrap: "wrap" }}>
            <span>v{tx.version}</span>
            <span>·</span>
            <span>rct_type: <b style={{ color: "var(--p-50)" }}>{tx.rctType}</b> ({tx.rctTypeLabel})</span>
            <span>·</span>
            <span>{tx.inMempool ? "in mempool" : "in block " + tx.blockHeight!.toLocaleString()}</span>
            {tx.inMempool && tx.firstSeen ? <><span>·</span><span>seen {Math.max(0, Math.floor(Date.now() / 1000) - tx.firstSeen)}s ago</span></> : null}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "var(--sp-1)" }}>
          {tx.inMempool ? (
            <span className="pill warn"><span className="led pulse" />MEMPOOL</span>
          ) : tx.confirmations >= 10 ? (
            <span className="pill live"><span className="led pulse" />UNLOCKED</span>
          ) : (
            <span className="pill warn"><span className="led pulse" />CONFIRMING</span>
          )}
          <span className="mono dim" style={{ fontSize: "var(--fs-mono)" }}>{tx.confirmations}/10 confirmations</span>
        </div>
      </div>

      {/* KPI tiles (all real; size/fee null → "—") */}
      <Section title="Summary" kicker={<>Top-line <NodeProvenance source="node" bare phase={detailPhase(txStatus)} /></>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "var(--sp-2)" }}>
          <Stat k="Fee" v={tx.fee != null ? tx.fee.toFixed(7) : "—"} sub="XMR" tone="acc" />
          <Stat k="Fee rate" v={tx.feePerB != null ? tx.feePerB.toFixed(2) : "—"} sub="piconero / B" />
          <Stat k="Size" v={fmtKB(tx.sizeBytes)} sub="KB" />
          <Stat k="Ring size" v={tx.ringSize} sub="members" tone="p" />
          <Stat k="Inputs" v={tx.inputs.length || tx.outputs.length ? tx.inputs.length : "—"} sub={"× ring " + tx.ringSize} />
          <Stat k="Outputs" v={tx.outputs.length || "—"} sub="one-time" />
        </div>
      </Section>

      {/* Privacy strip — protocol facts, NO fabricated score */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", padding: "var(--sp-3) var(--sp-4)", marginTop: "var(--sp-4)", border: "1px solid var(--g-50)", background: "color-mix(in srgb, var(--status-up) 5%, transparent)", borderRadius: 4 }}>
        <span style={{ color: "var(--g-50)", fontSize: 22, lineHeight: 1 }}>✓</span>
        <div>
          <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--ink-100)" }}>
            Monero protocol privacy
            <span className="up" style={{ marginLeft: "var(--sp-2)", fontSize: "var(--fs-label)", letterSpacing: "0.12em" }}>ALWAYS-ON</span>
          </div>
          <div className="mono dim" style={{ fontSize: "var(--fs-mono)", marginTop: "var(--sp-1)", letterSpacing: "0.04em" }}>
            sender hidden (ring signature) · recipient hidden (stealth address) · amount hidden (RingCT)
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: "var(--sp-1)", flexWrap: "wrap" }}><PrivacyBadges /></div>
      </div>

      {/* Confirmation panel */}
      <Section title="Confirmation status" kicker="10-conf unlock"
        right={<NodeProvenance source="session" keys={["blocks"]} status={data.status} />}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--sp-3)" }}>
          <Stat k="of 10 confirmations" v={tx.confirmations} tone="acc" big />
          <Stat k="Blocks remaining" v={remaining} big />
          <Stat k="Per-block target" v="~2:00" big />
          <Stat k="Until full unlock" v={"~" + remaining * 2 + ":00"} big />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-1)", marginTop: "var(--sp-4)", marginBottom: "var(--sp-1)" }}>
          {Array.from({ length: 11 }).map((_, i) => {
            const reached = i <= tx.confirmations;
            return (
              <React.Fragment key={i}>
                {i > 0 ? <div style={{ flex: 1, height: 2, background: reached ? "var(--c-50)" : "var(--ink-10)", boxShadow: reached ? "0 0 4px var(--c-50)" : "none" }} /> : null}
                <div style={{ width: 12, height: 12, borderRadius: 6,
                  background: reached ? "var(--c-50)" : "transparent",
                  border: "1px solid " + (reached ? "var(--c-50)" : "var(--ink-20)"),
                  boxShadow: reached ? "0 0 4px var(--c-50)" : "none" }} />
              </React.Fragment>
            );
          })}
        </div>
        <div className="mono dim" style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-mono)", marginTop: "var(--sp-1)" }}>
          <span>{tx.inMempool ? "in mempool · pending · 0/10 · awaiting first block" : `${tx.confirmations} of 10 — ${remaining} more until unlock`}</span>
          <span>~2 min/block target · updated live</span>
        </div>
      </Section>

      {/* Mempool first-seen (real receive_time only; no fabricated peers/propagation) */}
      {tx.inMempool ? (
        <Section title="Mempool" kicker="Dandelion++ stem + fluff">
          <DKV k="First seen (this node)" v={tx.firstSeen ? new Date(tx.firstSeen * 1000).toISOString() : "—"} mono />
          <div className="mono dim" style={{ fontSize: "var(--fs-body)", marginTop: "var(--sp-2)", lineHeight: 1.55 }}>
            Origin IP is obscured by Dandelion++ (stem then fluff). Per-peer relay counts and propagation
            latency are not exposed by the node RPC and are not shown.
          </div>
        </Section>
      ) : null}

      {/* tx_extra — raw hex is real; parsed sub-fields are not decoded here */}
      <Section title="tx_extra" kicker="On-chain metadata" right={<span>{tx.extraSize} bytes</span>}>
        {tx.extraHex ? (
          <DKV k="raw_extra_hex"
            v={<code style={{ fontSize: "var(--fs-mono)", color: "var(--ink-60)", display: "block", padding: "var(--sp-2)", background: "var(--surface-sunk)", borderRadius: 3, wordBreak: "break-all", maxHeight: 80, overflow: "auto" }}>{tx.extraHex}</code>}
            copy={tx.extraHex} />
        ) : <DKV k="raw_extra_hex" v="(empty)" tone="dim" />}
        <div className="mono dim" style={{ fontSize: "var(--fs-body)", marginTop: "var(--sp-1)" }}>
          tx_pubkey / payment_id live inside this blob; they are not decoded client-side.
        </div>
      </Section>

      {/* Inputs */}
      <Section title={`Inputs · ${tx.inputs.length}`} kicker="Ring signatures (CLSAG)"
        right={<span>{tx.ringSize}-member ring · amount hidden</span>}>

        {tx.inputs.length > 1 ? (
          <div style={{ display: "flex", gap: "var(--sp-1)", marginBottom: "var(--sp-2)", flexWrap: "wrap" }}>
            {tx.inputs.map((_, i) => (
              <button key={i} onClick={() => setOpenIn(i)}
                style={{
                  appearance: "none", cursor: "pointer", padding: "var(--sp-1) var(--sp-2)",
                  background: openIn === i ? "color-mix(in srgb, var(--accent-structural) 10%, transparent)" : "transparent",
                  border: "1px solid " + (openIn === i ? "var(--tk-accent)" : "var(--ink-20)"),
                  color: openIn === i ? "var(--tk-accent)" : "var(--ink-60)",
                  borderRadius: 2, fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)",
                }}>Input #{i}</button>
            ))}
          </div>
        ) : null}

        {(() => {
          const inp = tx.inputs[openIn] || tx.inputs[0];
          if (!inp) return <div className="mono dim" style={{ fontSize: "var(--fs-mono)" }}>No inputs returned.</div>;
          const decoyInput = decoys.inputs?.find((d) => d.inputIdx === openIn);
          return (
            <div style={{ padding: "var(--sp-3) var(--sp-4)", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--surface-raised)" }}>
              <DKV k="key_image" v={inp.keyImage} tone="cyan" copy={inp.keyImage} />
              <DKV k="amount" v="HIDDEN (Pedersen commitment)" tone="dim" />
              <DKV k="ring members" v={`${inp.ringMembers} · one is the real spender, ${Math.max(0, inp.ringMembers - 1)} are decoys`} />
              <DKV k="key_offsets (relative)" v={inp.keyOffsets.length ? inp.keyOffsets.join(", ") : "—"} mono />

              {/* Real ring decoy ages (lazy — extra RPC via /api/xmr/decoys) */}
              <div style={{ marginTop: "var(--sp-3)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--sp-2)", gap: "var(--sp-3)" }}>
                  <div className="kicker">Ring decoys · real on-chain ages</div>
                  {!wantDecoys ? (
                    <button type="button" onClick={() => setWantDecoys(true)}
                      style={{ appearance: "none", cursor: "pointer", background: "transparent",
                        border: "1px solid var(--ink-20)", color: "var(--ink-60)", padding: "var(--sp-1) var(--sp-2)",
                        borderRadius: 3, fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)" }}>
                      ▶ Resolve ring ages (extra RPC)
                    </button>
                  ) : showDecoysPending ? (
                    <span className="mono dim" style={{ fontSize: "var(--fs-mono)" }}>resolving…</span>
                  ) : null}
                </div>

                {decoys.status === "error" ? (
                  <div className="mono dim" style={{ fontSize: "var(--fs-mono)" }}>decoy ages unavailable from the node</div>
                ) : decoyInput && decoyInput.ring.length ? (
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 90px 80px 70px", gap: "var(--sp-2)", fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)" }}>
                    <span className="kicker">#</span>
                    <span className="kicker">Block height</span>
                    <span className="kicker">Age (blocks)</span>
                    <span className="kicker">Age (days)</span>
                    <span className="kicker">Unlocked</span>
                    {decoyInput.ring.map((m) => (
                      <React.Fragment key={m.ringIdx}>
                        <span className="dim">{String(m.ringIdx).padStart(2, "0")}</span>
                        <span style={{ color: "var(--c-50)" }}>{m.blockHeight != null ? m.blockHeight.toLocaleString() : "—"}</span>
                        <span className="dim">{m.ageBlocks != null ? m.ageBlocks.toLocaleString() : "—"}</span>
                        <span className="dim">{m.ageDays != null ? m.ageDays + "d" : "—"}</span>
                        <span className="dim">{m.unlocked ? "yes" : "no"}</span>
                      </React.Fragment>
                    ))}
                  </div>
                ) : wantDecoys && decoys.status === "ready" ? (
                  <div className="mono dim" style={{ fontSize: "var(--fs-mono)" }}>no ring data for this input</div>
                ) : (
                  <div className="mono dim" style={{ fontSize: "var(--fs-body)" }}>
                    Ring-member ages resolve each decoy's on-chain output to its block height (one batched /get_outs call).
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Section>

      {/* Outputs */}
      <Section title={`Outputs · ${tx.outputs.length}`} kicker="Stealth addresses · one-time"
        right={<span>view tag · 1 byte · 256× scan</span>}>
        <div style={{ display: "grid", gap: "var(--sp-2)" }}>
          {tx.outputs.map((o, i) => (
            <div key={i} style={{ padding: "var(--sp-3) var(--sp-4)", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--surface-raised)" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--sp-1)" }}>
                <div className="kicker" style={{ color: "var(--p-50)" }}>Output #{i}</div>
              </div>
              <DKV k="stealth_address" v={o.stealthKey || "—"} tone="purple" copy={o.stealthKey || undefined} />
              <DKV k="view_tag" v={o.viewTag ? <><b style={{ color: "var(--tk-accent)" }}>0x{o.viewTag}</b> <span className="dim" style={{ marginLeft: "var(--sp-2)", fontSize: "var(--fs-mono)" }}>· 1 byte · scan acceleration</span></> : "—"} />
              <DKV k="amount" v="HIDDEN (Pedersen commitment)" tone="dim" />
            </div>
          ))}
          {!tx.outputs.length ? <div className="mono dim" style={{ fontSize: "var(--fs-mono)" }}>No outputs returned.</div> : null}
        </div>
      </Section>

      {/* Proof system — real per-tx fields from the node, plus concept cards
          explaining the proof components (the node RPC does not break out
          per-proof byte sizes, so none are shown). */}
      <Section title="Proof system" kicker="On-chain components">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "var(--sp-5)", marginBottom: "var(--sp-3)" }}>
          <DKV k="rct_type" v={tx.rctTypeLabel} tone="purple" />
          <DKV k="ring_size" v={tx.ringSize} />
          <DKV k="tx_version" v={"v" + tx.version} />
          <DKV k="inputs / outputs" v={tx.inputs.length + " / " + tx.outputs.length} />
          <DKV k="size" v={tx.sizeBytes != null ? tx.sizeBytes.toLocaleString() + " B" : "—"} />
          <DKV k="fee_rate" v={tx.feePerB != null ? tx.feePerB.toFixed(2) + " pcn/B" : "—"} />
          <DKV k="view_tags" v={tx.outputs[0]?.viewTag ? "✓ present" : "—"} tone={tx.outputs[0]?.viewTag ? "acc" : "dim"} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
          <div style={{ padding: "var(--sp-3) var(--sp-4)", border: "1px solid var(--rule)", borderRadius: 4 }}>
            <div className="kicker">CLSAG · ring signature</div>
            <p className="mono dim" style={{ margin: "var(--sp-2) 0 0", fontSize: "var(--fs-body)", lineHeight: 1.55 }}>
              Each of {tx.inputs.length} input{tx.inputs.length === 1 ? "" : "s"} proves "this is one of the {tx.ringSize} keys" without revealing which — the spender is hidden in the ring.
            </p>
          </div>
          <div style={{ padding: "var(--sp-3) var(--sp-4)", border: "1px solid var(--rule)", borderRadius: 4 }}>
            <div className="kicker">Bulletproofs+ · range proof</div>
            <p className="mono dim" style={{ margin: "var(--sp-2) 0 0", fontSize: "var(--fs-body)", lineHeight: 1.55 }}>
              Proves all {tx.outputs.length} output amounts are in range without revealing the values. Logarithmic verification.
            </p>
          </div>
        </div>
      </Section>

      {/* Block context (if mined) */}
      {!tx.inMempool && tx.blockHash ? (
        <Section title={`Block · #${tx.blockHeight!.toLocaleString()}`} kicker="Inclusion context">
          <DKV k="block_hash" v={tx.blockHash} tone="cyan" copy={tx.blockHash} />
          <DKV k="block age" v={fmtAge(tx.ageSeconds)} />
          <DKV k="unlock_time" v={tx.unlockTime === 0 ? "0 (spendable at 10 confs)" : String(tx.unlockTime)} />
        </Section>
      ) : (
        <Section title="Lock" kicker="Spendability">
          <DKV k="unlock_time" v={tx.unlockTime === 0 ? "0 (default)" : String(tx.unlockTime)} />
        </Section>
      )}

      {/* Raw RPC JSON toggle — dumps the REAL mapped object */}
      <Section title="Raw RPC" kicker="monerod · get_transactions">
        <button type="button" onClick={() => setShowJson((s) => !s)}
          style={{ appearance: "none", cursor: "pointer", background: "transparent",
            border: "1px solid var(--ink-20)", color: "var(--ink-60)",
            padding: "var(--sp-1) var(--sp-3)", borderRadius: 3,
            fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {showJson ? "▼ Hide JSON" : "▶ Show JSON"}
        </button>
        {showJson ? (
          <pre style={{ marginTop: "var(--sp-2)", padding: "var(--sp-3)", background: "var(--surface-sunk)", border: "1px solid var(--rule)", borderRadius: 3, color: "var(--c-50)", fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", lineHeight: 1.5, overflow: "auto", maxHeight: 440 }}>
{JSON.stringify(tx, null, 2)}
          </pre>
        ) : null}
        <DKV k="rpc call" v={<code style={{ color: "var(--ink-80)" }}>{`POST /get_transactions { "txs_hashes": ["${tx.id}"], "decode_as_json": true }`}</code>} />
      </Section>
    </div>
  );
}

/* ─── FULL BLOCK DETAIL ────────────────────────────────────────── */

const BLOCK_TX_RENDER_CAP = 50;

export function FullBlockDetail({ block, blockStatus, onBack, onPickTx }: {
  block: RealBlockView;
  blockStatus: "loading" | "ready" | "error";
  onBack?: () => void;
  onPickTx?: (id: string, blockHeight: number) => void;
}) {
  const [showJson, setShowJson] = React.useState(false);

  // Coinbase first, then real non-coinbase hashes (render-capped for performance).
  const rows: { id: string; coinbase: boolean }[] = [
    { id: block.coinbaseTxHash, coinbase: true },
    ...block.txHashes.map((id) => ({ id, coinbase: false })),
  ];
  const shown = rows.slice(0, BLOCK_TX_RENDER_CAP);
  const remaining = Math.max(0, rows.length - shown.length);

  return (
    <div style={{ padding: "20px 28px 60px" }}>
      <BackBtn onBack={onBack} />

      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "var(--sp-5)", alignItems: "flex-start", paddingBottom: "var(--sp-4)", borderBottom: "1px solid var(--rule)" }}>
        <div>
          <div className="kicker">Block</div>
          <h2 className="serif acc" style={{ margin: "var(--sp-1) 0 0", fontSize: 36, fontWeight: 400, lineHeight: 1, color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>#{block.height.toLocaleString()}</h2>
          <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--c-50)", marginTop: "var(--sp-2)", wordBreak: "break-all" }}>{block.hash}</div>
          <div className="mono dim" style={{ fontSize: "var(--fs-mono)", marginTop: "var(--sp-2)" }}>
            Mined by <b style={{ color: "var(--ink-100)" }}>{block.pool}</b> · {block.timestampIso} · {fmtAge(block.ageSeconds)} ago
          </div>
        </div>
        <span className="pill live"><span className="led pulse" />{block.confirmations} confirmations</span>
      </div>

      {/* KPI tiles */}
      <Section title="Block summary" kicker={<>At a glance <NodeProvenance source="node" bare phase={detailPhase(blockStatus)} /></>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "var(--sp-2)" }}>
          <Stat k="Transactions" v={block.txCount} tone="acc" />
          <Stat k="Weight" v={(block.weightBytes / 1024).toFixed(1)} sub="KB" />
          <Stat k="Fullness" v={block.fullnessPct != null ? block.fullnessPct + "%" : "—"} sub={"vs " + (block.weightLimit / 1024).toFixed(0) + "KB limit"} />
          <Stat k="Reward" v={block.reward != null ? block.reward.toFixed(4) : "—"} sub="XMR" />
          <Stat k="Difficulty" v={(block.difficulty / 1e9).toFixed(2)} sub="G" />
          <Stat k="Long-term wt" v={(block.longTermWeight / 1024).toFixed(1)} sub="KB" />
        </div>
      </Section>

      {/* Mining */}
      <Section title="Mining" kicker="RandomX · proof of work">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
          <div style={{ padding: "var(--sp-3) var(--sp-4)", border: "1px solid var(--rule)", borderRadius: 4 }}>
            <DKV k="pool" v={block.pool} tone="acc" />
            <DKV k="miner_tx_hash" v={block.minerTxHash} tone="cyan" copy={block.minerTxHash} />
            <DKV k="reward" v={block.reward != null ? block.reward.toFixed(7) + " XMR" : "—"} tone="acc" />
          </div>
          <div style={{ padding: "var(--sp-3) var(--sp-4)", border: "1px solid var(--rule)", borderRadius: 4 }}>
            <DKV k="difficulty" v={(block.difficulty / 1e9).toFixed(2) + "G"} />
            <DKV k="nonce" v={block.nonce.toLocaleString()} />
            <DKV k="hardfork" v={block.hardforkLabel} tone="acc" />
          </div>
        </div>
      </Section>

      {/* Block header */}
      <Section title="Block header" kicker="Chain linkage">
        <DKV k="height" v={block.height.toLocaleString()} tone="acc" />
        <DKV k="hash" v={block.hash} tone="cyan" copy={block.hash} />
        <DKV k="prev_hash" v={block.prevHash} tone="cyan" copy={block.prevHash} />
        <DKV k="major_version / minor_version" v={`${block.majorVersion} / ${block.minorVersion}`} />
        <DKV k="timestamp" v={block.timestamp + " · " + block.timestampIso} />
        <DKV k="weight" v={(block.weightBytes / 1024).toFixed(1) + " KB"} />
      </Section>

      {/* TX list — REAL coinbase + tx_hashes */}
      <Section title={`Transactions · ${block.txCount}`} kicker="Included in this block"
        right={<span>showing {shown.length}{remaining ? " · " + remaining + " more" : ""}</span>}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-1)" }}>
          {shown.map((row, i) => (
            // Thread the REAL block height so the tx pins to THIS block (no hash hop).
            <button key={row.id + i} onClick={() => onPickTx?.(row.id, block.height)}
              style={{ appearance: "none", cursor: "pointer", textAlign: "left",
                display: "grid", gridTemplateColumns: "64px 1fr auto", gap: "var(--sp-3)", alignItems: "center",
                padding: "var(--sp-2) var(--sp-3)", background: "transparent",
                border: "1px solid " + (row.coinbase ? "var(--tk-accent)" : "var(--ink-10)"), borderRadius: 3,
                color: "var(--ink-100)", fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)",
                transition: "background var(--d-2) var(--e-standard)", // D0651: 0.12s → --d-2 (nearest)
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "color-mix(in srgb, var(--accent-structural) 5%, transparent)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <span className={row.coinbase ? "acc" : "dim"} style={{ fontSize: "var(--fs-label)" }}>{row.coinbase ? "COINBASE" : String(i).padStart(2, "0")}</span>
              <span style={{ color: "var(--c-50)", wordBreak: "break-all" }}>{row.id}</span>
              <span className="dim">↗</span>
            </button>
          ))}
          {remaining ? (
            <div className="mono dim" style={{ padding: "var(--sp-2) var(--sp-3)", fontSize: "var(--fs-mono)", fontStyle: "italic" }}>
              + {remaining} more txs in this block (truncated for display)
            </div>
          ) : null}
        </div>
      </Section>

      {/* Raw JSON */}
      <Section title="Raw RPC" kicker="monerod · get_block">
        <button type="button" onClick={() => setShowJson((s) => !s)}
          style={{ appearance: "none", cursor: "pointer", background: "transparent",
            border: "1px solid var(--ink-20)", color: "var(--ink-60)",
            padding: "var(--sp-1) var(--sp-3)", borderRadius: 3,
            fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {showJson ? "▼ Hide JSON" : "▶ Show JSON"}
        </button>
        {showJson ? (
          <pre style={{ marginTop: "var(--sp-2)", padding: "var(--sp-3)", background: "var(--surface-sunk)", border: "1px solid var(--rule)", borderRadius: 3, color: "var(--c-50)", fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", lineHeight: 1.5, overflow: "auto", maxHeight: 440 }}>
{JSON.stringify(block, null, 2)}
          </pre>
        ) : null}
        <DKV k="rpc call" v={<code style={{ color: "var(--ink-80)" }}>{`POST /get_block { "height": ${block.height} }`}</code>} />
      </Section>
    </div>
  );
}
