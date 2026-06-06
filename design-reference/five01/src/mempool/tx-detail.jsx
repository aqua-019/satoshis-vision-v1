// tx-detail.jsx — full-fidelity Monero transaction + block inspectors.
//
// Exports to window: FullTxDetail, FullBlockDetail, txSynthFromId, blockSynth.
//
// Schema mirrors monerod RPC `get_transactions`, `get_block`, `get_block_header`.
// All "live" fields are deterministic-from-txid so the panel reads consistently
// across re-renders; replace synth helpers with real RPC results when wiring
// up the node feed (see DATA.md).

/* ─── deterministic synth helpers ──────────────────────────────── */

function _hash32(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h;
}
function _seedRng(seed) {
  let s = seed || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}
function _hex(len, rng) { let o = ""; for (let i = 0; i < len; i++) o += "0123456789abcdef"[(rng() * 16) | 0]; return o; }

// Build a complete TX object from a 64-char id. Idempotent.
function txSynthFromId(txid, data) {
  const h = _hash32(txid);
  const rng = _seedRng(h);
  const inMempool = (h & 7) === 0;
  const blockIdx = inMempool ? -1 : (h % Math.min(data.blocks.length, 9));
  const block = blockIdx >= 0 ? data.blocks[blockIdx] : null;
  const conf = block ? block.conf : 0;

  const inputs = 1 + ((h >> 3) & 3); // 1..4
  const outputs = 2 + ((h >> 5) & 1); // 2 or 3 (2 is typical)
  const sizeBytes = 1400 + Math.floor(rng() * 2200);
  const fee = +(0.000005 + rng() * 0.000095).toFixed(7);
  const perB = +(fee / sizeBytes * 1e12).toFixed(2);
  const weight = sizeBytes + Math.floor(rng() * 100);

  return {
    id: txid,
    version: 2,
    rct_type: 6,                      // 6 = CLSAG + BP+
    rct_type_label: "CLSAG + BP+",
    unlock_time: 0,
    extra_size: 33 + (h & 7),
    extra_hex: "01" + _hex(64, rng) + ((h & 1) ? "02090103" + _hex(14, rng) : ""),
    extra_pubkey: _hex(64, rng),
    extra_payment_id: (h & 1) ? _hex(16, rng) : null,
    extra_additional_pubkeys: outputs > 2 ? Array.from({ length: outputs - 1 }, () => _hex(64, rng)) : [],
    size_bytes: sizeBytes,
    weight,
    fee,
    fee_pcn_per_b: perB,
    ring_size: 16,
    n_inputs: inputs,
    n_outputs: outputs,
    block_height: block ? block.height : null,
    block_hash: block ? block.hash : null,
    block_age_s: block ? block.age : Math.floor(rng() * 110),
    confirmations: conf,
    age_seconds: block ? block.age : Math.floor(rng() * 110),
    in_mempool: inMempool,

    // Mempool-only fields
    relayed_to_n_peers: inMempool ? 8 + Math.floor(rng() * 14) : null,
    propagation_ms: inMempool ? 120 + Math.floor(rng() * 880) : null,
    first_seen_iso: inMempool ? new Date(Date.now() - Math.floor(rng() * 110_000)).toISOString() : null,

    privacy_score: 92 + Math.floor(rng() * 8), // 92..99
    inputs_detail: Array.from({ length: inputs }, () => {
      const offs = [];
      const baseHeight = (block?.height ?? data.height) - Math.floor(rng() * 1000);
      let cursor = baseHeight - Math.floor(rng() * 800000);
      for (let i = 0; i < 16; i++) {
        cursor += 1 + Math.floor(Math.pow(rng(), 3) * 240000);
        offs.push({
          out_index: cursor,
          age_blocks: (block?.height ?? data.height) - cursor,
          age_days: +(((block?.height ?? data.height) - cursor) * 120 / 86400).toFixed(1),
        });
      }
      return {
        key_image: _hex(64, rng),
        ring_offsets: offs,                  // 16 offsets
        amount_hidden: true,                 // RingCT
        pseudo_output_commitment: _hex(64, rng),
        ringct_clsag_size: 1540 + Math.floor(rng() * 60),
      };
    }),
    outputs_detail: Array.from({ length: outputs }, (_, i) => ({
      stealth_address: _hex(64, rng),
      output_pubkey: _hex(64, rng),
      view_tag: _hex(2, rng),
      amount_hidden: true,
      amount_commitment: _hex(64, rng),
      output_index_global: (block?.height ?? data.height) * 80 + i,
    })),

    proofs: {
      clsag_signature: { size_bytes: inputs * 1540 + 32, layers: 16 },
      bulletproofs_plus: { size_bytes: outputs * 96 + 576, range_proof_bits: 64 },
    },

    rpc_endpoints: {
      get_transactions: `POST /get_transactions { "txs_hashes": ["${txid}"], "decode_as_json": true }`,
      get_transaction_pool_hashes_bin: inMempool ? "POST /get_transaction_pool_hashes.bin" : null,
    },
  };
}

