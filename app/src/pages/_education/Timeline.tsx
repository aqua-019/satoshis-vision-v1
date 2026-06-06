// /education/timeline · privacy-evolution timeline, filterable by category.
// Content editorial (~48 events across 5 eras) — verify before publishing.

import * as React from "react";
import { PageHeader } from "@/layout/AppShell";
import type { MoneroLive } from "@/data/types";

const TL_CAT = {
  bitcoin:    { label: "Bitcoin",    color: "var(--c-50)" },
  monero:     { label: "Monero",     color: "var(--tk-accent)" },
  crossover:  { label: "Crossover",  color: "var(--p-50)" },
  regulatory: { label: "Regulatory", color: "var(--y-50)" },
} as const;

type TlCat = keyof typeof TL_CAT;

interface TlEvent {
  d: string;
  t: string;
  c: TlCat;
  b: string;
}

interface TlEra {
  id: string;
  span: string;
  name: string;
  events: TlEvent[];
}

const TL_ERAS: TlEra[] = [
  { id: "e1", span: "2008 — 2011", name: "The Bitcoin Era", events: [
    { d: "Oct 31, 2008", t: "Bitcoin Whitepaper Published", c: "bitcoin", b: "Satoshi publishes 'Bitcoin: A Peer-to-Peer Electronic Cash System'. Section 10 warns that address-based pseudonymity has limits and recommends a new key pair per transaction." },
    { d: "Jan 3, 2009", t: "Genesis Block Mined", c: "bitcoin", b: "Block 0 embeds 'Chancellor on brink of second bailout for banks' — a timestamp and a philosophical statement. The 50 BTC subsidy is permanently unspendable." },
    { d: "Jan 12, 2009", t: "First Bitcoin Transaction", c: "bitcoin", b: "Satoshi sends 10 BTC to cryptographer Hal Finney in block 170 — the first transaction between two parties." },
    { d: "Oct 5, 2009", t: "First BTC Price Established", c: "bitcoin", b: "New Liberty Standard publishes the first exchange rate — $0.00076/BTC — based on electricity cost to mine." },
    { d: "May 22, 2010", t: "Bitcoin Pizza Day", c: "bitcoin", b: "Laszlo Hanyecz pays 10,000 BTC for two pizzas — the first commercial transaction. Bitcoin becomes a medium of exchange." },
    { d: "Jul 7–8, 2010", t: "Satoshi's Anonymity Thread (#82)", c: "bitcoin", b: "BitcoinTalk #82 'Anonymity' — the community debates whether Bitcoin provides adequate privacy. Satoshi acknowledges the limitations." },
    { d: "Aug 10–13, 2010", t: "The 'Not a Suggestion' Thread (#174)", c: "bitcoin", b: "Satoshi outlines 'blinded variations of a public key' (stealth addresses), 'group signatures' (ring signatures), and hiding amounts — the exact features that became Monero's core." },
    { d: "Aug 15, 2010", t: "Value Overflow Bug", c: "bitcoin", b: "An integer overflow creates 184 billion BTC. Satoshi and devs patch and fork within hours — demonstrating both vulnerability and rapid response." },
    { d: "Dec 5, 2010", t: "Satoshi's Last Public Post", c: "bitcoin", b: "'WikiLeaks has kicked the hornet's nest.' Satoshi's awareness that Bitcoin's transparent ledger makes it unsuitable for high-profile privacy needs." },
    { d: "Dec 12, 2010", t: "Satoshi's Last Known Activity", c: "bitcoin", b: "Final forum activity. Communicates only by private email after this. ~1.1M BTC remains untouched to this day." },
    { d: "Apr 23, 2011", t: "Satoshi's Final Email", c: "bitcoin", b: "'I've moved on to other things. It's in good hands with Gavin and everyone.' He disappears permanently." },
    { d: "June 2011", t: "WikiLeaks Accepts Bitcoin", c: "crossover", b: "Cut off from traditional payments, WikiLeaks turns to Bitcoin — validating censorship resistance, but its transparent ledger makes donations fully traceable." },
  ] },
  { id: "e2", span: "2012 — 2014", name: "CryptoNote Emerges", events: [
    { d: "Jul 4, 2012", t: "Bytecoin Launches", c: "monero", b: "The first CryptoNote coin ships ring signatures and one-time addresses — but ~80% was premined by insiders, motivating a fair-launch alternative." },
    { d: "Dec 12, 2012", t: "CryptoNote v1 Whitepaper", c: "monero", b: "Nicolas van Saberhagen criticizes Bitcoin's transparent ledger, proposing ring signatures for sender privacy and one-time addresses for receiver privacy." },
    { d: "Feb 2013", t: "Bitcoin Hits $1,000", c: "bitcoin", b: "BTC touches four figures for the first time, drawing investors and regulators alike." },
    { d: "March 2013", t: "CryptoNote v2 Whitepaper", c: "monero", b: "Refines ring signatures, one-time key derivation, and formalizes unlinkability and untraceability." },
    { d: "Oct 2013", t: "Silk Road Shut Down", c: "bitcoin", b: "FBI seizes 144,000 BTC. The investigation relied heavily on Bitcoin's transparent blockchain — proving it pseudonymous, not anonymous." },
    { d: "2013 – 2014", t: "Chain Analysis Firms Founded", c: "crossover", b: "Elliptic (2013) and Chainalysis (2014) build tools to trace Bitcoin, signing contracts with dozens of agencies — turning the ledger into a surveillance tool." },
    { d: "Feb 2014", t: "Mt. Gox Collapse", c: "bitcoin", b: "~850,000 BTC lost. Accelerates the 'not your keys, not your coins' movement toward self-custody." },
    { d: "Apr 18, 2014", t: "Monero (BitMonero) Launched", c: "monero", b: "A community fork of Bytecoin without the premine. Ring signatures and stealth addresses from day one — privacy mandatory and default." },
    { d: "Sept 2014", t: "Monero Community Takeover", c: "monero", b: "Original creator 'thankful_for_today' ousted. Rebranded BitMonero → Monero. Governance shifts to a decentralized, community-driven model." },
  ] },
  { id: "e3", span: "2017 — 2022", name: "The Privacy War", events: [
    { d: "Jan 10, 2017", t: "RingCT Activated", c: "monero", b: "Pedersen commitments hide amounts. Completes the trifecta: hidden senders, hidden receivers, hidden amounts." },
    { d: "May 2017", t: "WannaCry Ransomware", c: "crossover", b: "Attackers convert Bitcoin proceeds to Monero to evade tracking — a real-world consequence of Bitcoin's traceability." },
    { d: "March 2018", t: "Bulletproofs Implemented", c: "monero", b: "Range proofs shrink ~80%, cutting fees proportionally. Privacy and scalability prove compatible." },
    { d: "Sept 2018", t: "Sub-address System", c: "monero", b: "Unlimited unique receiving addresses from one wallet, with no on-chain link between them." },
    { d: "Nov 2019", t: "RandomX Activated", c: "monero", b: "ASIC-resistant CPU mining keeps participation accessible to ordinary users, preserving decentralization." },
    { d: "Jul 2020", t: "CipherTrace Claims Partial Tracing", c: "crossover", b: "Probabilistic tracing tools announced under DHS contract. Researchers dispute effectiveness; no reliable trace demonstrated." },
    { d: "Sept 2020", t: "IRS Offers $625K Bounty", c: "regulatory", b: "22 companies apply; Chainalysis and Integra FEC selected. Implicitly validates Monero's privacy — and remains effectively unclaimed." },
    { d: "Oct 2020", t: "CLSAG Signatures", c: "monero", b: "Replaces MLSAG — 25% smaller, ~20% faster verification, same privacy." },
    { d: "Nov 2020", t: "Chainalysis Wins IRS Contract", c: "regulatory", b: "$22M for Monero tracing. Leaked training later reveals reliance on exchange KYC data and metadata — not cryptographic breaks." },
    { d: "Apr 2021", t: "Coinbase Refuses to List XMR", c: "regulatory", b: "Despite user demand, citing compliance. A turning point where regulation meaningfully restricts privacy-coin access." },
    { d: "2021 – 2022", t: "Exchange Delisting Wave", c: "regulatory", b: "Bittrex, Huobi and others drop XMR, each citing compliance — accelerating the shift toward DEXs and P2P." },
    { d: "Aug 2022", t: "Tail Emission Begins", c: "monero", b: "0.6 XMR per block, forever. Unlike Bitcoin's eventual zero rewards, Monero ensures perpetual miner incentives." },
  ] },
  { id: "e4", span: "2022 — 2025", name: "The Regulatory Storm", events: [
    { d: "Dec 2022", t: "EU MiCA Regulation Passed", c: "regulatory", b: "Stringent traceability requirements make it very hard for exchanges to support privacy coins within the EU." },
    { d: "Jul 2023", t: "View Tags Implemented", c: "monero", b: "One-byte view tags let wallets skip non-matching outputs — ~40% faster sync, no privacy trade-off." },
    { d: "Jan 2024", t: "EU Bans Anonymous Crypto >€1000", c: "regulatory", b: "Updated AML rules prohibit anonymous payments above €1,000 through regulated entities." },
    { d: "May 2024", t: "Binance Delists Monero", c: "regulatory", b: "The world's largest exchange removes XMR globally. Price recovers and surges — independence from CEXes demonstrated." },
    { d: "June 2024", t: "Dubai DFSA Bans Privacy Tokens", c: "regulatory", b: "Notable given Dubai's crypto-friendly stance — reflecting a growing global regulatory consensus." },
    { d: "Nov 2024", t: "Zcash Governance Crisis", c: "crossover", b: "ECC turmoil fractures the community, reinforcing Monero as the most reliable privacy cryptocurrency." },
    { d: "Jan 2025", t: "XMR Hits ~$800 ATH", c: "monero", b: "Surging demand despite delistings. 73 delistings correlate with a +195% price increase." },
    { d: "2024 – 2025", t: "73 Exchanges Delist XMR", c: "regulatory", b: "On-chain activity stays flat or grows. P2P, atomic swaps and DEXs absorb volume. No company to sue, no CEO to arrest." },
    { d: "Mar–Apr 2024", t: "FCMP++ Proposal Published", c: "monero", b: "kayabaNerve (Luke Parker) publishes the Full-Chain Membership Proofs design; the Foundation follows with an official explainer." },
    { d: "Oct 3, 2025", t: "FCMP++ Alpha Stressnet Launches", c: "monero", b: "Testnet hard fork at block 2,847,330. Alpha v1 → v1.6 ships CARROT addressing, RAM optimizations, and a 5× proof speedup. Veridise audit completes." },
  ] },
  { id: "e5", span: "2026+", name: "The Future", events: [
    { d: "Jan 2026", t: "EU DAC8 Directive Activates", c: "regulatory", b: "Crypto providers must report transaction data to tax authorities across all EU member states — the most comprehensive surveillance framework yet." },
    { d: "2026", t: "CLARITY Act & GENIUS Act", c: "regulatory", b: "US expands crypto reporting (Form 1099-DA), creating a comprehensive surveillance framework — and driving demand for privacy alternatives." },
    { d: "May 6, 2026", t: "FCMP++ Beta Stressnet Launches", c: "monero", b: "Final scaling parameters and wallet integrations (watch-only, hardware, multisig, tx proofs) are exercised before the mainnet hard fork." },
    { d: "Mid-2026 (tentative)", t: "FCMP++ Mainnet Hard Fork", c: "monero", b: "Replaces ring signatures with full-chain membership proofs (anonymity set of 150M+). Bundled with CARROT addressing; backward compatible with 95-char addresses." },
    { d: "2026", t: "Cuprate Rust Node", c: "monero", b: "Implementation diversity reduces the risk that one bug affects all nodes. Rust's memory safety shrinks the attack surface." },
    { d: "2026", t: "Seraphis & Jamtis in Beta", c: "monero", b: "Seraphis redesigns the transaction protocol; Jamtis brings new addressing with forward secrecy and tiered wallet permissions." },
  ] },
];

