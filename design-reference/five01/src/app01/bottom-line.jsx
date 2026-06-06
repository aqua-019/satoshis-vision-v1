// bottom-line.jsx — /monero/bottomline + /monero/outlook
// The investment thesis (the case for XMR as a monetary asset), the
// BTC↔XMR "great divergence", the failed-tracing evidence record, and the
// 2027+ forward outlook. Registered on window; wired into MoneroPage tabs.
// Editorial content — verify figures before publishing.

/* ── shared atoms (prefixed Btm) ────────────────────────────── */
function BtmStat({ v, k, tone }) {
  return (
    <div style={{ border: "1px solid var(--rule)", borderRadius: 3, padding: "18px 16px", background: "rgba(0,0,0,0.3)" }}>
      <div className="mono" style={{ fontSize: 34, fontWeight: 500, lineHeight: 1, color: tone || "var(--tk-accent)", textShadow: "var(--glow-1)" }}>{v}</div>
      <div className="mono dim" style={{ fontSize: 11, marginTop: 8, letterSpacing: "0.04em" }}>{k}</div>
    </div>
  );
}

/* ── BTC ↔ XMR divergence table ─────────────────────────────── */
function BtmDivergence() {
  const ROWS = [
    ["Transparent blockchain", "All transactions visible", true, "All transactions encrypted", false],
    ["Surveillance-sharing agreements", "Possible — Chainalysis works", true, "Impossible — cryptography prevents", false],
    ["Blockchain intelligence tools", "Effective", true, "Ineffective — probabilistic only", false],
    ["AML / CFT compliance", "Can meet requirements", true, "Cannot comply — by design", false],
    ["Source-of-funds documentation", "Traceable on-chain", true, "Untraceable — ring signatures", false],
    ["Institutional custody", "Fidelity, Coinbase, etc.", true, "None — compliance impossible", false],
    ["ETF approval", "Approved January 2024", true, "Structurally impossible", false],
    ["Regulatory classification", "\u201cCommodity\u201d — CFTC", true, "\u201cPrivacy coin\u201d — restricted", false],
    ["Financial privacy", "None — public ledger", false, "Complete — mathematical guarantee", true],
  ];
  const cell = (text, yes, accent) => (
    <div className="mono" style={{ padding: "11px 14px", fontSize: 12, lineHeight: 1.45, color: yes ? "var(--ink-100)" : "var(--ink-60)", display: "flex", gap: 8, alignItems: "baseline" }}>
      <span style={{ color: yes ? "var(--g-50)" : "var(--r-50)", fontWeight: 600 }}>{yes ? "✓" : "✗"}</span>
      <span style={accent ? { color: "var(--tk-accent)" } : undefined}>{text}</span>
    </div>
  );
  return (
    <div style={{ border: "1px solid var(--rule)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.3fr 1.3fr", background: "rgba(255,122,26,0.05)", borderBottom: "1px solid var(--rule)" }}>
        <div className="kicker" style={{ padding: "12px 14px" }}>TradFi requirement</div>
        <div className="kicker" style={{ padding: "12px 14px", color: "var(--c-50)" }}>Bitcoin</div>
        <div className="kicker" style={{ padding: "12px 14px", color: "var(--tk-accent)" }}>Monero</div>
      </div>
      {ROWS.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1.1fr 1.3fr 1.3fr", borderBottom: i < ROWS.length - 1 ? "1px solid var(--rule)" : "none", background: i === ROWS.length - 1 ? "rgba(255,122,26,0.04)" : "transparent" }}>
          <div className="mono" style={{ padding: "11px 14px", fontSize: 11.5, color: "var(--ink-60)", letterSpacing: "0.04em", textTransform: "uppercase", alignSelf: "center" }}>{r[0]}</div>
          {cell(r[1], r[2], false)}
          {cell(r[3], r[4], r[4])}
        </div>
      ))}
    </div>
  );
}

