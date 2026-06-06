// Journey.tsx — /education (default) · the BTC → XMR narrative.
// Ten chapters: genesis → privacy problem → upgrades → Monero → technology →
// comparison → controversy → Wagyu → self-custody → the choice. Content editorial.

import * as React from "react";
import { Card } from "@/design/primitives";
import { EduChapter, EduMilestone, EduPullquote } from "./EduAtoms";

/* local helpers — prefixed Jrn to avoid shared-scope collisions */
function JrnHero({ navigate }: { navigate: (to: string) => void }) {
  return (
    <section style={{ position: "relative", padding: "30px 0 18px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="edu-head" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="kicker" style={{ color: "var(--tk-accent)" }}>An educational journey through digital money</div>
        <h1 className="serif" style={{ margin: 0, fontSize: 64, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.02, color: "var(--ink-100)" }}>
          The Genesis of <em style={{ color: "var(--tk-accent)", textShadow: "var(--glow-2)", fontStyle: "normal" }}>Privacy</em>
        </h1>
        <p className="serif" style={{ margin: 0, maxWidth: "64ch", fontSize: 21, lineHeight: 1.5, color: "var(--ink-80)" }}>
          A deep dive into two revolutionary currencies — and the philosophical thread that connects them. From a message buried in the genesis block to a coin that refuses to know who you are.
        </p>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
        <button type="button" className="proto-btn" style={{ borderColor: "var(--tk-accent)", color: "var(--tk-accent)", boxShadow: "var(--glow-1)", padding: "9px 16px" }}
          onClick={() => navigate("/education/timeline")}>Open the timeline →</button>
        <button type="button" className="proto-btn" style={{ padding: "9px 16px" }} onClick={() => navigate("/education/quotes")}>Satoshi, in his words →</button>
      </div>
    </section>
  );
}

function JrnStatGrid({ items }: { items: { v: React.ReactNode; k: React.ReactNode; tone?: string }[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
      {items.map((s, i) => (
        <div key={i} style={{ border: "1px solid var(--rule)", borderRadius: 3, padding: "16px 14px", background: "rgba(0,0,0,0.3)" }}>
          <div className="mono" style={{ fontSize: 28, fontWeight: 500, color: s.tone || "var(--tk-accent)", textShadow: "var(--glow-1)", lineHeight: 1 }}>{s.v}</div>
          <div className="mono dim" style={{ fontSize: 10.5, marginTop: 8, lineHeight: 1.4, letterSpacing: "0.04em" }}>{s.k}</div>
        </div>
      ))}
    </div>
  );
}

function JrnTechCard({ name, protects, color, children }: { name: React.ReactNode; protects: React.ReactNode; color: string; children: React.ReactNode }) {
  return (
    <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="kicker" style={{ color }}>Protects · {protects}</div>
      <div className="serif" style={{ fontSize: 24, fontWeight: 500, color: "var(--ink-100)" }}>{name}</div>
      <p className="mono dim" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65 }}>{children}</p>
    </Card>
  );
}

function JrnCompareTable() {
  const ROWS: string[][] = [
    ["Genesis", "Jan 3, 2009 · Satoshi · first cryptocurrency", "Apr 18, 2014 · community fork · privacy by default"],
    ["Supply", "21M hard cap · deflationary · last coin ~2140", "Tail emission · 0.6 XMR/block forever"],
    ["Privacy", "Pseudonymous · all tx visible · addresses linkable", "Private by default · sender, receiver, amount hidden"],
    ["Fungibility", "Non-fungible · coins can be tainted / blacklisted", "Fungible · no on-chain history to taint"],
    ["Consensus", "SHA-256 PoW · ASIC-dominated · industrial", "RandomX PoW · CPU-friendly · decentralized"],
    ["Auditability", "Fully transparent · public transaction graph", "Provably sound supply · amounts hidden"],
    ["Regulatory", "ETF-approved · listed globally", "Delisted · structurally non-compliant by design"],
  ];
  return (
    <div style={{ border: "1px solid var(--rule)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 1fr", background: "rgba(255,122,26,0.05)", borderBottom: "1px solid var(--rule)" }}>
        <div className="kicker" style={{ padding: "12px 14px" }}>Dimension</div>
        <div className="kicker" style={{ padding: "12px 14px", color: "var(--c-50)" }}>Bitcoin</div>
        <div className="kicker" style={{ padding: "12px 14px", color: "var(--tk-accent)" }}>Monero</div>
      </div>
      {ROWS.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "150px 1fr 1fr", borderBottom: i < ROWS.length - 1 ? "1px solid var(--rule)" : "none" }}>
          <div className="mono" style={{ padding: "12px 14px", fontSize: 11, color: "var(--ink-60)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{r[0]}</div>
          <div className="mono" style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--ink-80)", lineHeight: 1.5 }}>{r[1]}</div>
          <div className="mono" style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--ink-100)", lineHeight: 1.5 }}>{r[2]}</div>
        </div>
      ))}
    </div>
  );
}