// Build a richer Block object from a base block.
function blockSynth(block, data) {
  const h = _hash32(block.hash || String(block.height));
  const rng = _seedRng(h);

  const prevBlock = data.blocks.find((b) => b.height === block.height - 1);
  const minorVersion = 16;
  const majorVersion = 16;
  const median_block_size = 300 + Math.floor(rng() * 500); // KB
  const txCount = block.txs;
  const totalFees = +(txCount * (0.000005 + rng() * 0.00007)).toFixed(7);

  return {
    ...block,
    prev_hash: prevBlock?.hash || _hex(64, rng),
    merkle_root: _hex(64, rng),
    nonce: Math.floor(rng() * 0xffffffff),
    timestamp: Math.floor(Date.now() / 1000) - block.age,
    timestamp_iso: new Date((Date.now() - block.age * 1000)).toISOString(),
    major_version: majorVersion,
    minor_version: minorVersion,
    hardfork_label: "v16 · CLSAG + BP+",
    randomx_seed_hash: _hex(64, rng),
    randomx_seed_height: Math.floor(block.height / 2048) * 2048,
    cumulative_difficulty: (block.difficulty * (block.height - 1000) + rng() * 1e12).toFixed(0),
    long_term_weight: Math.floor(block.sizeKB * 1024 * 1.1),
    weight_bytes: Math.floor(block.sizeKB * 1024),
    median_block_size_kb: median_block_size,
    fullness_pct: +Math.min(100, (block.sizeKB / median_block_size) * 100).toFixed(1),
    total_fees: totalFees,
    miner_tx_hash: _hex(64, rng),
    miner_address_short: _hex(8, rng) + "…" + _hex(6, rng),
    coinbase_reward: block.reward,
    txs_in_block: Array.from({ length: Math.min(txCount, 24) }, () => _hex(64, rng)),
    txs_remaining: Math.max(0, txCount - 24),

    rpc_endpoints: {
      get_block: `POST /get_block { "height": ${block.height} }`,
      get_block_header_by_height: `POST /get_block_header_by_height { "height": ${block.height} }`,
    },
  };
}

window.txSynthFromId = txSynthFromId;
window.blockSynth = blockSynth;

/* ─── shared atoms ─────────────────────────────────────────────── */

function DKV({ k, v, mono = true, tone, copy, wrap }) {
  return (
    <div className={"dkv " + (tone || "")} style={{
      display: "grid", gridTemplateColumns: "180px 1fr",
      gap: 12, padding: "8px 0",
      borderBottom: "1px dashed var(--ink-10)",
      alignItems: "baseline",
      ...(wrap ? { gridTemplateColumns: "180px 1fr auto" } : {}),
    }}>
      <div className="kicker" style={{ color: "var(--ink-40)" }}>{k}</div>
      <div className={mono ? "mono" : "serif"} style={{
        fontSize: mono ? 12 : 13,
        color: tone === "acc" ? "var(--tk-accent)" : tone === "purple" ? "var(--p-50)" : tone === "cyan" ? "var(--c-50)" : tone === "dim" ? "var(--ink-60)" : "var(--ink-100)",
        wordBreak: "break-all",
        lineHeight: 1.55,
      }}>{v}</div>
      {copy ? (
        <button onClick={() => navigator.clipboard.writeText(copy)}
          style={{ appearance: "none", background: "transparent", border: "1px solid var(--ink-20)",
            color: "var(--ink-60)", padding: "3px 8px", fontSize: 9.5,
            fontFamily: "var(--f-mono)", letterSpacing: "0.1em",
            cursor: "pointer", borderRadius: 3 }}
          title={"Copy " + k}>COPY</button>
      ) : null}
    </div>
  );
}