/* ── evidence: failed tracing attempts ──────────────────────── */
function BtmEvidenceCard({ amount, who, when, outcome, otone, children }) {
  return (
    <Card style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div className="mono" style={{ fontSize: 30, fontWeight: 500, color: "var(--tk-accent)", textShadow: "var(--glow-1)", lineHeight: 1 }}>{amount}</div>
        <div className="mono dim" style={{ fontSize: 10.5, textAlign: "right" }}>{who}<br />{when}</div>
      </div>
      <p className="mono dim" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.68 }}>{children}</p>
      <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: otone, border: "1px solid " + otone, borderRadius: 2, padding: "5px 10px", alignSelf: "flex-start" }}>{outcome}</div>
    </Card>
  );
}

/* ── cryptographic architecture grid ────────────────────────── */
function BtmArchGrid() {
  const PRIMS = [
    ["Ring signatures", "Sender", "Every transaction is signed by a ring of 16 possible signers. Determining which one actually signed is computationally infeasible.", "var(--tk-accent)"],
    ["Stealth addresses", "Receiver", "Each transaction creates a one-time address. Even the same recipient never repeats — unlinkable by design.", "var(--p-50)"],
    ["RingCT", "Amount", "Pedersen commitments and range proofs hide amounts while proving no coins were created from nothing.", "var(--g-50)"],
    ["Bulletproofs+", "Efficiency", "Zero-knowledge proofs that cut transaction size ~80%+ with no trusted setup. Privacy made cheap.", "var(--c-50)"],
    ["RandomX", "Decentralization", "CPU-optimized, ASIC-resistant proof-of-work. \u201cOne CPU, one vote\u201d — as Satoshi intended.", "var(--y-50)"],
    ["Dandelion++", "Network", "Probabilistic stem routing obscures the broadcaster's IP, defeating network-level deanonymization.", "var(--ink-80)"],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
      {PRIMS.map((p, i) => (
        <Card key={i} style={{ padding: 18 }}>
          <div className="kicker" style={{ color: p[3] }}>Protects · {p[1]}</div>
          <div className="serif" style={{ fontSize: 20, fontWeight: 500, color: "var(--ink-100)", margin: "6px 0" }}>{p[0]}</div>
          <p className="mono dim" style={{ margin: 0, fontSize: 11.5, lineHeight: 1.6 }}>{p[2]}</p>
        </Card>
      ))}
    </div>
  );
}