function JrnSpectrum() {
  return (
    <Card style={{ padding: 22 }}>
      <div className="kicker">The privacy spectrum</div>
      <div style={{ position: "relative", height: 10, borderRadius: 6, margin: "20px 0 10px",
        background: "linear-gradient(to right, var(--c-50), var(--ink-40) 50%, var(--tk-accent))", boxShadow: "0 0 16px rgba(255,122,26,0.2)" }}>
        <div style={{ position: "absolute", left: "8%", top: -6, width: 14, height: 22, transform: "translateX(-50%)" }}>
          <div style={{ width: 2, height: 22, background: "var(--c-50)", margin: "0 auto", boxShadow: "0 0 6px var(--c-50)" }} />
        </div>
        <div style={{ position: "absolute", left: "96%", top: -6, width: 14, height: 22, transform: "translateX(-50%)" }}>
          <div style={{ width: 2, height: 22, background: "var(--tk-accent)", margin: "0 auto", boxShadow: "0 0 6px var(--tk-accent)" }} />
        </div>
      </div>
      <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
        <span style={{ color: "var(--c-50)" }}>◀ Fully transparent · Bitcoin</span>
        <span style={{ color: "var(--tk-accent)" }}>Monero · Fully private ▶</span>
      </div>
      <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.6, marginTop: 14, marginBottom: 0 }}>
        Bitcoin sits near the transparent end. Monero sits at the private end. There is no middle ground.
      </p>
    </Card>
  );
}