function TlNode({ ev, dimmed }: { ev: TlEvent; dimmed: boolean }) {
  const cat = TL_CAT[ev.c];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: 16, opacity: dimmed ? 0.18 : 1, transition: "opacity 0.3s ease" }}>
      <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
        <div style={{ position: "absolute", top: 6, bottom: -22, width: 1, background: "var(--rule)" }} />
        <div style={{ width: 11, height: 11, borderRadius: 6, background: cat.color, boxShadow: `0 0 8px ${cat.color}`, marginTop: 4, zIndex: 1 }} />
      </div>
      <div style={{ paddingBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="mono" style={{ fontSize: 11, color: cat.color, letterSpacing: "0.04em" }}>{ev.d}</span>
          <span className="mono" style={{ fontSize: 8.5, letterSpacing: "0.14em", textTransform: "uppercase", color: cat.color, border: "1px solid " + cat.color, borderRadius: 2, padding: "1px 6px" }}>{cat.label}</span>
        </div>
        <div className="serif" style={{ fontSize: 19, fontWeight: 500, color: "var(--ink-100)", margin: "5px 0 5px" }}>{ev.t}</div>
        <p className="mono dim" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65, maxWidth: "80ch" }}>{ev.b}</p>
      </div>
    </div>
  );
}

export function EduTimeline({ data }: { data: MoneroLive }) {
  const [filter, setFilter] = React.useState<string>("all");
  const total = TL_ERAS.reduce((a, e) => a + e.events.length, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <PageHeader kicker="Interactive history"
        title='The Privacy Evolution <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">Timeline</em>'
        sub="From Satoshi's genesis block to the regulatory storm — every pivotal moment in the evolution of financial privacy." />

      <section style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
        {([[total, "Events"], [18, "Years"], [5, "Eras"]] as [number, string][]).map(([v, k], i) => (
          <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="mono acc glow" style={{ fontSize: 30, fontWeight: 500 }}>{v}</span>
            <span className="kicker">{k}</span>
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all", ...Object.keys(TL_CAT)].map((k) => {
            const on = filter === k;
            const color = k === "all" ? "var(--ink-100)" : TL_CAT[k as TlCat].color;
            return (
              <button key={k} type="button" onClick={() => setFilter(k)}
                style={{ appearance: "none", cursor: "pointer", background: on ? "rgba(255,255,255,0.06)" : "transparent",
                  border: "1px solid " + (on ? color : "var(--ink-20)"), borderRadius: 999, padding: "5px 12px",
                  color: on ? color : "var(--ink-60)", fontFamily: "var(--f-mono)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {k === "all" ? "All" : TL_CAT[k as TlCat].label}
              </button>
            );
          })}
        </div>
      </section>

      {TL_ERAS.map((era) => (
        <section key={era.id} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
            <span className="mono" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--tk-accent)" }}>{era.span}</span>
            <span className="serif" style={{ fontSize: 26, fontWeight: 500, color: "var(--ink-100)" }}>{era.name}</span>
            <span style={{ height: 1, flex: 1, background: "var(--rule)" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {era.events.map((ev, i) => (
              <TlNode key={i} ev={ev} dimmed={filter !== "all" && filter !== ev.c} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