/* ── delisting paradox ──────────────────────────────────────── */
function BtmDelistings() {
  const D = [
    ["Binance", "Feb 20, 2024", "The world's largest exchange delists XMR globally. Price recovers and surges past pre-delisting levels.", "var(--r-50)"],
    ["Kraken (EEA)", "Oct 31, 2024", "All XMR trading halted for EEA users; balances force-converted to BTC. Earlier delistings in Ireland & Belgium.", "var(--r-50)"],
    ["OKX", "Jan 2024", "Removes all privacy-coin trading pairs, citing new compliance guidelines.", "var(--r-50)"],
    ["Dubai VARA", "Jan 12, 2025", "Bans trading and custody of privacy tokens. Monero hits an all-time high the next day.", "var(--y-50)"],
    ["EU MiCA / AMLR", "Effective 2027", "Will prohibit service providers from offering privacy coins. Self-custody and P2P remain accessible.", "var(--y-50)"],
    ["Haveno DEX", "2024 – 2025", "A Monero-first decentralized exchange enters production. When CEXes delist, DEXs emerge.", "var(--g-50)"],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
      {D.map((d, i) => (
        <div key={i} style={{ border: "1px solid var(--rule)", borderLeft: "2px solid " + d[3], borderRadius: 2, padding: "14px 16px", background: "rgba(8,7,5,0.6)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <span className="serif" style={{ fontSize: 17, color: "var(--ink-100)", fontWeight: 500 }}>{d[0]}</span>
            <span className="mono dim2" style={{ fontSize: 10 }}>{d[1]}</span>
          </div>
          <p className="mono dim" style={{ margin: "8px 0 0", fontSize: 11.5, lineHeight: 1.55 }}>{d[2]}</p>
        </div>
      ))}
    </div>
  );
}

/* ══ BOTTOM LINE TAB ════════════════════════════════════════ */
function MoneroBottomLine({ data }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
      <PageHeader kicker="The investment thesis"
        title='The <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">Bottom Line</em>'
        sub="A record of government attempts to break Monero, the billions spent in failure, and the structural case for private money in an age of total surveillance." />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <BtmStat v="$625K+" k="IRS bounty (2020)" />
        <BtmStat v="0" k="Successful traces" tone="var(--g-50)" />
        <BtmStat v="73" k="Exchange delistings (2025)" tone="var(--y-50)" />
        <BtmStat v="+195%" k="Price growth YoY" tone="var(--g-50)" />
      </section>

      <Card style={{ padding: 26 }}>
        <div className="kicker">The thesis · what Monero represents</div>
        <p className="serif" style={{ fontSize: 23, lineHeight: 1.45, color: "var(--ink-100)", margin: "12px 0 14px" }}>
          In a world where every transaction is tracked and every human reduced to a data point, Monero is the only mathematical guarantee of financial privacy on Earth.
        </p>
        <p className="mono dim" style={{ fontSize: 13, lineHeight: 1.72, margin: 0 }}>
          Those in power see your bank accounts, your card purchases, your Bitcoin transactions on a permanent public ledger. With Monero they see nothing. Ring signatures hide the sender, stealth addresses hide the receiver, RingCT hides the amount. Not private by policy — private by mathematics. This is why the IRS offered $625,000 to crack it (they failed), why Chainalysis won a $22M contract to trace it (their own leaked training admits they cannot), and why 73 exchanges delisted it in 2025. And yet XMR rose 195% — because demand for privacy is not a crime. It is a human right.
        </p>
      </Card>

      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <EduChapter n="I" kicker="The great divergence" title="Two paths: TradFi integration vs financial sovereignty"
          sub="Bitcoin chose transparency and regulatory compliance — gaining Wall Street, surrendering privacy. Monero chose cryptographic privacy — ensuring sovereignty, accepting institutional exclusion. Both were deliberate." />
        <BtmDivergence />
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <EduChapter n="II" kicker="The record" title="Government bounties & failed attempts"
          sub="A documented history of state-sponsored efforts to break Monero's privacy — and their consistent failure to produce a working trace." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <BtmEvidenceCard amount="$625,000" who="IRS Criminal Investigation" when="September 2020" outcome="Stagnant — unfilled" otone="var(--y-50)">
            A public bounty for Monero-tracing tools. 22 companies applied; Chainalysis and Integra FEC were selected and given 8 months. The deadline passed. No deterministic tracing tool was ever delivered. CipherTrace's CEO admitted tracing Monero is "more of a probabilistic game."
          </BtmEvidenceCard>
          <BtmEvidenceCard amount="$22,000,000" who="IRS → Chainalysis" when="2021 – present" outcome="Failure — no break" otone="var(--r-50)">
            When the bounty failed, the government escalated. A leaked 2024 IRS training video confirmed investigators rely on exchange KYC data, IP correlation, and user mistakes — never a cryptographic break. They can only trace Monero when the user errs, never when the protocol holds.
          </BtmEvidenceCard>
          <BtmEvidenceCard amount="CipherTrace" who="DHS contract" when="August 2020" otone="var(--y-50)" outcome="Claims disputed">
            CipherTrace claimed the "world's first Monero-tracing toolkit." In reality it lacked wallet identification and exchange attribution. Researchers noted nothing in it exceeded capabilities Monero developers had already mitigated.
          </BtmEvidenceCard>
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <EduChapter n="III" kicker="The architecture" title="Why it cannot be traced"
          sub="The mathematical foundations that make Monero impervious to surveillance — not by policy, but by the laws of cryptography." />
        <BtmArchGrid />
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <EduChapter n="IV" kicker="The delisting paradox" title="Every ban proves it works"
          sub="The more Monero is prohibited, the higher its value rises. If it could be traced, regulators would keep it on exchanges as a honeypot. They delist it because they cannot see inside." />
        <BtmDelistings />
      </section>

      <Card style={{ padding: 28, textAlign: "center", background: "rgba(255,122,26,0.04)", borderColor: "rgba(255,122,26,0.25)" }}>
        <p className="serif" style={{ fontSize: 25, lineHeight: 1.42, color: "var(--ink-100)", margin: "0 auto", maxWidth: "52ch" }}>
          The surveillance state sees everything. Monero is the one thing they cannot see. That is not a bug — that is the entire point.
        </p>
        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--tk-accent)", marginTop: 16 }}>"Privacy is not a crime. It is a right." — the Monero community</div>
      </Card>
    </div>
  );
}