function Section({ title, right, children, kicker }) {
  return (
    <section style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8, gap: 16, paddingBottom: 6, borderBottom: "1px solid var(--rule)" }}>
        <div>
          {kicker ? <div className="kicker" style={{ marginBottom: 4 }}>{kicker}</div> : null}
          <h3 className="serif" style={{ margin: 0, fontSize: 18, fontWeight: 400, color: "var(--ink-100)" }}>{title}</h3>
        </div>
        {right ? <div className="mono" style={{ fontSize: 11, color: "var(--ink-60)" }}>{right}</div> : null}
      </div>
      {children}
    </section>
  );
}

function PrivacyBadges() {
  return ["CLSAG", "BP+", "View Tags", "Stealth", "Dandelion++"].map((b) => (
    <span key={b} style={{
      padding: "4px 10px", border: "1px solid var(--g-50)", color: "var(--g-50)",
      background: "rgba(74,222,128,0.06)", borderRadius: 3,
      fontFamily: "var(--f-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
    }}>{b}</span>
  ));
}

/* ─── FULL TX DETAIL ───────────────────────────────────────────── */

function FullTxDetail({ tx, onBack }) {
  const [showJson, setShowJson] = React.useState(false);
  const [openIn, setOpenIn] = React.useState(0);

  // Decoy age distribution for the histogram (collapse all inputs)
  const allAges = tx.inputs_detail.flatMap((i) => i.ring_offsets.map((o) => o.age_days));
  const maxAge = Math.max(...allAges, 1);

  return (
    <div style={{ padding: "20px 28px 60px" }}>
      {onBack ? (
        <button type="button" onClick={onBack}
          style={{ appearance: "none", cursor: "pointer", background: "transparent",
            border: "1px solid var(--ink-20)", color: "var(--ink-60)",
            padding: "5px 12px", borderRadius: 3,
            fontFamily: "var(--f-mono)", fontSize: 11, marginBottom: 18 }}>← Back</button>
      ) : null}

      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "flex-start", paddingBottom: 18, borderBottom: "1px solid var(--rule)" }}>
        <div>
          <div className="kicker">Transaction</div>
          <div className="mono" style={{ fontSize: 13.5, color: "var(--c-50)", marginTop: 6, wordBreak: "break-all", lineHeight: 1.4 }}>{tx.id}</div>
          <div style={{ display: "flex", gap: 14, marginTop: 10, fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--ink-60)", flexWrap: "wrap" }}>
            <span>v{tx.version}</span>
            <span>·</span>
            <span>rct_type: <b style={{ color: "var(--p-50)" }}>{tx.rct_type}</b> ({tx.rct_type_label})</span>
            <span>·</span>
            <span>{tx.in_mempool ? "in mempool" : "in block " + tx.block_height.toLocaleString()}</span>
            {tx.in_mempool ? <><span>·</span><span>seen {Math.floor((Date.now() - new Date(tx.first_seen_iso)) / 1000)}s ago</span></> : null}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          {tx.in_mempool ? (
            <span className="pill warn"><span className="led pulse" />MEMPOOL</span>
          ) : tx.confirmations >= 10 ? (
            <span className="pill live"><span className="led pulse" />UNLOCKED</span>
          ) : (
            <span className="pill warn"><span className="led pulse" />CONFIRMING</span>
          )}
          <span className="mono dim" style={{ fontSize: 10.5 }}>{tx.confirmations}/10 confirmations</span>
        </div>
      </div>

      {/* Six KPI tiles */}
      <Section title="Summary" kicker="Top-line">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
          <Stat k="Fee" v={tx.fee.toFixed(7)} sub="XMR" tone="acc" />
          <Stat k="Fee rate" v={tx.fee_pcn_per_b.toFixed(2)} sub="piconero / B" />
          <Stat k="Size" v={(tx.size_bytes / 1024).toFixed(2)} sub="KB" />
          <Stat k="Weight" v={(tx.weight / 1024).toFixed(2)} sub="KB" />
          <Stat k="Inputs" v={tx.n_inputs} sub="× ring 16" />
          <Stat k="Outputs" v={tx.n_outputs} sub="one-time" />
        </div>
      </Section>

      {/* Privacy strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", marginTop: 18, border: "1px solid var(--g-50)", background: "rgba(74,222,128,0.05)", borderRadius: 4 }}>
        <span style={{ color: "var(--g-50)", fontSize: 22, lineHeight: 1 }}>✓</span>
        <div>
          <div className="mono" style={{ fontSize: 12, color: "var(--ink-100)" }}>
            Privacy <b className="up" style={{ fontSize: 16, marginLeft: 6 }}>{tx.privacy_score}/100</b>
            <span className="up" style={{ marginLeft: 8, fontSize: 10.5, letterSpacing: "0.12em" }}>STRONG</span>
          </div>
          <div className="mono dim" style={{ fontSize: 10.5, marginTop: 4, letterSpacing: "0.04em" }}>
            All primitives engaged · sender hidden · recipient hidden · amount hidden
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><PrivacyBadges /></div>
      </div>

      {/* Confirmation panel */}
      <Section title="Confirmation status" kicker="10-conf unlock"
        right={<span><span className="led pulse" style={{ background: "var(--g-50)", boxShadow: "0 0 6px var(--g-50)" }} />LIVE</span>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <Stat k="of 10 confirmations" v={tx.confirmations} tone="acc" big />
          <Stat k="Blocks remaining" v={Math.max(0, 10 - tx.confirmations)} big />
          <Stat k="Until next conf" v={"~" + (tx.in_mempool ? "2:00" : "1:42")} big />
          <Stat k="Until full unlock" v={"~" + Math.max(0, 10 - tx.confirmations) * 2 + ":00"} big />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 18, marginBottom: 6 }}>
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
        <div className="mono dim" style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, marginTop: 6 }}>
          <span>{tx.confirmations} of 10 — {Math.max(0, 10 - tx.confirmations)} more until unlock</span>
          <span>updated just now</span>
        </div>
      </Section>

      {/* Mempool propagation (if mempool) */}
      {tx.in_mempool ? (
        <Section title="Mempool propagation" kicker="Dandelion++ stem + fluff">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <Stat k="Relayed to" v={tx.relayed_to_n_peers + " peers"} tone="acc" />
            <Stat k="First-seen latency" v={tx.propagation_ms + " ms"} />
            <Stat k="Origin obscurity" v="hidden" sub="Dandelion++" tone="p" />
          </div>
          <DKV k="First seen (this node)" v={tx.first_seen_iso} mono />
        </Section>
      ) : null}

      {/* Extra field */}
      <Section title="tx_extra" kicker="On-chain metadata" right={<span>{tx.extra_size} bytes</span>}>
        <DKV k="tx_pubkey" v={tx.extra_pubkey} tone="cyan" copy={tx.extra_pubkey} />
        {tx.extra_additional_pubkeys.length ? (
          <DKV k={`additional_pubkeys [${tx.extra_additional_pubkeys.length}]`}
            v={tx.extra_additional_pubkeys.map((k, i) => <div key={i} style={{ marginBottom: 4 }}>{i}: {k}</div>)} />
        ) : null}
        {tx.extra_payment_id ? (
          <DKV k="encrypted_payment_id" v={tx.extra_payment_id} tone="purple" copy={tx.extra_payment_id} />
        ) : <DKV k="payment_id" v="(none — modern wallet)" tone="dim" />}
        <DKV k="raw_extra_hex"
          v={<code style={{ fontSize: 10.5, color: "var(--ink-60)", display: "block", padding: 10, background: "rgba(0,0,0,0.4)", borderRadius: 3, wordBreak: "break-all", maxHeight: 80, overflow: "auto" }}>{tx.extra_hex}</code>}
          copy={tx.extra_hex} />
      </Section>

      {/* Inputs */}
      <Section title={`Inputs · ${tx.n_inputs}`} kicker="Ring signatures (CLSAG)"
        right={<span>{tx.ring_size}-member ring · amount hidden</span>}>

        {/* Input switcher tabs */}
        {tx.inputs_detail.length > 1 ? (
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {tx.inputs_detail.map((_, i) => (
              <button key={i} onClick={() => setOpenIn(i)}
                style={{
                  appearance: "none", cursor: "pointer", padding: "5px 10px",
                  background: openIn === i ? "rgba(255,122,26,0.1)" : "transparent",
                  border: "1px solid " + (openIn === i ? "var(--tk-accent)" : "var(--ink-20)"),
                  color: openIn === i ? "var(--tk-accent)" : "var(--ink-60)",
                  borderRadius: 2, fontFamily: "var(--f-mono)", fontSize: 11,
                }}>Input #{i}</button>
            ))}
          </div>
        ) : null}

        {(() => {
          const inp = tx.inputs_detail[openIn] || tx.inputs_detail[0];
          return (
            <div style={{ padding: "12px 16px", border: "1px solid var(--rule)", borderRadius: 4, background: "rgba(0,0,0,0.25)" }}>
              <DKV k="key_image" v={inp.key_image} tone="cyan" copy={inp.key_image} />
              <DKV k="pseudo_output_commitment" v={inp.pseudo_output_commitment} tone="cyan" copy={inp.pseudo_output_commitment} />
              <DKV k="amount" v="HIDDEN (Pedersen commitment)" tone="dim" />
              <DKV k="clsag_signature size" v={inp.ringct_clsag_size + " bytes"} />
              <DKV k="ring members" v={`${inp.ring_offsets.length} · one is the real spender, 15 are decoys`} />

              {/* Ring decoy age list */}
              <div style={{ marginTop: 14 }}>
                <div className="kicker" style={{ marginBottom: 8 }}>Ring decoys · output indexes &amp; ages</div>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 90px 80px", gap: 8, fontFamily: "var(--f-mono)", fontSize: 11 }}>
                  <span className="kicker">#</span>
                  <span className="kicker">Global output index</span>
                  <span className="kicker">Age (blocks)</span>
                  <span className="kicker">Age (days)</span>
                  {inp.ring_offsets.map((o, i) => (
                    <React.Fragment key={i}>
                      <span className="dim">{String(i).padStart(2, "0")}</span>
                      <span style={{ color: "var(--c-50)" }}>{o.out_index.toLocaleString()}</span>
                      <span className="dim">{o.age_blocks.toLocaleString()}</span>
                      <span className="dim">{o.age_days}d</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Decoy age distribution histogram across ALL inputs */}
        <div style={{ marginTop: 16, padding: "12px 16px", border: "1px solid var(--rule)", borderRadius: 4, background: "rgba(0,0,0,0.2)" }}>
          <div className="kicker" style={{ marginBottom: 8 }}>Decoy age distribution · all inputs · log-normal expected</div>
          <svg width="100%" height="64" viewBox="0 0 600 64" preserveAspectRatio="none">
            {(() => {
              const bins = 30;
              const hist = new Array(bins).fill(0);
              for (const a of allAges) {
                const bin = Math.min(bins - 1, Math.floor((a / maxAge) * bins));
                hist[bin]++;
              }
              const maxBin = Math.max(...hist, 1);
              const w = 600 / bins;
              return hist.map((c, i) => {
                const h = (c / maxBin) * 56;
                return <rect key={i} x={i * w + 1} y={62 - h} width={w - 2} height={h}
                  fill="var(--tk-accent)" opacity={0.4 + (c / maxBin) * 0.6} />;
              });
            })()}
          </svg>
          <div className="mono dim" style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, marginTop: 4 }}>
            <span>recent</span>
            <span>{maxAge.toFixed(0)} days back ⟶</span>
          </div>
        </div>
      </Section>

      {/* Outputs */}
      <Section title={`Outputs · ${tx.n_outputs}`} kicker="Stealth addresses · one-time"
        right={<span>view tag · 1 byte · 256× scan</span>}>
        <div style={{ display: "grid", gap: 10 }}>
          {tx.outputs_detail.map((o, i) => (
            <div key={i} style={{ padding: "12px 16px", border: "1px solid var(--rule)", borderRadius: 4, background: "rgba(0,0,0,0.25)" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                <div className="kicker" style={{ color: "var(--p-50)" }}>Output #{i}</div>
                <div className="mono dim" style={{ fontSize: 10.5 }}>global index #{o.output_index_global.toLocaleString()}</div>
              </div>
              <DKV k="stealth_address" v={o.stealth_address} tone="purple" copy={o.stealth_address} />
              <DKV k="output_pubkey" v={o.output_pubkey} tone="cyan" copy={o.output_pubkey} />
              <DKV k="amount_commitment" v={o.amount_commitment} tone="cyan" copy={o.amount_commitment} />
              <DKV k="view_tag" v={<><b style={{ color: "var(--tk-accent)" }}>0x{o.view_tag}</b> <span className="dim" style={{ marginLeft: 8, fontSize: 11 }}>· 1 byte · scan acceleration</span></>} />
              <DKV k="amount" v="HIDDEN (Pedersen commitment)" tone="dim" />
            </div>
          ))}
        </div>
      </Section>

      {/* Proofs */}
      <Section title="Cryptographic proofs" kicker="Verified on-chain">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ padding: "12px 16px", border: "1px solid var(--rule)", borderRadius: 4 }}>
            <div className="kicker">CLSAG · ring signature</div>
            <div className="mono" style={{ fontSize: 22, color: "var(--tk-accent)", marginTop: 6 }}>{tx.proofs.clsag_signature.size_bytes.toLocaleString()} <span className="dim" style={{ fontSize: 10.5 }}>bytes</span></div>
            <p className="mono dim" style={{ margin: "8px 0 0", fontSize: 11, lineHeight: 1.55 }}>
              Each of {tx.n_inputs} input{tx.n_inputs > 1 ? "s" : ""} proves "this is one of the {tx.ring_size} keys" without saying which. {tx.proofs.clsag_signature.layers}-layer signature.
            </p>
          </div>
          <div style={{ padding: "12px 16px", border: "1px solid var(--rule)", borderRadius: 4 }}>
            <div className="kicker">Bulletproofs+ · range proof</div>
            <div className="mono" style={{ fontSize: 22, color: "var(--p-50)", marginTop: 6 }}>{tx.proofs.bulletproofs_plus.size_bytes.toLocaleString()} <span className="dim" style={{ fontSize: 10.5 }}>bytes</span></div>
            <p className="mono dim" style={{ margin: "8px 0 0", fontSize: 11, lineHeight: 1.55 }}>
              Proves all {tx.n_outputs} amounts are in [0, 2<sup>{tx.proofs.bulletproofs_plus.range_proof_bits}</sup>) without revealing values. Logarithmic verification.
            </p>
          </div>
        </div>
      </Section>

      {/* Block context (if mined) */}
      {!tx.in_mempool && tx.block_hash ? (
        <Section title={`Block · #${tx.block_height.toLocaleString()}`} kicker="Inclusion context">
          <DKV k="block_hash" v={tx.block_hash} tone="cyan" copy={tx.block_hash} />
          <DKV k="block age" v={Math.floor(tx.block_age_s / 60) + "m " + (tx.block_age_s % 60) + "s"} />
        </Section>
      ) : null}

      {/* Raw RPC JSON toggle */}
      <Section title="Raw RPC" kicker="monerod · get_transactions">
        <button type="button" onClick={() => setShowJson((s) => !s)}
          style={{ appearance: "none", cursor: "pointer", background: "transparent",
            border: "1px solid var(--ink-20)", color: "var(--ink-60)",
            padding: "5px 12px", borderRadius: 3,
            fontFamily: "var(--f-mono)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {showJson ? "▼ Hide JSON" : "▶ Show JSON"}
        </button>
        {showJson ? (
          <pre style={{ marginTop: 10, padding: 14, background: "rgba(0,0,0,0.5)", border: "1px solid var(--rule)", borderRadius: 3, color: "var(--c-50)", fontFamily: "var(--f-mono)", fontSize: 10.5, lineHeight: 1.5, overflow: "auto", maxHeight: 440 }}>
{JSON.stringify(tx, null, 2)}
          </pre>
        ) : null}
        <DKV k="rpc call" v={<code style={{ color: "var(--ink-80)" }}>{tx.rpc_endpoints.get_transactions}</code>} />
      </Section>
    </div>
  );
}

window.FullTxDetail = FullTxDetail;

/* ─── FULL BLOCK DETAIL ────────────────────────────────────────── */

function FullBlockDetail({ block, onBack, onPickTx }) {
  const [showJson, setShowJson] = React.useState(false);
  const data = block;

  return (
    <div style={{ padding: "20px 28px 60px" }}>
      {onBack ? (
        <button type="button" onClick={onBack}
          style={{ appearance: "none", cursor: "pointer", background: "transparent",
            border: "1px solid var(--ink-20)", color: "var(--ink-60)",
            padding: "5px 12px", borderRadius: 3,
            fontFamily: "var(--f-mono)", fontSize: 11, marginBottom: 18 }}>← Back</button>
      ) : null}

      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "flex-start", paddingBottom: 18, borderBottom: "1px solid var(--rule)" }}>
        <div>
          <div className="kicker">Block</div>
          <h2 className="serif acc" style={{ margin: "6px 0 0", fontSize: 36, fontWeight: 400, lineHeight: 1, color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>#{block.height.toLocaleString()}</h2>
          <div className="mono" style={{ fontSize: 12.5, color: "var(--c-50)", marginTop: 8, wordBreak: "break-all" }}>{block.hash}</div>
          <div className="mono dim" style={{ fontSize: 11, marginTop: 8 }}>
            Mined by <b style={{ color: "var(--ink-100)" }}>{block.pool}</b> · {block.timestamp_iso} · {Math.floor(block.age / 60)}m{block.age % 60}s ago
          </div>
        </div>
        <span className="pill live"><span className="led pulse" />{block.conf} confirmations</span>
      </div>

      {/* KPI tiles */}
      <Section title="Block summary" kicker="At a glance">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
          <Stat k="Transactions" v={block.txs} tone="acc" />
          <Stat k="Total size" v={block.sizeKB.toFixed(1)} sub="KB" />
          <Stat k="Weight" v={(block.weight_bytes / 1024).toFixed(1)} sub="KB" />
          <Stat k="Fullness" v={block.fullness_pct + "%"} sub={"vs " + block.median_block_size_kb + "KB median"} tone={block.fullness_pct > 80 ? "" : ""} />
          <Stat k="Reward" v={block.coinbase_reward.toFixed(4)} sub="XMR" />
          <Stat k="Total fees" v={block.total_fees.toFixed(6)} sub="XMR" />
        </div>
      </Section>

      {/* Mining details */}
      <Section title="Mining" kicker="RandomX · proof of work">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ padding: "12px 16px", border: "1px solid var(--rule)", borderRadius: 4 }}>
            <DKV k="pool" v={block.pool} tone="acc" />
            <DKV k="miner_address" v={block.miner_address_short} tone="cyan" />
            <DKV k="miner_tx_hash" v={block.miner_tx_hash} tone="cyan" copy={block.miner_tx_hash} />
            <DKV k="coinbase_reward" v={block.coinbase_reward.toFixed(7) + " XMR"} tone="acc" />
          </div>
          <div style={{ padding: "12px 16px", border: "1px solid var(--rule)", borderRadius: 4 }}>
            <DKV k="difficulty" v={(block.difficulty / 1e9).toFixed(2) + "G"} />
            <DKV k="cumulative_difficulty" v={(BigInt(block.cumulative_difficulty) / 1_000_000_000_000n).toString() + "T"} mono />
            <DKV k="randomx_seed" v={block.randomx_seed_hash} tone="cyan" copy={block.randomx_seed_hash} />
            <DKV k="seed_height" v={block.randomx_seed_height.toLocaleString()} />
            <DKV k="nonce" v={block.nonce.toLocaleString()} />
          </div>
        </div>
      </Section>

      {/* Block header */}
      <Section title="Block header" kicker="Chain linkage">
        <DKV k="height" v={block.height.toLocaleString()} tone="acc" />
        <DKV k="hash" v={block.hash} tone="cyan" copy={block.hash} />
        <DKV k="prev_hash" v={block.prev_hash} tone="cyan" copy={block.prev_hash} />
        <DKV k="merkle_root" v={block.merkle_root} tone="cyan" copy={block.merkle_root} />
        <DKV k="major_version / minor_version" v={`${block.major_version} / ${block.minor_version}`} />
        <DKV k="hardfork" v={block.hardfork_label} tone="acc" />
        <DKV k="timestamp" v={block.timestamp + " · " + block.timestamp_iso} />
        <DKV k="weight (long-term)" v={(block.long_term_weight / 1024).toFixed(1) + " KB"} />
      </Section>

      {/* TX list */}
      <Section title={`Transactions · ${block.txs}`} kicker="Included in this block"
        right={<span>showing {Math.min(block.txs, 24)}{block.txs_remaining ? " · " + block.txs_remaining + " more" : ""}</span>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {block.txs_in_block.map((id, i) => (
            <button key={i} onClick={() => onPickTx?.(id)}
              style={{ appearance: "none", cursor: "pointer", textAlign: "left",
                display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 12, alignItems: "center",
                padding: "8px 12px", background: "transparent",
                border: "1px solid var(--ink-10)", borderRadius: 3,
                color: "var(--ink-100)", fontFamily: "var(--f-mono)", fontSize: 11.5,
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,122,26,0.05)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <span className="dim">{String(i).padStart(2, "0")}</span>
              <span style={{ color: "var(--c-50)", wordBreak: "break-all" }}>{id}</span>
              <span className="dim">↗</span>
            </button>
          ))}
          {block.txs_remaining ? (
            <div className="mono dim" style={{ padding: "8px 12px", fontSize: 11, fontStyle: "italic" }}>
              + {block.txs_remaining} more txs in this block (truncated for display)
            </div>
          ) : null}
        </div>
      </Section>

      {/* Raw JSON */}
      <Section title="Raw RPC" kicker="monerod · get_block">
        <button type="button" onClick={() => setShowJson((s) => !s)}
          style={{ appearance: "none", cursor: "pointer", background: "transparent",
            border: "1px solid var(--ink-20)", color: "var(--ink-60)",
            padding: "5px 12px", borderRadius: 3,
            fontFamily: "var(--f-mono)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {showJson ? "▼ Hide JSON" : "▶ Show JSON"}
        </button>
        {showJson ? (
          <pre style={{ marginTop: 10, padding: 14, background: "rgba(0,0,0,0.5)", border: "1px solid var(--rule)", borderRadius: 3, color: "var(--c-50)", fontFamily: "var(--f-mono)", fontSize: 10.5, lineHeight: 1.5, overflow: "auto", maxHeight: 440 }}>
{JSON.stringify(block, null, 2)}
          </pre>
        ) : null}
        <DKV k="rpc call" v={<code style={{ color: "var(--ink-80)" }}>{block.rpc_endpoints.get_block}</code>} />
      </Section>
    </div>
  );
}

window.FullBlockDetail = FullBlockDetail;