export function EduJourney({ navigate }: { navigate: (to: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
      <JrnHero navigate={navigate} />

      {/* 01 ORIGIN */}
      <EduChapter n="01" kicker="The origin" title='Bitcoin: A <em style="color:var(--c-50);font-style:normal">Cypherpunk’s</em> Dream'
        sub="Before there was a price. Before there were exchanges. There was an idea — and a message embedded in code forever." />
      <div>
        <EduMilestone date="October 31, 2008" title="The whitepaper appears">
          On Halloween night, amid the worst financial crisis since the Great Depression, a pseudonymous figure named Satoshi Nakamoto posts a nine-page paper to a cryptography mailing list: <em style={{ color: "var(--ink-100)", fontStyle: "normal" }}>"Bitcoin: A Peer-to-Peer Electronic Cash System."</em> Almost nobody notices. The world is too busy watching banks collapse.
        </EduMilestone>
        <EduMilestone date="January 3, 2009 · 18:15 UTC" title="Block zero: the genesis">
          Satoshi mines the first block. Embedded in the coinbase — a headline from The Times of London. A timestamp. A manifesto. Proof that Bitcoin was born not from greed, but from disgust at a system that privatized profits and socialized losses.
          <div className="mono" style={{ marginTop: 12, padding: "12px 14px", border: "1px solid var(--rule)", borderLeft: "2px solid var(--tk-accent)", background: "rgba(0,0,0,0.35)", fontSize: 12.5, color: "var(--tk-accent)" }}>
            // The Times 03/Jan/2009<br />Chancellor on brink of second bailout for banks
          </div>
        </EduMilestone>
        <EduMilestone date="January 12, 2009" title="The first transaction">
          Hal Finney receives 10 BTC from Satoshi in block 170 — the first peer-to-peer Bitcoin transaction. Finney, a legendary cryptographer who had worked on PGP, tweets simply: <em style={{ color: "var(--ink-100)", fontStyle: "normal" }}>"Running bitcoin."</em>
        </EduMilestone>
        <EduMilestone date="May 22, 2010" title="10,000 BTC for two pizzas">
          Laszlo Hanyecz pays 10,000 BTC for two Papa John's pizzas — the first real-world Bitcoin transaction. We celebrate "Bitcoin Pizza Day" every year not to mock Laszlo, but to honor him. Someone had to prove Bitcoin could buy things.
        </EduMilestone>
        <EduMilestone date="December 12, 2010" title="Satoshi's final message" tone="var(--ink-60)">
          Satoshi posts a last public message on the BitcoinTalk forum. Then — silence. No farewell. They simply vanish, leaving behind roughly 1 million unmoved BTC and a protocol that would change the world.
        </EduMilestone>
      </div>
      <EduPullquote cite="Satoshi Nakamoto · February 11, 2009">
        The central bank must be trusted not to debase the currency, but the history of fiat currencies is full of breaches of that trust. Banks must be trusted to hold our money and transfer it electronically, but they lend it out in waves of credit bubbles with barely a fraction in reserve.
      </EduPullquote>

      {/* 02 VISION UNFULFILLED */}
      <EduChapter n="02" kicker="The vision unfulfilled" title="Satoshi's Privacy Problem"
        sub="Here's what they don't tell you: Satoshi knew Bitcoin's privacy was incomplete — and on the forums, wrestled with exactly how to fix it." />
      <Card style={{ padding: 22 }}>
        <div className="kicker">BitcoinTalk Thread #174 · August 10–13, 2010 · "Not a suggestion"</div>
        <p className="mono dim" style={{ fontSize: 13, lineHeight: 1.7, marginTop: 10 }}>
          A user named "Red" raised concerns about Bitcoin's completely public transaction history. What followed is one of the most overlooked conversations in cryptocurrency history — Satoshi describing, in 2010, the exact primitives that would become Monero's core privacy layer.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
          <EduPullquote cite="On key blinding">What we need is a way to generate additional blinded variations of a public key … others could not tell the blinded public keys belong to the owner of the original.</EduPullquote>
          <EduPullquote cite="On group signatures">With group signatures, it is possible for something to be signed but not know who signed it.</EduPullquote>
        </div>
        <p className="serif" style={{ fontSize: 19, color: "var(--ink-100)", marginTop: 14, marginBottom: 0 }}>
          The creator of Bitcoin knew its privacy was incomplete. The question was: who would finish the work?
        </p>
      </Card>

      {/* 03 EVOLUTION */}
      <EduChapter n="03" kicker="The evolution" title="Bitcoin's Protocol Upgrades"
        sub="Bitcoin isn't static. Through careful consensus it has evolved — though privacy remains its Achilles heel." />
      <div>
        <EduMilestone date="August 2017" title="SegWit" tone="var(--c-50)">
          The most contentious upgrade in Bitcoin's history. Segregated Witness separated signature data from transaction data, raising effective capacity and enabling the Lightning Network. The debate was so fierce it spawned Bitcoin Cash.
        </EduMilestone>
        <EduMilestone date="November 14, 2021" title="Taproot" tone="var(--c-50)">
          Activated at block 709,632. Schnorr signatures, MAST, and Tapscript made complex multisig look identical to simple sends — a modest privacy gain. But senders, receivers, and amounts remain fully visible.
        </EduMilestone>
        <EduMilestone date="2024 – 2025" title="The current debate" tone="var(--c-50)">
          The community remains deadlocked. BIP-324, OP_CAT, covenant proposals — all debated. But privacy-by-default remains politically impossible. Too many stakeholders benefit from Bitcoin's transparency.
        </EduMilestone>
      </div>

      {/* 04 SUCCESSOR */}
      <EduChapter n="04" kicker="The successor" title="Monero: Satoshi's Unfinished Work"
        sub='In 2013, a pseudonymous author named Nicolas van Saberhagen published a paper opening with: "Privacy and anonymity are the most important aspects of electronic cash."' />
      <div>
        <EduMilestone date="October 2013" title="The CryptoNote whitepaper">
          CryptoNote v2 describes ring signatures and one-time keys, explicitly calling Bitcoin's traceability a "critical flaw." Van Saberhagen's identity remains unknown.
        </EduMilestone>
        <EduMilestone date="April 18, 2014" title="BitMonero is born (and dies)">
          "thankful_for_today" launches BitMonero, the first fair-launch CryptoNote coin. He proposes unpopular changes; the community revolts. Within days seven developers fork it, drop the "Bit," and rename it Monero — Esperanto for "coin."
        </EduMilestone>
        <EduMilestone date="January 2017" title="RingCT activation">
          Ring Confidential Transactions make hiding amounts mandatory. Monero becomes the first cryptocurrency where sender, receiver, and amount are all hidden by default.
        </EduMilestone>
        <EduMilestone date="October 2018" title="Bulletproofs integration">
          Range proofs were eating block space. Bulletproofs cut transaction sizes by ~80% — faster and cheaper without sacrificing privacy.
        </EduMilestone>
        <EduMilestone date="2025 – 2026" title="FCMP++ & Cuprate" tone="var(--p-50)">
          Full-Chain Membership Proofs move beyond probabilistic privacy toward provable untraceability — replacing 16-member rings with proofs of membership in the entire chain (150M+ outputs). Beta stressnet in May 2026; mainnet hard fork targeted mid-2026.
        </EduMilestone>
      </div>

      {/* 05 TECHNOLOGY */}
      <EduChapter n="05" kicker="The technology" title="How Monero Actually Works"
        sub="Four cryptographic technologies. Four layers of privacy. One currency that cannot be traced." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <JrnTechCard name="Ring Signatures" protects="the sender" color="var(--tk-accent)">
          Your signature is mixed with 15 decoys from the chain. Observers see that <em style={{ color: "var(--ink-100)", fontStyle: "normal" }}>someone</em> in a group of 16 signed — but cannot determine who.
        </JrnTechCard>
        <JrnTechCard name="Stealth Addresses" protects="the receiver" color="var(--p-50)">
          Every payment generates a unique one-time address. Publish your address publicly and no two payments can ever be linked on-chain. Only your private view key identifies your outputs.
        </JrnTechCard>
        <JrnTechCard name="RingCT" protects="the amount" color="var(--g-50)">
          Pedersen commitments hide the amount while letting the network verify inputs equal outputs. Amounts appear as cryptographic commitments — valid, but unreadable.
        </JrnTechCard>
        <JrnTechCard name="Dandelion++" protects="your IP" color="var(--c-50)">
          Transactions pass through a random "stem" of nodes before broadcast, obscuring which node originated them and defeating network-level surveillance.
        </JrnTechCard>
      </div>
      <EduPullquote>
        It's not "opt-in" privacy. It's not "shielded" transactions. Every single Monero transaction is private — by design, by default.
      </EduPullquote>

      {/* 06 JUXTAPOSITION */}
      <EduChapter n="06" kicker="The juxtaposition" title="Bitcoin vs. Monero"
        sub="Same ethos. Different implementations. One chose transparency. One chose privacy." />
      <JrnCompareTable />
      <JrnSpectrum />

      {/* 07 CONTROVERSY */}
      <EduChapter n="07" kicker="The controversy" title="Why Monero Is Under Attack"
        sub="Delisted. Targeted by governments. Hunted by intelligence agencies. This isn't happening because Monero is weak — it's happening because Monero works." />
      <JrnStatGrid items={[
        { v: "73+", k: "Exchange delistings since 2018" },
        { v: "$625K", k: "IRS bounty — still unfilled", tone: "var(--y-50)" },
        { v: "$22M", k: "Chainalysis contract — still failed", tone: "var(--r-50)" },
        { v: "0", k: "Verified successful traces", tone: "var(--g-50)" },
        { v: "100%", k: "Transactions private by default", tone: "var(--p-50)" },
        { v: "6+", k: "Countries with trading bans" },
        { v: "10+", k: "Years running · zero proven exploits" },
        { v: "3", k: "Privacy layers · RingCT · Stealth · Dandelion++", tone: "var(--p-50)" },
      ]} />
      <Card style={{ padding: 22 }}>
        <div className="kicker">The real reason</div>
        <p className="mono dim" style={{ fontSize: 13, lineHeight: 1.72, marginTop: 10 }}>
          The modern financial system runs on one assumption: every transaction can be watched. Banks report to governments. Bitcoin is a transparent ledger. Chain-analysis firms built a billion-dollar industry on it. Monero obliterates this model — ring signatures obscure the sender, stealth addresses hide the receiver, RingCT encrypts the amount. There is no transparent mode. This is why regulators treat it differently than any other cryptocurrency. It's not about crime. It's about control — and Monero removes it.
        </p>
      </Card>

      {/* 08 SOLUTION */}
      <EduChapter n="08" kicker="The solution" title="Wagyu: Breaking the Suppression"
        sub="For years, instant-exchange services quietly drained Monero's value through terrible rates and forced selling. Here's what changed." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card style={{ padding: 20 }}>
          <div className="kicker" style={{ color: "var(--r-50)" }}>The hidden tax</div>
          <p className="mono dim" style={{ fontSize: 12.5, lineHeight: 1.65, marginTop: 10 }}>
            Instant services advertise 0.5–1% fees; the reality is closer to 3–4%, hidden in bad rates. Worse, they collect fees in XMR and immediately dump for stablecoins — an estimated $300K+ in daily selling pressure that suppresses price regardless of demand.
          </p>
        </Card>
        <Card style={{ padding: 20 }}>
          <div className="kicker" style={{ color: "var(--g-50)" }}>How Wagyu v2 changes it</div>
          <ul className="mono dim" style={{ fontSize: 12.5, lineHeight: 1.7, margin: "10px 0 0", paddingLeft: 18 }}>
            <li>Routes swaps through professional market makers (Hyperliquid).</li>
            <li>Exchange-level pricing — no 1% hidden fees.</li>
            <li>Zero forced selling: $1M through Wagyu = zero dumped on market.</li>
            <li>True price discovery — genuine demand finally translates to price.</li>
          </ul>
        </Card>
      </div>

      {/* 09 TAKE ACTION */}
      <EduChapter n="09" kicker="Take action" title="Self-Custody: Own Your Keys"
        sub="Not your keys, not your coins. Here's how to actually hold Bitcoin and Monero." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card style={{ padding: 20 }}>
          <div className="kicker" style={{ color: "var(--c-50)" }}>Bitcoin wallets</div>
          <p className="mono" style={{ fontSize: 12, lineHeight: 1.7, marginTop: 10, color: "var(--ink-80)" }}>
            <b style={{ color: "var(--ink-100)" }}>Hardware:</b> Coldcard · Trezor · Ledger · Keystone<br />
            <b style={{ color: "var(--ink-100)" }}>Software:</b> Sparrow · Electrum · Bitcoin Core<br />
            <span className="dim">For maximum privacy: CoinJoin via Wasabi or JoinMarket.</span>
          </p>
        </Card>
        <Card style={{ padding: 20 }}>
          <div className="kicker" style={{ color: "var(--tk-accent)" }}>Monero wallets</div>
          <p className="mono" style={{ fontSize: 12, lineHeight: 1.7, marginTop: 10, color: "var(--ink-80)" }}>
            <b style={{ color: "var(--ink-100)" }}>Official:</b> Monero GUI · Monero CLI · Feather (Tor built-in)<br />
            <b style={{ color: "var(--ink-100)" }}>Mobile:</b> Cake Wallet · monero.com · Cupcake (cold storage) · Monerujo<br />
            <span className="dim">Privacy is default. No mixing required. Just send.</span>
          </p>
        </Card>
      </div>
      <Card style={{ padding: 20 }}>
        <div className="kicker">Acquiring Monero · with CEXes increasingly hostile</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
          {[["Wagyu", "Exchange-level pricing, no KYC", "var(--tk-accent)"], ["Haveno", "Decentralized P2P trading", "var(--p-50)"], ["Atomic swaps", "BTC ↔ XMR trustlessly", "var(--g-50)"], ["LocalMonero", "Closed 2024 · alternatives emerging", "var(--ink-40)"]].map((c, i) => (
            <div key={i}><div className="mono" style={{ fontSize: 14, color: c[2] }}>{c[0]}</div><div className="mono dim" style={{ fontSize: 11, lineHeight: 1.45, marginTop: 4 }}>{c[1]}</div></div>
          ))}
        </div>
      </Card>

      {/* 10 CHOICE */}
      <EduChapter n="10" kicker="The choice" title="Your Financial Privacy Is Not Negotiable"
        sub="Satoshi created Bitcoin to free money from institutional control — and wrestled publicly with its incomplete privacy. Years later, Monero finished what Satoshi started." />
      <Card style={{ padding: 28, textAlign: "center", background: "rgba(255,122,26,0.04)", borderColor: "rgba(255,122,26,0.25)" }}>
        <p className="serif" style={{ fontSize: 26, lineHeight: 1.4, color: "var(--ink-100)", margin: "0 auto 6px", maxWidth: "44ch" }}>
          The question isn't whether you need privacy today. It's whether you'll still have the option tomorrow.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 18 }}>
          <button type="button" className="proto-btn" style={{ borderColor: "var(--tk-accent)", color: "var(--tk-accent)", boxShadow: "var(--glow-1)", padding: "9px 18px" }} onClick={() => navigate("/monero/bottomline")}>The bottom line →</button>
          <button type="button" className="proto-btn" style={{ padding: "9px 18px" }} onClick={() => navigate("/education/timeline")}>The full timeline →</button>
        </div>
      </Card>
    </div>
  );
}