/* ══ 2027+ OUTLOOK TAB ══════════════════════════════════════ */
function MoneroOutlook({ data }) {
  const FUTURE = [
    { d: "July 2027 (expected)", t: "EU AMLR Full Enforcement", c: "var(--y-50)", b: "The EU Anti-Money-Laundering Regulation becomes fully effective. CASPs are prohibited from offering privacy coins — but self-custody wallets and peer-to-peer trading remain accessible. The rules target service providers, not the technology." },
    { d: "Mid-2026 (tentative)", t: "FCMP++ Mainnet Deployment", c: "var(--tk-accent)", b: "Full-Chain Membership Proofs replace ring signatures with anonymity sets of 150M+ outputs — every transaction hiding among the entire history of the chain. Bundled with CARROT addressing; backward compatible with 95-character addresses." },
    { d: "April 2028 (expected)", t: "Fifth Bitcoin Halving", c: "var(--c-50)", b: "Block ~1,050,000. The reward drops from 3.125 to 1.5625 BTC; daily supply falls to ~225 BTC. By then 97%+ of all Bitcoin will have been mined." },
    { d: "2026 – 2028", t: "Seraphis & Jamtis", c: "var(--p-50)", b: "Seraphis redesigns the transaction protocol; Jamtis brings new addressing with forward secrecy and tiered wallet permissions — the most ambitious protocol evolution since RingCT." },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
      <PageHeader kicker="2026 – 2030 · forward outlook"
        title='The road <em style="color:var(--p-50);text-shadow:var(--glow-p);font-style:normal">ahead</em>'
        sub="Where the two monetary paths go next — surveillance frameworks tightening on one side, the largest privacy upgrade in Monero's history landing on the other." />

      <Card style={{ padding: 26 }}>
        <div className="kicker">The demand thesis</div>
        <p className="serif" style={{ fontSize: 22, lineHeight: 1.45, color: "var(--ink-100)", margin: "12px 0 14px" }}>
          Privacy demand is structural, not speculative.
        </p>
        <p className="mono dim" style={{ fontSize: 13, lineHeight: 1.72, margin: 0 }}>
          In 2025, dozens of jurisdictions implemented stricter compliance frameworks targeting privacy coins — and yet Monero's price rose 195%, its network processed 15,000–25,000 daily transactions, and its community grew. Every new surveillance framework (DAC8, CLARITY, GENIUS, AMLR) expands the addressable market for private money. Supply tightened by delistings + persistent demand moving P2P = structural price support.
        </p>
      </Card>

      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <EduChapter n="2027+" kicker="Upcoming" title="What's coming"
          sub="Scheduled hard forks, regulatory deadlines, and the upgrades that define the next era of private money." />
        <div>
          {FUTURE.map((f, i) => (
            <EduMilestone key={i} date={f.d} title={f.t} tone={f.c}>{f.b}</EduMilestone>
          ))}
        </div>
      </section>

      <Card style={{ padding: 26 }}>
        <div className="kicker">The final accounting</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 14 }}>
          <div>
            <div className="serif" style={{ fontSize: 20, color: "var(--c-50)", marginBottom: 6 }}>Bitcoin chose traceability</div>
            <p className="mono dim" style={{ fontSize: 12.5, lineHeight: 1.65, margin: 0 }}>Gained Wall Street, ETFs, corporate treasuries, Strategic Reserve status, and a $2T+ market cap — by becoming fully auditable.</p>
          </div>
          <div>
            <div className="serif" style={{ fontSize: 20, color: "var(--tk-accent)", marginBottom: 6 }}>Monero chose privacy</div>
            <p className="mono dim" style={{ fontSize: 12.5, lineHeight: 1.65, margin: 0 }}>Gained the mathematical guarantee that no government, corporation, or surveillance state can see your transactions — by accepting institutional exclusion.</p>
          </div>
        </div>
        <p className="serif" style={{ fontSize: 18, color: "var(--ink-100)", marginTop: 18, marginBottom: 0 }}>The world needs both. Bitcoin for when you want Wall Street's blessing. Monero for when you want freedom.</p>
      </Card>
    </div>
  );
}

Object.assign(window, { MoneroBottomLine, MoneroOutlook });
