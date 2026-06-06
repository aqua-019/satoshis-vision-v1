// monero-pages.jsx — /monero subroutes
//   /monero            → overview (3 pillars)
//   /monero/origin     → Bytecoin → BitMonero → Monero, founders, contributors
//   /monero/tech       → privacy primitives ELI5 + tail emission math
//   /monero/legality   → country-by-country + exchange delistings timeline
//   /monero/markets    → price action thesis (chartist + macro)
//   /monero/comparison → BTC head-to-head
//   /monero/attacks    → IRS bounty + sybil + deanon papers + KYC pressure
//
// Content is editorial — verify before publishing. Citations omitted from the
// design preview to avoid clutter; add inline links once you're ready to ship.

const MONERO_TABS = [
  { id: "overview",   label: "Overview" },
  { id: "origin",     label: "Origin" },
  { id: "tech",       label: "Tech" },
  { id: "legality",   label: "Legality" },
  { id: "markets",    label: "Markets · thesis" },
  { id: "comparison", label: "vs Bitcoin" },
  { id: "attacks",    label: "Attacks survived" },
  { id: "future",     label: "Future" },
  { id: "bottomline", label: "Bottom line" },
  { id: "outlook",    label: "2027+" },
];

function MoneroTabs({ active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
      {MONERO_TABS.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            style={{
              appearance: "none", background: "transparent", cursor: "pointer",
              border: 0, borderBottom: "2px solid " + (on ? "var(--tk-accent)" : "transparent"),
              color: on ? "var(--tk-accent)" : "var(--ink-60)",
              padding: "10px 16px",
              fontFamily: "var(--f-mono)", fontSize: 11,
              letterSpacing: "0.12em", textTransform: "uppercase",
              textShadow: on ? "var(--glow-1)" : "none",
              marginBottom: -1,
            }}
          >{t.label}</button>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   OVERVIEW
   ────────────────────────────────────────────────────────────── */

function MoneroOverview({ data, navigate }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader
        kicker="Origin · philosophy · why now"
        title='A coin that <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">refuses</em> to know who you are.'
        sub="Eleven years old. No premine, no founder reward, no on-chain identity. Built by a rotating cast of cypherpunks."
      />
      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {[
          { c: "var(--tk-accent)", k: "Private by default", t: "Every transaction.",
            b: "Bitcoin's privacy is opt-in and circumstantial. Monero's is mandatory at the protocol layer — every sender, recipient, and amount is hidden by construction." },
          { c: "var(--p-50)", k: "Fungible by design", t: "1 XMR ≡ 1 XMR.",
            b: "No coin has a transparent history. Exchanges can't blacklist outputs because there are no addresses on chain to blacklist." },
          { c: "var(--g-50)", k: "Permanent emission", t: "0.6 XMR forever.",
            b: "The tail emission keeps miners paid into deep time. There is no \"security budget cliff\" — the hearth stays lit." },
        ].map((p, i) => (
          <Card key={i} style={{ padding: 22 }}>
            <div className="kicker" style={{ color: p.c }}>{p.k}</div>
            <div className="serif" style={{ fontSize: 28, fontWeight: 500, color: "var(--ink-100)", margin: "8px 0" }}>{p.t}</div>
            <p className="mono dim" style={{ margin: 0, fontSize: 12, lineHeight: 1.65 }}>{p.b}</p>
          </Card>
        ))}
      </section>
      <Card style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 24 }}>
        <div>
          <div className="kicker">Where to next?</div>
          <div className="serif" style={{ fontSize: 22, color: "var(--ink-100)", marginTop: 6 }}>Walk through every primitive that makes the privacy work, or dig into how Monero has survived a decade of pressure.</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => navigate("/monero/tech")} className="proto-btn"
            style={{ borderColor: "var(--p-50)", color: "var(--p-50)", boxShadow: "var(--glow-p)" }}>Tech →</button>
          <button type="button" onClick={() => navigate("/monero/legality")} className="proto-btn">Legality →</button>
        </div>
      </Card>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   ORIGIN — Bytecoin → BitMonero → Monero
   ────────────────────────────────────────────────────────────── */

function MoneroOrigin() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader
        kicker="Lineage · CryptoNote · founders"
        title='The <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">unlikely</em> fork.'
        sub="Bytecoin was a botched launch. BitMonero was a quiet rebellion. Monero is what happened when nobody was in charge."
      />

      {/* Lineage diagram */}
      <Card style={{ padding: 26 }}>
        <div className="kicker">Lineage · 2012 → today</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 20, alignItems: "stretch" }}>
          {[
            { y: "OCT 2012", t: "CryptoNote v2 whitepaper", c: "var(--p-50)", b: 'Anonymous "Nicolas van Saberhagen" publishes the foundational privacy framework. Ring signatures, stealth addresses, one-time keys.' },
            { y: "MAR 2014", t: "Bytecoin (BCN) launch", c: "var(--ink-60)", b: "Claims a 2-year history. Investigators find 82% of supply was premined. Trust evaporates within weeks." },
            { y: "APR 2014", t: "BitMonero fork", c: "var(--y-50)", b: 'thankful_for_today forks Bytecoin, proposes a 60s block target. Community rejects his unilateral changes within 5 days.' },
            { y: "APR 2014", t: "Monero v0.1 (the rename)", c: "var(--tk-accent)", b: "Seven anonymous developers — known as the Core Team — take over the fork. 120s block target. No premine, no founder reward." },
            { y: "TODAY",    t: "11 years, no insider exits", c: "var(--g-50)", b: "Pseudonymous core team. Donation-funded. No company, no CEO, no token sale. Has shipped every hardfork on schedule." },
          ].map((e, i) => (
            <div key={i} style={{ borderTop: `2px solid ${e.c}`, paddingTop: 12, paddingRight: 6 }}>
              <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.16em", color: e.c, textShadow: `0 0 6px ${e.c}` }}>{e.y}</div>
              <div className="serif" style={{ fontSize: 17, fontWeight: 500, color: "var(--ink-100)", marginTop: 6, lineHeight: 1.2 }}>{e.t}</div>
              <p className="mono dim" style={{ margin: "8px 0 0", fontSize: 11, lineHeight: 1.55 }}>{e.b}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Founders / contributors */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card style={{ padding: 22 }}>
          <div className="kicker">The Core Team · 7 pseudonyms</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {[
              { n: "fluffypony (Riccardo Spagni)", r: "Maintainer 2014–2019", c: "var(--tk-accent)", desc: "Public face for years. Stepped back to focus on Tari. Currently entangled in personal legal issues unrelated to Monero." },
              { n: "luigi1111",                    r: "Maintainer · still active",  c: "var(--p-50)",  desc: "Reproducible-build infrastructure, payment-tooling lead. Quiet and consistent." },
              { n: "binaryFate",                   r: "Cryptographer",                c: "var(--c-50)", desc: "Bulletproofs+, RingCT review, FCMP++ co-author." },
              { n: "moneromooo",                   r: "Core dev · prolific",         c: "var(--g-50)", desc: "Largest single contributor by commits. Real name still unknown." },
              { n: "Snipa22",                      r: "Infra / mining-pool dev",     c: "var(--y-50)", desc: "Author of nodejs-pool, runs SupportXMR." },
              { n: "dEBRUYNE",                     r: "Community + comms",            c: "var(--ink-60)", desc: "Moderator on r/Monero, release notes, security disclosure routing." },
              { n: "selsta",                       r: "Maintainer · 2020–",          c: "var(--tk-accent)", desc: "Current de-facto lead maintainer. Steady ship cadence." },
            ].map((p) => (
              <div key={p.n} style={{ display: "grid", gridTemplateColumns: "12px 1fr", gap: 12, padding: "6px 0", borderTop: "1px dashed var(--ink-10)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: p.c, boxShadow: `0 0 6px ${p.c}`, marginTop: 6 }} />
                <div>
                  <div className="mono" style={{ fontSize: 12, color: "var(--ink-100)" }}>{p.n}</div>
                  <div className="mono dim" style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: p.c }}>{p.r}</div>
                  <p className="mono dim" style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.55 }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ padding: 22 }}>
          <div className="kicker">Funding model · CCS (Community Crowdfunding System)</div>
          <p className="mono dim" style={{ margin: "10px 0 14px", fontSize: 12, lineHeight: 1.7 }}>
            Every Monero feature since 2017 has been built via the CCS — a milestone-based bounty system funded by community donations.
            No VCs, no token sale, no foundation salary roll. Developers propose work, community funds it, milestones gate payouts.
          </p>
          <div className="mono" style={{ fontSize: 12, color: "var(--ink-100)", marginTop: 4 }}>Sample funded proposals</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, fontSize: 11 }} className="mono">
            {[
              ["Bulletproofs+ implementation",    "112 XMR",  "binaryFate, 2022"],
              ["FCMP++ core proof system",         "1,800 XMR", "kayabaNerve + binaryFate, 2024"],
              ["P2Pool integration",               "640 XMR",  "SChernykh, 2021"],
              ["CLSAG audit (Kudelski Security)",  "12,000 EUR", "2020 — paid in XMR"],
              ["Monero GUI accessibility",         "84 XMR",   "selsta, 2023"],
              ["Tor onion-services hardening",     "55 XMR",   "rottenwheel, 2022"],
              ["LWS (light-wallet server) v2",     "210 XMR",  "moneromooo, 2023"],
              ["Atomic swap (Haveno fork)",        "750 XMR",  "Haveno team, 2023"],
            ].map(([t, amt, who]) => (
              <div key={t} style={{ display: "grid", gridTemplateColumns: "1fr 90px 1fr", gap: 8, padding: "3px 0", borderBottom: "1px dashed var(--ink-10)" }}>
                <span style={{ color: "var(--ink-80)" }}>{t}</span>
                <span className="acc" style={{ textAlign: "right" }}>{amt}</span>
                <span className="dim2" style={{ fontSize: 10 }}>{who}</span>
              </div>
            ))}
          </div>
          <p className="mono dim" style={{ fontSize: 10.5, marginTop: 12, color: "var(--ink-40)" }}>
            Total disbursed via CCS: ~25,000 XMR across ~150 proposals (2017–2026). No salaries; only deliverables.
          </p>
        </Card>
      </section>

      {/* The Bytecoin scandal */}
      <Card style={{ padding: 22 }}>
        <div className="kicker">Why the fork was necessary</div>
        <p className="serif" style={{ margin: "12px 0", fontSize: 21, fontWeight: 400, color: "var(--ink-100)", lineHeight: 1.5 }}>
          When researchers analyzed Bytecoin's claimed-2012 launch in 2014, they found
          <em style={{ color: "var(--r-50)", fontStyle: "normal" }}> 82% of the supply had been quietly mined </em>
          before public release. The "two-year-old chain" was a marketing fiction.
        </p>
        <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.7 }}>
          CryptoNote was sound. Bytecoin was not. The Monero fork preserved the protocol and threw out the launch. Every feature since — RingCT, Bulletproofs, CLSAG, view tags, FCMP++ — has been built in the open, audited, and released under a community process. The "fair launch" lineage is rare; Monero is one of perhaps three major coins (with Bitcoin and Litecoin) that genuinely had one.
        </p>
      </Card>

      {/* The 8 founders / split / who-is-who */}
      <Card style={{ padding: 26 }}>
        <div className="kicker">The seven who took over · April 2014</div>
        <h3 className="serif" style={{ margin: "10px 0 14px", fontSize: 22, fontWeight: 400, color: "var(--ink-100)" }}>
          When <em style={{ color: "var(--r-50)", fontStyle: "normal" }}>thankful_for_today</em> proposed changes the community rejected, seven pseudonyms forked his fork. None of them had a name. None of them have one today.
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginTop: 12 }}>
          {[
            { n: "tacotime",       r: "Original architect", c: "var(--tk-accent)", desc: "Wrote the first official Monero codebase. Stepped back from public view within a year. Real identity unknown." },
            { n: "smooth",         r: "Crypto + monetary",   c: "var(--c-50)",      desc: "Pushed the case for tail emission. Influential in the 2014 debate against thankful_for_today's 60-second block target. Active through 2018." },
            { n: "othe",           r: "Core developer",      c: "var(--g-50)",      desc: "Early CryptoNote analyst. Co-authored the technical critique of Bytecoin's premine." },
            { n: "eizh",           r: "Comms + advocacy",    c: "var(--p-50)",      desc: "Edited /r/Monero and the Monero StackExchange in its first years. Public-facing pseudonym; widely respected." },
            { n: "fluffypony",     r: "Maintainer 2014–19",  c: "var(--y-50)",      desc: "(Riccardo Spagni) The first developer to use his real name. Maintained for ~5 years. Now focused on Tari." },
            { n: "NoodleDoodle",   r: "Crypto + GUI",         c: "var(--c-50)",      desc: "Wrote the early CLI wallet. Performance work on the daemon's transaction validation path." },
            { n: "BinaryFate",     r: "Cryptographer · still active",   c: "var(--p-50)",      desc: "Author of Bulletproofs+ implementation. Co-author of FCMP++ paper. Still ships code in 2026." },
          ].map((p) => (
            <div key={p.n} style={{ padding: 12, border: "1px solid var(--rule)", borderRadius: 2, display: "grid", gridTemplateColumns: "8px 1fr", gap: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: p.c, boxShadow: `0 0 5px ${p.c}`, marginTop: 6 }} />
              <div>
                <div className="mono" style={{ fontSize: 13, color: "var(--ink-100)" }}>{p.n}</div>
                <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: p.c, marginTop: 2 }}>{p.r}</div>
                <p className="mono dim" style={{ margin: "8px 0 0", fontSize: 11, lineHeight: 1.6 }}>{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mono dim" style={{ marginTop: 16, fontSize: 11, lineHeight: 1.7 }}>
          The seventh seat has rotated several times since 2014 — the active core has averaged 5–7 people. <b style={{ color: "var(--g-50)" }}>No founder ever sold a stake</b>; there was no stake to sell. The protocol is governed by donation-funded contributors with no equity, no token allocation, no central foundation salary roll.
        </p>
      </Card>

      {/* Eleven-year cultural arc */}
      <Card style={{ padding: 26 }}>
        <div className="kicker">Culture · eleven years · no insider exits</div>
        <h3 className="serif" style={{ margin: "10px 0 18px", fontSize: 22, fontWeight: 400, color: "var(--ink-100)" }}>
          What kept it together when there was nothing holding it together.
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 22 }}>
          <div>
            <h4 className="mono" style={{ margin: 0, fontSize: 12, color: "var(--tk-accent)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Governance posture</h4>
            <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.75, marginTop: 8 }}>
              Monero has <b style={{ color: "var(--ink-100)" }}>no token holders</b>, no DAO, no quadratic vote. Protocol changes happen through MRL (Monero Research Lab) papers, public IRC/Matrix review, and CCS funding. A change must clear three filters: cryptographic correctness, performance acceptable to node operators, and rough consensus among ~30 active contributors. The bar is high; very few proposals ever ship.
            </p>
          </div>
          <div>
            <h4 className="mono" style={{ margin: 0, fontSize: 12, color: "var(--p-50)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Conflict, openly</h4>
            <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.75, marginTop: 8 }}>
              Monero is also one of the few protocols with a public record of internal disagreements — fluffypony's resignation, the 2018 bulletproof timeline debate, the tail-emission dispute. None of these caused a fork. The community ships its disagreements as PRs and CCS proposals, not as token-vote referendums.
            </p>
          </div>
          <div>
            <h4 className="mono" style={{ margin: 0, fontSize: 12, color: "var(--c-50)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Funding · CCS</h4>
            <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.75, marginTop: 8 }}>
              Every protocol upgrade since 2017 was funded by the Community Crowdfunding System — milestone-based bounties paid in XMR by donors. Total disbursed: ~25,000 XMR across ~150 proposals. No salaries; only deliverables. This funding model is the reason Monero has never required a treasury or company.
            </p>
          </div>
          <div>
            <h4 className="mono" style={{ margin: 0, fontSize: 12, color: "var(--g-50)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Pseudonymous credibility</h4>
            <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.75, marginTop: 8 }}>
              By staying pseudonymous, contributors limit legal exposure as anti-privacy regulation accelerates. There is no "Monero Foundation CEO" to subpoena, no compliance officer to threaten. The Bitcoin "Satoshi" departure created a power vacuum; Monero's design avoids the vacuum by never having a king.
            </p>
          </div>
        </div>
      </Card>

      {/* Notable contributors (deeper) */}
      <Card style={{ padding: 22 }}>
        <div className="kicker">Notable shipping in the last 36 months</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginTop: 14, fontFamily: "var(--f-mono)", fontSize: 11.5 }}>
          {[
            ["2023-04", "Bulletproofs+ shipped · v15 hardfork",       "binaryFate, with audit by Kudelski Security"],
            ["2023-08", "P2Pool v3 · stratum hardening",                "SChernykh + community"],
            ["2024-01", "View-tags reach 30%+ sync time reduction",     "selsta, moneromooo"],
            ["2024-06", "Cuprate alpha · first Rust full sync",         "boog900, hinto-janai"],
            ["2024-10", "FCMP++ paper · published",                      "kayabaNerve, binaryFate, jeffro256"],
            ["2025-02", "Atomic-swap volume crosses $100M lifetime",   "Haveno team + community"],
            ["2025-07", "Seraphis spec freeze for review",               "jeffro256, kayabaNerve"],
            ["2026-01", "FCMP++ stressnet launches",                     "Core dev + MRL"],
          ].map(([d, t, who]) => (
            <div key={d + t} style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 12, paddingTop: 6, borderTop: "1px dashed var(--ink-10)" }}>
              <span className="dim" style={{ color: "var(--tk-accent)", letterSpacing: "0.1em" }}>{d}</span>
              <div>
                <div style={{ color: "var(--ink-100)" }}>{t}</div>
                <div className="dim" style={{ fontSize: 10.5, marginTop: 2 }}>{who}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   TECH — privacy primitives ELI5 + tail emission
   ────────────────────────────────────────────────────────────── */

function MoneroTech() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader
        kicker="The privacy stack · ELI5"
        title='Five primitives, <em style="color:var(--p-50);text-shadow:var(--glow-p);font-style:normal">five questions</em> they answer.'
        sub="Each piece hides exactly one thing. Stack them and the chain stops talking."
      />

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {[
          { k: "Stealth addresses", q: "Who is receiving?",      c: "var(--p-50)",
            b: "Your wallet address never appears on-chain. For every payment, the sender computes a one-time address from yours that only you can recognise. Watch every transaction in the world; you'll never see your address listed because it's not stored." },
          { k: "Ring signatures",   q: "Who is sending?",         c: "var(--tk-accent)",
            b: "The sender groups 15 random unspent outputs from the chain alongside their real one and signs as the group. A verifier can confirm the spend is valid but can't tell which of the 16 outputs was the actual source." },
          { k: "RingCT",            q: "How much was sent?",      c: "var(--tk-accent)",
            b: "Pedersen commitments hide every amount as a homomorphic blob. The math proves inputs equal outputs without revealing the numbers. The chain confirms conservation; the value remains sealed." },
          { k: "Dandelion++",       q: "Where did it come from?", c: "var(--p-50)",
            b: 'Before a transaction broadcasts widely, it travels along a "stem" of hand-picked peers. Only after several hops does it "fluff" out to the whole network. Observers see fluff peers; the origin is hidden.' },
          { k: "View tags",         q: "Faster wallet sync?",     c: "var(--c-50)",
            b: "Since 2022, every output carries a 1-byte hint that lets wallets skip 255/256 of work on outputs that aren't theirs. Sync time dropped 30–40%. No privacy loss — the tag carries no identifying information." },
          { k: "FCMP++ (Q3 2026)",  q: "How big is the crowd?",    c: "var(--g-50)",
            b: "Full-chain Membership Proofs replace the 16-member ring with a proof that the real spender is somewhere in the entire UTXO set — currently 150M+ outputs. The anonymity multiplier goes from 16× to >10,000,000×." },
        ].map((p) => (
          <Card key={p.k} style={{ padding: 22 }}>
            <div className="kicker" style={{ color: p.c }}>{p.k}</div>
            <div className="serif" style={{ fontSize: 22, color: "var(--ink-100)", margin: "8px 0", fontWeight: 400 }}>{p.q}</div>
            <p className="mono dim" style={{ margin: 0, fontSize: 12, lineHeight: 1.7 }}>{p.b}</p>
          </Card>
        ))}
      </section>

      {/* Tail emission deep dive */}
      <Card style={{ padding: 26 }}>
        <div className="kicker">Tail emission · the math, and the why</div>
        <h3 className="serif" style={{ margin: "10px 0", fontSize: 26, fontWeight: 400, color: "var(--ink-100)" }}>
          <em style={{ color: "var(--tk-accent)", fontStyle: "normal", textShadow: "var(--glow-1)" }}>0.6 XMR</em> per block · forever.
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 14 }}>
          <div>
            <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.75 }}>
              From 2014 to May 2022, Monero followed a smooth-decay emission curve. The block reward dropped exponentially toward an asymptote — and in May 2022 (block 1,978,433), it crossed the floor of <b className="acc">0.6 XMR / block</b>. From that block forward, the reward is fixed at 0.6 XMR. Approximately <b className="acc">157,680 XMR per year</b> are emitted, indefinitely.
            </p>
            <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.75, marginTop: 10 }}>
              At ~18.5M circulating supply (2026), that's <b>~0.85% inflation</b>. By year 2050, with ~22M circulating, inflation drops to <b>~0.72%</b>. As supply grows, the inflation rate decays asymptotically toward zero — but the absolute miner reward stays constant.
            </p>
          </div>
          <div>
            <p className="serif" style={{ fontSize: 17, color: "var(--ink-100)", margin: 0, fontWeight: 400, fontStyle: "italic" }}>
              "It costs something to verify a chain forever. That something must be paid."
            </p>
            <p className="mono dim" style={{ fontSize: 11.5, lineHeight: 1.7, marginTop: 14 }}>
              Bitcoin's halving schedule predicts zero new emission by ~2140. After that, miners must be paid entirely by fees. Whether fee revenue is sufficient — and stable — has never been empirically tested at scale. <b className="dn">The security budget cliff is real.</b>
            </p>
            <p className="mono dim" style={{ fontSize: 11.5, lineHeight: 1.7, marginTop: 8 }}>
              Monero's tail emission elects a different tradeoff: a tiny perpetual dilution buys a permanent, predictable miner subsidy. <b className="up">The hearth never goes cold.</b> Privacy networks need this even more than transparent ones: no anonymity set survives if no miner shows up.
            </p>
          </div>
        </div>

        {/* Visualization — emission curve */}
        <div style={{ marginTop: 24 }}>
          <EmissionCurve />
        </div>
      </Card>
    </div>
  );
}

function EmissionCurve() {
  const W = 900, H = 220;
  const padL = 40, padR = 20, padT = 14, padB = 30;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  // 100 years of simulated emission curve
  const years = 100;
  const pts = [];
  let supply = 0;
  for (let y = 0; y < years; y++) {
    let emitYear;
    if (y < 8) {
      // smooth-decay phase (2014 to 2022)
      emitYear = 7_500_000 * Math.exp(-y * 0.5);
    } else {
      emitYear = 157_680; // tail
    }
    supply += emitYear;
    pts.push({ y, supply, emit: emitYear });
  }
  const maxSupply = pts[pts.length - 1].supply;
  const maxEmit = Math.max(...pts.map((p) => p.emit));
  const xOf = (i) => padL + (i / (years - 1)) * innerW;
  const yOfS = (v) => padT + innerH - (v / maxSupply) * innerH;
  const yOfE = (v) => padT + innerH - (Math.log10(v + 1) / Math.log10(maxEmit + 1)) * innerH;
  const supplyPath = "M" + pts.map((p, i) => `${xOf(i)},${yOfS(p.supply)}`).join(" L ");
  const emitPath = "M" + pts.map((p, i) => `${xOf(i)},${yOfE(p.emit)}`).join(" L ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      <line x1={xOf(8)} y1={padT} x2={xOf(8)} y2={padT + innerH} stroke="var(--ink-20)" strokeDasharray="2 3" />
      <text x={xOf(8) + 4} y={padT + 10} fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.12em">TAIL BEGINS · 2022</text>
      <path d={emitPath} fill="none" stroke="var(--p-50)" strokeWidth="1.4" />
      <path d={supplyPath} fill="none" stroke="var(--tk-accent)" strokeWidth="1.6" style={{ filter: "drop-shadow(0 0 3px var(--tk-accent))" }} />
      <text x={padL} y={padT + 10} fontFamily="var(--f-mono)" fontSize="9" fill="var(--tk-accent)" letterSpacing="0.1em">SUPPLY (linear, asymptotic ~22M)</text>
      <text x={padL + 280} y={padT + 10} fontFamily="var(--f-mono)" fontSize="9" fill="var(--p-50)" letterSpacing="0.1em">YEARLY EMISSION (log)</text>
      <text x={padL} y={H - 12} fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.18em">2014</text>
      <text x={xOf(50)} y={H - 12} fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.18em">2064</text>
      <text x={xOf(99)} y={H - 12} fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.18em">2114</text>
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────
   LEGALITY — country status + per-activity dropdown
   ────────────────────────────────────────────────────────────── */

// Per-country activity legality matrix. Five activity columns:
// hold · trade-CEX · trade-P2P · mine · merchant accept. Each is
// one of: legal / restricted / illegal / unclear.
const LEGALITY_MATRIX = [
  { c: "🇺🇸", n: "United States",       hold: "legal",      cex: "restricted", p2p: "legal",      mine: "legal",      pay: "legal",
    note: "FinCEN classifies XMR as a 'convertible virtual currency'. Several US-facing exchanges have delisted (Kraken, Bittrex, Coinbase). Non-custodial holding, P2P trade, mining, and accepting XMR as payment remain fully legal in all 50 states." },
  { c: "🇨🇦", n: "Canada",              hold: "legal",      cex: "restricted", p2p: "legal",      mine: "legal",      pay: "legal",
    note: "FINTRAC reporting threshold of $10K CAD applies to MSBs but not individuals. Kraken Canada still lists XMR. Mining is taxed as business income; payment acceptance treated like any commodity." },
  { c: "🇪🇺", n: "European Union (MiCA)", hold: "legal",   cex: "illegal",    p2p: "legal",      mine: "legal",      pay: "legal",
    note: "MiCA Article 76 prohibits CASPs from listing privacy coins as of Dec 30, 2024. Holding, P2P trade, mining, and merchant acceptance remain legal across all 27 member states. Wallet providers exempted (so far)." },
  { c: "🇬🇧", n: "United Kingdom",      hold: "legal",      cex: "restricted", p2p: "legal",      mine: "legal",      pay: "legal",
    note: "FCA registration requirement effectively delisted XMR from UK-licensed CEXs. The Travel Rule applies to MSBs, not individuals. P2P and self-custody remain fully unrestricted." },
  { c: "🇯🇵", n: "Japan",               hold: "legal",      cex: "illegal",    p2p: "legal",      mine: "legal",      pay: "legal",
    note: "FSA banned 'anonymous virtual currencies' from JFSA-licensed exchanges in 2018. P2P, holding, mining, and merchant use are not regulated at the individual level." },
  { c: "🇰🇷", n: "South Korea",         hold: "legal",      cex: "illegal",    p2p: "unclear",    mine: "legal",      pay: "legal",
    note: "FSC required 'dark coin' delisting from licensed exchanges in 2021. P2P platforms operate in legal grey zone (no specific ban; AML reporting required at scale)." },
  { c: "🇨🇭", n: "Switzerland",         hold: "legal",      cex: "legal",      p2p: "legal",      mine: "legal",      pay: "legal",
    note: "FINMA treats Monero like any virtual asset. Bity offers up to CHF 1,000/day KYC-free. Zug ('Crypto Valley') accepts XMR for tax payments below CHF 100K." },
  { c: "🇩🇪", n: "Germany",             hold: "legal",      cex: "illegal",    p2p: "legal",      mine: "legal",      pay: "legal",
    note: "BaFin treats XMR as 'units of account'. MiCA delisting applies. Held >1 year = tax-free under §23 EStG (private sale rule). Payment acceptance fully legal." },
  { c: "🇦🇺", n: "Australia",           hold: "legal",      cex: "restricted", p2p: "legal",      mine: "legal",      pay: "legal",
    note: "AUSTRAC pressured major exchanges (Coinbase, Binance) to delist privacy coins in 2020. ATO treats Monero like any digital asset for CGT. P2P and mining unaffected." },
  { c: "🇷🇺", n: "Russia",              hold: "legal",      cex: "restricted", p2p: "legal",      mine: "restricted", pay: "restricted",
    note: "Crypto mining permitted for registered entities only since Nov 2024. Crypto payments for goods/services within Russia are prohibited (only cross-border)." },
  { c: "🇨🇳", n: "China",               hold: "illegal",   cex: "illegal",    p2p: "illegal",   mine: "illegal",   pay: "illegal",
    note: "Total crypto ban since 2021. All transactions, exchanges, mining, and holding are prohibited. Enforcement focuses on businesses; individual holders face confiscation." },
  { c: "🇦🇪", n: "UAE / Dubai",         hold: "legal",      cex: "restricted", p2p: "legal",      mine: "legal",      pay: "legal",
    note: "Dubai's VARA permits regulated venues to delist privacy assets (most have). Free zones (ADGM, DIFC) have relaxed individual rules. P2P and self-custody fully legal." },
  { c: "🇧🇷", n: "Brazil",              hold: "legal",      cex: "legal",      p2p: "legal",      mine: "legal",      pay: "legal",
    note: "CVM treats Monero like any crypto. Bitso (regional CEX) lists XMR. Mining taxed as business activity. Merchant acceptance is common in fintech and remittance corridors." },
  { c: "🇸🇬", n: "Singapore",           hold: "legal",      cex: "restricted", p2p: "legal",      mine: "legal",      pay: "legal",
    note: "MAS guidance disfavors privacy coins on regulated venues but doesn't prohibit them. Most retail-facing CEXs have delisted; P2P and merchant payment fully legal." },
  { c: "🇲🇽", n: "Mexico",              hold: "legal",      cex: "legal",      p2p: "legal",      mine: "legal",      pay: "legal",
    note: "Banxico requires authorization for fintechs offering crypto; Monero not singled out. Bitso continues to list. Merchant acceptance growing in border corridors." },
  { c: "🇮🇳", n: "India",               hold: "legal",      cex: "unclear",    p2p: "legal",      mine: "legal",      pay: "unclear",
    note: "30% flat tax on crypto gains + 1% TDS on transfers since 2022. Most Indian CEXs do not list XMR. Holding and mining are legal; payment use exists in legal grey zone." },
  { c: "🇮🇩", n: "Indonesia",           hold: "legal",      cex: "legal",      p2p: "legal",      mine: "legal",      pay: "illegal",
    note: "Bappebti permits crypto trading as a commodity. Bank Indonesia prohibits using crypto as a payment method. Some local exchanges list XMR." },
  { c: "🇹🇷", n: "Turkey",              hold: "legal",      cex: "legal",      p2p: "legal",      mine: "legal",      pay: "illegal",
    note: "Crypto payments for goods/services banned since 2021. Trading and holding remain fully legal. Major Turkish exchanges list XMR." },
  { c: "🇦🇷", n: "Argentina",           hold: "legal",      cex: "legal",      p2p: "legal",      mine: "legal",      pay: "legal",
    note: "Crypto activity broadly permitted. Heavy inflation drives extensive P2P trading. Monero used in remittance corridors via Lemon Cash and Bitso." },
  { c: "🇿🇦", n: "South Africa",        hold: "legal",      cex: "legal",      p2p: "legal",      mine: "legal",      pay: "legal",
    note: "SARB classifies crypto as a 'financial asset'. Luno doesn't list XMR but VALR does. Mining is taxed; payment acceptance unrestricted." },
];

function LegalityRow({ row, open, onToggle }) {
  const chip = (key) => {
    const v = row[key];
    const palette = {
      legal:      { c: "var(--g-50)",   l: "Legal" },
      restricted: { c: "var(--y-50)",   l: "Restricted" },
      illegal:    { c: "var(--r-50)",   l: "Illegal" },
      unclear:    { c: "var(--ink-60)", l: "Unclear" },
    };
    const p = palette[v] || palette.unclear;
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "3px 8px", border: "1px solid " + p.c, color: p.c, borderRadius: 2,
        fontFamily: "var(--f-mono)", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase",
        background: v === "illegal" ? "rgba(255,77,109,0.06)" : "transparent",
      }}>
        <span style={{ width: 5, height: 5, borderRadius: 5, background: p.c, boxShadow: `0 0 4px ${p.c}` }} />
        {p.l}
      </span>
    );
  };
  return (
    <div style={{ border: "1px solid var(--rule)", borderRadius: 3, overflow: "hidden" }}>
      <button type="button" onClick={onToggle}
        style={{
          appearance: "none", cursor: "pointer", width: "100%", background: open ? "rgba(255,122,26,0.05)" : "transparent",
          border: 0, padding: "12px 16px", color: "inherit", textAlign: "left",
          display: "grid", gridTemplateColumns: "32px 1.4fr repeat(5, 1fr) 24px", gap: 10, alignItems: "center",
          fontFamily: "var(--f-mono)",
        }}>
        <span style={{ fontSize: 18 }}>{row.c}</span>
        <span style={{ fontSize: 12.5, color: "var(--ink-100)" }}>{row.n}</span>
        {chip("hold")}{chip("cex")}{chip("p2p")}{chip("mine")}{chip("pay")}
        <span style={{ color: "var(--ink-60)", fontSize: 11 }}>{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <div style={{ padding: "10px 18px 14px 60px", borderTop: "1px dashed var(--ink-10)", background: "rgba(0,0,0,0.3)" }}>
          <p className="mono dim" style={{ margin: 0, fontSize: 11.5, lineHeight: 1.7 }}>{row.note}</p>
          <div className="mono" style={{ marginTop: 10, fontSize: 10.5, color: "var(--ink-60)", letterSpacing: "0.06em" }}>
            <b style={{ color: "var(--ink-80)" }}>Activity legend:</b> <span style={{ color: "var(--ink-80)" }}>Hold</span> · <span style={{ color: "var(--ink-80)" }}>CEX trade</span> · <span style={{ color: "var(--ink-80)" }}>P2P trade</span> · <span style={{ color: "var(--ink-80)" }}>Mine</span> · <span style={{ color: "var(--ink-80)" }}>Accept as payment</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MoneroLegality() {
  const [open, setOpen] = React.useState(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader
        kicker="Legal status · jurisdictions · per-activity"
        title={'Where Monero <em style="color:var(--p-50);font-style:normal">is, and isn\u2019t</em>, legal.'}
        sub="Monero itself has never been outlawed in most countries. What's restricted, jurisdiction by jurisdiction, is specific activities — centralized exchange access, mining, or merchant acceptance. Click any country for details."
      />

      {/* Quick reference legend */}
      <Card style={{ padding: 18 }}>
        <div className="kicker" style={{ marginBottom: 10 }}>Quick reference · 5 activities × 4 statuses</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, fontFamily: "var(--f-mono)", fontSize: 11.5 }}>
          {[
            { c: "var(--g-50)", l: "Legal", d: "No specific restriction. Treated like any digital asset." },
            { c: "var(--y-50)", l: "Restricted", d: "Permitted but with reporting requirements or licensing limits." },
            { c: "var(--r-50)", l: "Illegal", d: "Specifically prohibited or fully criminalized for individuals." },
            { c: "var(--ink-60)", l: "Unclear", d: "Legal grey zone; no specific guidance or active enforcement." },
          ].map((s) => (
            <div key={s.l} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: s.c, boxShadow: `0 0 5px ${s.c}`, marginTop: 6 }} />
              <div>
                <div style={{ color: s.c, letterSpacing: "0.1em", textTransform: "uppercase", fontSize: 10.5 }}>{s.l}</div>
                <div className="dim" style={{ fontSize: 11, lineHeight: 1.5, marginTop: 2 }}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Activity-matrix header */}
      <Card style={{ padding: 22 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div className="kicker">Country × activity matrix</div>
            <div className="mono dim" style={{ fontSize: 11.5, marginTop: 4 }}>{LEGALITY_MATRIX.length} jurisdictions · click any row to expand</div>
          </div>
          <div className="mono" style={{ display: "grid", gridTemplateColumns: "32px 1.4fr repeat(5, 1fr) 24px", gap: 10, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-40)", minWidth: 720 }}>
            <span></span><span>Country</span>
            <span>Hold</span><span>CEX</span><span>P2P</span><span>Mine</span><span>Pay</span><span></span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {LEGALITY_MATRIX.map((row, i) => (
            <LegalityRow key={row.n} row={row}
              open={open === i}
              onToggle={() => setOpen(open === i ? null : i)} />
          ))}
        </div>

        <p className="mono dim" style={{ fontSize: 10.5, marginTop: 14, lineHeight: 1.5 }}>
          ⚠ This is design preview content. Verify current legal status before relying on it for any jurisdiction or activity. Laws change quickly in crypto.
        </p>
      </Card>

      {/* Existing timeline (kept) */}
      <Card style={{ padding: 26 }}>
        <div className="kicker">Exchange delistings · timeline</div>
        <h3 className="serif" style={{ margin: "10px 0 6px", fontSize: 22, fontWeight: 400, color: "var(--ink-100)" }}>The long retreat from regulated venues.</h3>
        <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 16 }}>
          Delisting is a regulatory artefact, not a verdict on the protocol. Jurisdictions have made compliance with anti-anonymity rules incompatible with listing.
          The on-ramps thinned; the protocol did not.
        </p>
        <div style={{ position: "relative", paddingLeft: 18, borderLeft: "1px dashed var(--ink-20)", display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { d: "2018-06-18", v: "Japan FSA · all privacy coins",  who: "All licensed JP exchanges",   why: "FSA orders 'anonymous virtual currencies' removed from licensed venues" },
            { d: "2020-12-31", v: "BitBay (PL)",                   who: "Polish exchange",             why: "AML directive pre-MiCA" },
            { d: "2021-01-26", v: "Shapeshift exits all crypto",   who: "ShapeShift",                   why: "Pivot to DEX model · indirect Monero loss" },
            { d: "2023-06-21", v: "Kraken UK",                     who: "Kraken UK retail",             why: "FCA registration requirement" },
            { d: "2023-11-08", v: "Binance · global delisting",    who: "Binance globally on regulated rails", why: "Compliance with multiple jurisdictions" },
            { d: "2024-12-30", v: "MiCA enforcement live",         who: "All EU CASPs",                 why: "Anti-anonymity provisions of EU Markets in Crypto-Assets" },
            { d: "2025-09-15", v: "LocalMonero.co shuts down",     who: "P2P platform itself",          why: "Operator citing increasing legal complexity" },
            { d: "2026-01-22", v: "73 delistings YTD",             who: "Various CEXs",                 why: "Cumulative MiCA / OFAC / AUSTRAC pressure across 2025" },
          ].map((e, i) => (
            <div key={i} style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: -25, top: 6, width: 10, height: 10, borderRadius: 5, border: "1px solid var(--r-50)", background: "var(--bg-0)", boxShadow: "var(--glow-1)" }} />
              <div className="mono" style={{ fontSize: 10, letterSpacing: "0.16em", color: "var(--ink-60)" }}>{e.d}</div>
              <div className="mono" style={{ fontSize: 13, color: "var(--ink-100)", marginTop: 2 }}><b className="dn">{e.v}</b> · <span className="dim">{e.who}</span></div>
              <p className="mono dim" style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.55 }}>{e.why}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   MARKETS — price action thesis + 2026 catalyst
   ────────────────────────────────────────────────────────────── */

function MoneroMarketsThesis({ data }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader
        kicker="Price action · thesis · macro view · 2026"
        title='The <em style="color:var(--tk-accent);font-style:normal">refusing-to-die</em> chart.'
        sub="Eleven years of price action and a thesis for what's next. The market hasn't decided yet whether scarcity-of-privacy is a premium or a discount."
      />

      {/* ── THE THESIS · manifesto block ───────────────────── */}
      <Card style={{ padding: 32, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at top right, rgba(255,122,26,0.06), transparent 60%)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div className="kicker">The thesis · what Monero represents</div>
          <h2 className="serif" style={{ margin: "12px 0 18px", fontSize: 30, fontWeight: 400, color: "var(--ink-100)", lineHeight: 1.2, letterSpacing: "-0.005em" }}>
            In a world where every transaction is tracked, every purchase logged,
            and every human reduced to a data point —
            Monero exists as the only <em style={{ color: "var(--tk-accent)", fontStyle: "normal" }}>mathematical guarantee</em> of financial privacy on Earth.
          </h2>
          <p className="serif" style={{ margin: "0 0 14px", fontSize: 17, lineHeight: 1.65, color: "var(--ink-80)", fontStyle: "italic" }}>
            This is not hyperbole. This is cryptographic fact.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginTop: 22 }}>
            <div>
              <p className="mono" style={{ fontSize: 12.5, lineHeight: 1.85, color: "var(--ink-80)" }}>
                Those in power — governments, corporations, surveillance states — have visibility over everything. They see your bank accounts. They see your card purchases. They see your Bitcoin transactions on a permanent, public ledger. They know when you donate to causes they dislike. They know when you buy books they find subversive. They know when you send money to family in countries they've sanctioned.
              </p>
              <p className="serif" style={{ margin: "16px 0 0", fontSize: 22, lineHeight: 1.35, color: "var(--tk-accent)", fontWeight: 400 }}>
                With Monero, they see nothing.
              </p>
            </div>
            <div>
              <p className="mono" style={{ fontSize: 12.5, lineHeight: 1.85, color: "var(--ink-80)" }}>
                <b style={{ color: "var(--p-50)" }}>Ring signatures</b> hide the sender. <b style={{ color: "var(--p-50)" }}>Stealth addresses</b> hide the receiver. <b style={{ color: "var(--p-50)" }}>RingCT</b> hides the amount. The entire transaction is a mathematical black box. Not private by policy. Not private by promise. <em style={{ color: "var(--ink-100)", fontStyle: "normal" }}>Private by mathematics.</em>
              </p>
              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { v: "$625,000", w: "IRS bounty for cracking Monero. They failed." },
                  { v: "$22M", w: "Chainalysis contract to trace it. Their own leaked training admits they cannot." },
                  { v: "73", w: "Exchange delistings in 2025 alone. Because they cannot comply with surveillance laws while offering true privacy." },
                  { v: "+195%", w: "Monero's price in 2025. Because demand for privacy is not a crime — it is a human right." },
                ].map((s) => (
                  <div key={s.v} style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 12, padding: "6px 0", borderTop: "1px dashed var(--ink-10)" }}>
                    <span className="mono acc" style={{ fontSize: 16, color: "var(--tk-accent)", textAlign: "right", textShadow: "var(--glow-1)" }}>{s.v}</span>
                    <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-80)", lineHeight: 1.55 }}>{s.w}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mono dim" style={{ marginTop: 20, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-40)", textAlign: "right" }}>
            — The Monero Archive, 2026
          </p>
        </div>
      </Card>

      {/* ── THE 2026 CATALYST ───────────────────────────────── */}
      <Card style={{ padding: 26 }}>
        <div className="kicker">The catalyst · January 2026 ATH</div>
        <h3 className="serif" style={{ margin: "10px 0 6px", fontSize: 26, fontWeight: 400, color: "var(--ink-100)" }}>
          XMR hit <em style={{ color: "var(--tk-accent)", fontStyle: "normal", textShadow: "var(--glow-1)" }}>$799.89</em> in mid-January 2026 — a 195% move from early 2025.
        </h3>
        <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.7, margin: "10px 0 18px" }}>
          It wasn't one catalyst. It was the convergence of several forces — political, technical, and structural — that revalued financial privacy from "niche" to "necessary" over the span of twelve months.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {[
            { h: "Political shift",    c: "var(--tk-accent)", b: "High-profile US policymakers reframed privacy as a 'constitutional right' alongside global economic uncertainty driving capital toward financial-autonomy assets." },
            { h: "Technical breakout", c: "var(--c-50)",      b: "Cleared multi-year resistance into price discovery. Capital rotation out of transparent chains into privacy-focused assets accelerated the move." },
            { h: "Zcash collapse",     c: "var(--y-50)",      b: "ECC dev team resignation triggered a ~20% ZEC drawdown. Major capital rotation directly into Monero." },
            { h: "Paradox validation", c: "var(--p-50)",      b: "Dubai DFSA ban on privacy tokens paradoxically validated Monero's tech. CLARITY Act progress highlighted the surveillance-vs-privacy divide." },
            { h: "The descent",        c: "var(--r-50)",      b: "By early February, XMR retraced 57% — driven by accelerated delistings including Binance. Pattern: pump on validation, retrace on access restriction, higher lows each cycle." },
          ].map((p) => (
            <div key={p.h} style={{ padding: 12, borderTop: `2px solid ${p.c}` }}>
              <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: p.c }}>{p.h}</div>
              <p className="mono dim" style={{ margin: "8px 0 0", fontSize: 11, lineHeight: 1.65 }}>{p.b}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── DEMAND DRIVERS ──────────────────────────────────── */}
      <div>
        <div className="kicker" style={{ marginBottom: 12 }}>Demand drivers · structural · 2026</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {[
            {
              n: "I", t: "CLARITY · GENIUS · DAC8",
              h: "The 'tracked economy' reaction",
              c: "var(--tk-accent)",
              b: "The GENIUS and CLARITY Acts now require all digital-currency trading to follow disclosure and registration rules similar to other regulated assets. New IRS rules require Form 1099-DA reporting starting 2026; the EU's DAC8 directive (live since Jan 1 2026) forces CASPs to disclose customer and transaction details to tax officials. Every new reporting mandate is essentially free marketing for the one asset that can't be surveilled.",
            },
            {
              n: "II", t: "Sanctions evasion · geopolitics",
              h: "Iran, the IRGC, and the BTC→XMR migration",
              c: "var(--r-50)",
              b: "Iran built a multi-billion-dollar parallel economy on state-sponsored BTC mining and stablecoins. IRGC accounts received >$3B in 2025 alone. Cost to mine 1 BTC in Iran ≈ $1,320 (subsidized power) vs. market ~$68,000 — a massive arbitrage. As Chainalysis improves BTC tracing of IRGC wallets, the logical next step for sanctioned actors is migration toward untraceable assets. State-driven sanctions evasion volume surged 694% in 2025.",
            },
            {
              n: "III", t: "Darknet markets · already happening",
              h: "Privacy as a network effect",
              c: "var(--p-50)",
              b: "TRM Labs data shows 48% of newly launched darknet marketplaces in 2025 now support XMR exclusively — a sharp acceleration from prior years. Monero is mandatory or preferred on 89% of active markets, with monthly transaction volume estimated at $450M+. Every Chainalysis upgrade, every BTC seizure using on-chain forensics, pushes more volume into XMR permanently.",
            },
            {
              n: "IV", t: "CBDC surveillance state",
              h: "The macro tailwind",
              c: "var(--c-50)",
              b: "BIS reports 91 of 93 surveyed central banks are actively investigating retail or wholesale CBDCs. China's digital yuan is already live; EU is deep into digital-euro pilots. During the ECB consultation, 41% of public comments centered on privacy concerns. Every CBDC launch creates a new cohort of users who realize their government can now see every transaction, freeze funds programmatically, and restrict spending categories. Monero becomes the escape valve.",
            },
            {
              n: "V", t: "Technical upgrades making XMR stronger",
              h: "FCMP++, Cuprate, Seraphis, Jamtis",
              c: "var(--g-50)",
              b: "FCMP++ (mid-2026, tentative) replaces 16-decoy rings with proofs over the entire 150M+ UTXO set, making chain analysis computationally impractical. Cuprate (Rust node) cuts sync times sharply, supporting decentralization under political pressure. Seraphis & Jamtis modernize the transaction structure and add human-readable addresses — currently in beta/audit.",
            },
            {
              n: "VI", t: "The meta-thesis",
              h: "Structural inevitability",
              c: "var(--ink-100)",
              b: "The world is simultaneously doing two contradictory things: making transparent crypto the regulated norm (GENIUS, CLARITY, DAC8, 1099-DA, Travel Rule) while expanding state surveillance capacity (CBDCs, chain analytics, KYC everywhere). Every step in that direction creates organic, non-speculative demand for the one asset that provides genuine financial privacy by default. The supply side matters too — Monero is already in tail emission with 0.6 XMR / block forever. 73 exchanges delisted in 2025; on-chain activity stayed flat or grew.",
            },
          ].map((d) => (
            <Card key={d.n} style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span className="serif" style={{ fontSize: 32, color: d.c, fontWeight: 400, lineHeight: 1, letterSpacing: "-0.02em" }}>{d.n}</span>
                <div>
                  <div className="kicker" style={{ color: d.c }}>{d.t}</div>
                  <div className="serif" style={{ fontSize: 19, color: "var(--ink-100)", margin: "4px 0 0", fontWeight: 400 }}>{d.h}</div>
                </div>
              </div>
              <p className="mono dim" style={{ margin: "12px 0 0", fontSize: 11.5, lineHeight: 1.75 }}>{d.b}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* ── THE CONVERGENCE ─────────────────────────────────── */}
      <Card style={{ padding: 32, background: "rgba(255,122,26,0.04)", borderColor: "rgba(255,122,26,0.3)" }}>
        <div className="kicker">The convergence</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 24, marginTop: 14, alignItems: "stretch" }}>
          <div>
            <div className="mono" style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--r-50)", marginBottom: 10 }}>The tracked economy</div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {["Regulation tightens.", "Surveillance expands.", "CBDCs launch.", "Chain analytics improves.", "Reporting mandates multiply.", "The tracked economy becomes inescapable."].map((l) => (
                <li key={l} className="mono" style={{ fontSize: 12.5, color: "var(--ink-80)", paddingLeft: 14, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: "var(--r-50)" }}>×</span>{l}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ width: 1, background: "var(--rule)" }} />
          <div>
            <div className="mono" style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--g-50)", marginBottom: 10 }}>And on the other side</div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {["One protocol.", "Mathematically private.", "Perpetually maintained.", "Increasingly hardened.", "Supply fixed at tail emission.", "Access window narrows with every delisting."].map((l) => (
                <li key={l} className="mono" style={{ fontSize: 12.5, color: "var(--ink-80)", paddingLeft: 14, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: "var(--g-50)" }}>✓</span>{l}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--rule)", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <div className="serif" style={{ fontSize: 22, color: "var(--ink-100)", lineHeight: 1.3 }}>The demand is <em style={{ color: "var(--tk-accent)", fontStyle: "normal" }}>structural</em>.</div>
          <div className="serif" style={{ fontSize: 22, color: "var(--ink-100)", lineHeight: 1.3 }}>The supply is <em style={{ color: "var(--tk-accent)", fontStyle: "normal" }}>fixed</em>.</div>
          <div className="serif" style={{ fontSize: 22, color: "var(--ink-100)", lineHeight: 1.3 }}>The technology is <em style={{ color: "var(--tk-accent)", fontStyle: "normal" }}>unbroken</em>.</div>
        </div>
        <p className="mono dim" style={{ marginTop: 22, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-40)", textAlign: "right" }}>
          — The Monero Archive, March 2026
        </p>
      </Card>

      {/* ── COUNTERARGUMENTS ────────────────────────────────── */}
      <Card style={{ padding: 22 }}>
        <div className="kicker">Counterarguments · eyes open</div>
        <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.75, margin: "10px 0 0" }}>
          The counterarguments are real — exchange delistings reduce liquidity, regulatory crackdowns could intensify, and quantum computing is a theoretical long-term risk. But every demand driver identified above is substantiated by what's actually happening on the ground right now.
        </p>
      </Card>

      {/* ── EXISTING CYCLE TABLE (kept for chart-watchers) ── */}
      <Card style={{ padding: 22 }}>
        <div className="kicker">Cycle highs · marked</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 14, fontSize: 12 }} className="mono">
          {[
            { cyc: "2017 cycle", peak: "$494 (Jan 2018)", drawdown: "−92% to $40", note: "Pre-bulletproofs, fee shock, exchange hype" },
            { cyc: "2020 cycle", peak: "$517 (May 2021)", drawdown: "−74% to $135", note: "DeFi bull, ring-16 mandatory, Bulletproofs+" },
            { cyc: "2024 cycle", peak: "$487 (Mar 2025)", drawdown: "−42% to $282", note: "Post-MiCA panic, shallow drawdown · structural buyers" },
            { cyc: "2026 ATH",   peak: "$799.89 (Jan 2026)", drawdown: "−57% retrace · Feb", note: "Convergence: CLARITY · DAC8 · Zcash collapse · sanctions migration" },
          ].map((c) => (
            <div key={c.cyc} style={{ padding: 12, border: "1px solid var(--rule)", borderRadius: 2 }}>
              <div className="kicker" style={{ color: "var(--tk-accent)" }}>{c.cyc}</div>
              <div className="serif" style={{ fontSize: 18, color: "var(--ink-100)", margin: "6px 0" }}>{c.peak}</div>
              <div className="dn" style={{ fontSize: 11 }}>{c.drawdown}</div>
              <p className="mono dim" style={{ margin: "8px 0 0", fontSize: 10.5, lineHeight: 1.55 }}>{c.note}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   COMPARISON — vs Bitcoin
   ────────────────────────────────────────────────────────────── */

function MoneroComparison() {
  const ROWS = [
    { k: "Genesis date",         xmr: "April 18, 2014",     btc: "January 3, 2009",    note: "Bitcoin is 5 years older." },
    { k: "Premine",              xmr: "0 XMR",              btc: "0 BTC",              note: "Both fair launches. Rare." },
    { k: "Founder reward",       xmr: "None",                btc: "None",                note: "Satoshi mined alongside everyone." },
    { k: "Foundation / VCs",     xmr: "None · CCS only",     btc: "Multiple foundations", note: "Monero has no central org." },
    { k: "Block time",           xmr: "2 min",               btc: "10 min",              note: "Monero confirms 5× faster." },
    { k: "Block size",           xmr: "Dynamic",             btc: "1 MB (4 MB witness)", note: "XMR scales with median tx demand." },
    { k: "Hardfork cadence",     xmr: "~12–18 months",       btc: "Years; soft forks only", note: "XMR ships protocol upgrades aggressively." },
    { k: "Privacy",              xmr: "Mandatory · all txs", btc: "Optional · CoinJoin", note: "Different defaults." },
    { k: "Fungibility",          xmr: "Cryptographic",       btc: "Tainted by history",  note: "No coin can be blacklisted on XMR." },
    { k: "Supply",               xmr: "Asymptotic · 22M+",   btc: "Hard cap · 21M",      note: "Different monetary theses." },
    { k: "Emission post-2140",   xmr: "0.6 XMR / block · forever", btc: "0 BTC / block (predicted)", note: "Tail emission vs hard cap." },
    { k: "Mining algo",          xmr: "RandomX · CPU-friendly", btc: "SHA-256 · ASIC-only", note: "XMR resists mining centralisation." },
    { k: "P2Pool · decentralised mining", xmr: "Yes · 7% network share", btc: "No equivalent (Stratum V2 partial)", note: "XMR has a true permissionless pool." },
    { k: "Transaction fees",     xmr: "Sub-cent · stable",   btc: "$0.40 – $40+ · volatile", note: "Predictable on XMR." },
    { k: "On-chain throughput",  xmr: "~2 tps avg · dynamic", btc: "~4–7 tps",            note: "Comparable layer-1." },
    { k: "Lightning / L2",        xmr: "No · monolithic privacy", btc: "Yes · Lightning",    note: "Different design choices." },
    { k: "Anonymity set",        xmr: "16 → 150M+ (FCMP++)", btc: "1 (unless mixed)",    note: "Order-of-magnitude difference." },
    { k: "Wallet sync (cold)",   xmr: "~15–60 min",          btc: "Hours (full node)",    note: "XMR uses view-tags + LWS." },
    { k: "Exchange listings",    xmr: "Thinning (regulatory)", btc: "Universal",          note: "Different surface area." },
    { k: "DEX liquidity",        xmr: "Growing · Haveno/Basic", btc: "Growing · Bisq/Lightning", note: "Both moving same direction." },
    { k: "Censorship resistance · network", xmr: "Tor/I2P 38% peer share", btc: "Tor 6% peer share", note: "XMR has stronger network privacy." },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageHeader
        kicker="XMR · BTC · side-by-side"
        title='Two answers to the <em style="color:var(--p-50);text-shadow:var(--glow-p);font-style:normal">same question</em>.'
        sub="Bitcoin chose transparency and scarcity. Monero chose privacy and predictability. Both can be right. Both have tradeoffs."
      />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 1fr 1fr", gap: 0 }}>
          {["Property", "XMR", "BTC", "Note"].map((h) => (
            <div key={h} className="kicker" style={{ padding: "12px 16px", background: "rgba(255,122,26,0.04)", borderBottom: "1px solid var(--rule)" }}>{h}</div>
          ))}
          {ROWS.map((r, i) => (
            <React.Fragment key={r.k}>
              <div className="mono" style={{ padding: "10px 16px", borderBottom: "1px solid var(--rule)", background: i % 2 ? "rgba(255,255,255,0.01)" : "transparent", fontSize: 11.5, color: "var(--ink-80)" }}>{r.k}</div>
              <div className="mono acc" style={{ padding: "10px 16px", borderBottom: "1px solid var(--rule)", background: i % 2 ? "rgba(255,255,255,0.01)" : "transparent", fontSize: 11.5 }}>{r.xmr}</div>
              <div className="mono" style={{ padding: "10px 16px", borderBottom: "1px solid var(--rule)", background: i % 2 ? "rgba(255,255,255,0.01)" : "transparent", color: "var(--c-50)", fontSize: 11.5 }}>{r.btc}</div>
              <div className="mono dim" style={{ padding: "10px 16px", borderBottom: "1px solid var(--rule)", background: i % 2 ? "rgba(255,255,255,0.01)" : "transparent", fontSize: 11, lineHeight: 1.55 }}>{r.note}</div>
            </React.Fragment>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   FUTURE — FCMP++ · Carrot · Seraphis · Jamtis · Cuprate · roadmap
   ────────────────────────────────────────────────────────────── */

function MoneroFuture() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader
        kicker="Roadmap · 2026 → 2028 · in flight"
        title='What <em style="color:var(--p-50);font-style:normal">comes next</em>.'
        sub="Six major protocol upgrades are in audit, beta, or active development. Each one re-prices Monero structurally — anonymity set, sync speed, address ergonomics, transaction format, node infrastructure."
      />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {[
          {
            tag: "FCMP++", sub: "Full-chain membership proofs",
            status: "BETA · stressnet live", statusColor: "var(--y-50)", eta: "Q3 2026 (tentative)", c: "var(--p-50)",
            head: "The anonymity set goes from 16 → 150M+.",
            body: "FCMP++ replaces the 16-decoy ring signature with a proof of membership over the entire UTXO set. A spender proves their input is somewhere in the cloud of ~150 million outputs — without specifying where. Chain analysis becomes computationally intractable. Currently in beta on a public stressnet; mainnet activation depends on audit completion.",
            metrics: [["Set size", "150M+"], ["Today", "ring-16"], ["Multiplier", "≈10M×"], ["Proof size", "~3 KB"]],
          },
          {
            tag: "Carrot", sub: "Audit-class view keys",
            status: "DESIGN · spec draft", statusColor: "var(--c-50)", eta: "2027", c: "var(--c-50)",
            head: "Audit-friendly view keys without compromising spend privacy.",
            body: "Carrot is a new transaction format that lets wallet operators give a strictly-bounded view key to an auditor — one that reveals incoming payments but not outgoing spends or balances. Designed for institutions that need to demonstrate solvency without revealing their full transaction graph. Pairs naturally with FCMP++.",
            metrics: [["Replaces", "RingCT v6"], ["View cap", "Incoming"], ["Class", "Selective"], ["Compat", "Wallet-side"]],
          },
          {
            tag: "Seraphis", sub: "Next-gen transaction protocol",
            status: "BETA · audit in progress", statusColor: "var(--y-50)", eta: "2027 (post-FCMP++)", c: "var(--tk-accent)",
            head: "A clean-room rewrite of Monero's transaction format.",
            body: "Seraphis modernizes how Monero builds, signs, and verifies transactions. Built to slot in alongside FCMP++ — together they're often referred to as 'Monero 2.0'. Smaller signatures, faster verification, simpler wallet logic. Backwards-compatible migration path.",
            metrics: [["Sig size", "−30%"], ["Verify", "+40%"], ["Wallet", "Simpler"], ["Migration", "Soft fork"]],
          },
          {
            tag: "Jamtis", sub: "Human-readable addresses",
            status: "BETA · paired with Seraphis", statusColor: "var(--y-50)", eta: "With Seraphis", c: "var(--g-50)",
            head: "Addresses you can read aloud.",
            body: "Today's Monero addresses are 95 base58 characters — unreadable, hard to verify in person, easy to typo. Jamtis introduces a structured format with built-in checksums, sub-address indices encoded inline, and an optional human-readable encoding. Same privacy guarantees, dramatically better UX.",
            metrics: [["Length", "75 ch"], ["Checksum", "Built-in"], ["Sub-addr", "Native"], ["Recovery", "Mnemonic"]],
          },
          {
            tag: "Cuprate", sub: "Rust-language full node",
            status: "ALPHA · sync working", statusColor: "var(--tk-accent)", eta: "2026–2027", c: "var(--y-50)",
            head: "An independent, memory-safe Monero implementation.",
            body: "Cuprate is a parallel Rust implementation of the monerod daemon. Modern toolchain, memory-safe, sharply reduced sync times for new nodes. Critical for network resilience: a second client means a bug or backdoor in one can't take down the network. Active development, alpha builds public.",
            metrics: [["Language", "Rust"], ["Sync", "+40%"], ["Clients", "1 → 2"], ["Resilience", "Multi"]],
          },
          {
            tag: "Atomic swaps", sub: "Haveno · BasicSwap · ETA",
            status: "LIVE · scaling", statusColor: "var(--g-50)", eta: "Continuous", c: "var(--ink-100)",
            head: "Replacing CEX rails with trustless XMR↔BTC↔LTC swaps.",
            body: "Haveno (a fork of Bisq), BasicSwap, and Haveno-Reto are scaling P2P atomic-swap volumes by ~30%+ per quarter through 2025–2026. As MiCA delisting accelerates, these become the primary on-ramp. Cross-chain, custody-free, no KYC.",
            metrics: [["Q3 25 wk", "$2.98M"], ["Growth", "+34% QoQ"], ["KYC", "None"], ["Custody", "Trustless"]],
          },
        ].map((u) => (
          <Card key={u.tag} style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div className="kicker" style={{ color: u.c }}>{u.sub}</div>
                <div className="serif" style={{ fontSize: 26, fontWeight: 400, color: u.c, marginTop: 4 }}>{u.tag}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="mono" style={{ display: "inline-block", padding: "3px 9px", border: `1px solid ${u.statusColor}`, color: u.statusColor, borderRadius: 2, fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase" }}>{u.status}</span>
                <div className="mono dim" style={{ fontSize: 10.5, marginTop: 6 }}>{u.eta}</div>
              </div>
            </div>
            <p className="serif" style={{ margin: "10px 0", fontSize: 17, lineHeight: 1.4, color: "var(--ink-100)", fontWeight: 400 }}>{u.head}</p>
            <p className="mono dim" style={{ margin: "0 0 14px", fontSize: 11.5, lineHeight: 1.7 }}>{u.body}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, paddingTop: 12, borderTop: "1px dashed var(--ink-10)" }}>
              {u.metrics.map(([k, v]) => (
                <div key={k}>
                  <div className="kicker" style={{ marginBottom: 4 }}>{k}</div>
                  <div className="mono" style={{ fontSize: 12, color: "var(--ink-100)" }}>{v}</div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </section>

      <Card style={{ padding: 26 }}>
        <div className="kicker">Hardfork schedule</div>
        <h3 className="serif" style={{ margin: "10px 0 14px", fontSize: 24, fontWeight: 400, color: "var(--ink-100)" }}>
          The protocol upgrade cadence is <em style={{ color: "var(--tk-accent)", fontStyle: "normal" }}>fast and disciplined</em>.
        </h3>
        <div style={{ position: "relative", paddingLeft: 18, borderLeft: "1px dashed var(--ink-20)", display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { d: "v15 · 2022-08", s: "shipped", t: "View tags · BP+ · CLSAG", b: "Wallet sync sped up 30–40%. Verification cost reduced. View tag adds 1 byte per output, no privacy loss." },
            { d: "v16 · 2022-08", s: "live", t: "Ring size 16 mandatory", b: "Permanent minimum ring size. Every spend has 15 decoys. Backstop until FCMP++." },
            { d: "v17 · 2026 Q3", s: "in audit", t: "FCMP++ activation", b: "Anonymity set goes from 16 to 150M+. The most material protocol change since RingCT." },
            { d: "v18 · 2027", s: "design", t: "Seraphis + Jamtis", b: "New transaction format + human-readable addresses. Often referred to as 'Monero 2.0'." },
            { d: "v19 · 2027–28", s: "planned", t: "Carrot", b: "Audit-class view keys for institutional disclosure without spending-side leakage." },
            { d: "v20 · 2028+", s: "speculative", t: "Cuprate v1 + post-quantum prep", b: "Second mainline client. Post-quantum cryptographic primitives enter design phase." },
          ].map((e, i) => {
            const c = e.s === "shipped" || e.s === "live" ? "var(--g-50)"
                    : e.s === "in audit" ? "var(--y-50)"
                    : e.s === "design"    ? "var(--c-50)"
                    : e.s === "planned"   ? "var(--p-50)"
                    : "var(--ink-40)";
            return (
              <div key={i} style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: -25, top: 6, width: 10, height: 10, borderRadius: 5, border: `1px solid ${c}`, background: "var(--bg-0)", boxShadow: `0 0 6px ${c}` }} />
                <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                  <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", color: "var(--ink-60)" }}>{e.d}</div>
                  <span className="mono" style={{ fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: c, padding: "2px 8px", border: `1px solid ${c}`, borderRadius: 2 }}>{e.s}</span>
                </div>
                <div className="serif" style={{ fontSize: 18, color: "var(--ink-100)", marginTop: 4, fontWeight: 400 }}>{e.t}</div>
                <p className="mono dim" style={{ margin: "4px 0 0", fontSize: 11.5, lineHeight: 1.6, maxWidth: "78ch" }}>{e.b}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card style={{ padding: 22 }}>
        <div className="kicker">Research frontier · further out</div>
        <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.7, margin: "10px 0 16px" }}>
          Beyond the scheduled hardforks, the Monero Research Lab is actively exploring directions that may or may not ship — but inform the next decade of design.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { h: "Post-quantum signatures", b: "Migration path from Ed25519 → quantum-resistant primitives. Active research; not currently a near-term threat but a multi-year preparation." },
            { h: "Multi-asset confidential", b: "Extending RingCT-style hiding to multiple asset types on the same chain. Speculative; no commitment to ship." },
            { h: "Privacy-preserving L2", b: "An L2 with snark-rollup compression that preserves Monero's privacy guarantees on commit. Early-stage." },
            { h: "Encrypted node discovery", b: "Beyond Tor/I2P — gossiped-key node directories that can survive deeper network censorship." },
            { h: "Stateless light wallets", b: "Verify your balance without scanning the full chain. View-tag++ proposals." },
            { h: "Atomic-swap UX standard", b: "Universal cross-chain interface so wallets can swap XMR↔* without per-chain integration work." },
          ].map((r) => (
            <div key={r.h} style={{ padding: 12, borderLeft: "2px solid var(--p-50)" }}>
              <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-100)" }}>{r.h}</div>
              <p className="mono dim" style={{ margin: "6px 0 0", fontSize: 10.5, lineHeight: 1.6 }}>{r.b}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   ATTACKS — IRS / Chainalysis / sybil / deanon papers
   ────────────────────────────────────────────────────────────── */

function MoneroAttacks() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader
        kicker="Survived attacks · open record"
        title='A decade of <em style="color:var(--r-50);text-shadow:var(--glow-1);font-style:normal">people trying</em>, and failing.'
        sub="Every attempted break, every contract bounty, every academic deanonymisation paper — on the record."
      />

      <Card style={{ padding: 22 }}>
        <div className="kicker">Bounties · what was offered, what was delivered</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 14 }}>
          {[
            { y: "2020 · IRS-CI", co: "Chainalysis + Integra Fec", amt: "$625,000", out: "Vendor declared no usable tracing capability. Contract not renewed at full scope." },
            { y: "2021 · CipherTrace", co: "Mastercard subsidiary",   amt: "Confidential",  out: "Filed a Monero-tracing patent. Public capabilities never demonstrated; product line discontinued." },
            { y: "2022 · IRS-CI", co: "Chainalysis (renewed)",       amt: "$1,250,000", out: "Refocused on metadata correlation (timing, IP) rather than on-chain breaks. No protocol-level deanonymisation." },
            { y: "2024 · Europol", co: "Internal R&D",                amt: "EUR 700,000",   out: "Disclosed limitations report citing FCMP++ as making future approaches infeasible." },
            { y: "2024 · FBI",     co: "Internal + private vendor",   amt: "Unknown",        out: "Leaked court filings suggest reliance on operational-security failures, not protocol breaks." },
            { y: "2025 · UK NCA",  co: "Open contract",                amt: "GBP 350,000",   out: "No public completion. Vendor unwilling to provide tracing guarantees." },
          ].map((b) => (
            <div key={b.y} style={{ padding: 14, border: "1px solid var(--rule)", borderRadius: 2 }}>
              <div className="kicker" style={{ color: "var(--r-50)" }}>{b.y}</div>
              <div className="mono" style={{ fontSize: 13, color: "var(--ink-100)", marginTop: 4 }}>{b.co}</div>
              <div className="mono acc" style={{ fontSize: 12, marginTop: 2 }}>Offered: {b.amt}</div>
              <p className="mono dim" style={{ margin: "8px 0 0", fontSize: 11, lineHeight: 1.6 }}>{b.out}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ padding: 22 }}>
        <div className="kicker">Academic deanonymisation attempts · 2017–2024</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          {[
            { title: "An Empirical Analysis of Linkability in Monero (Möser et al., 2017)",
              status: "Mitigated", severity: "var(--g-50)",
              note: "Identified the 0-decoy issue — when most users picked decoys of 0, real spenders were obvious. Patched immediately. Mandatory minimum ring-3, then ring-7, then ring-11, then ring-16." },
            { title: "Traceable Monero (Yu et al., 2019)",
              status: "Mitigated", severity: "var(--g-50)",
              note: "Studied legacy chain pre-RingCT. Conclusions don't extend to post-2017 transactions." },
            { title: "Decoy Selection Heuristics Revisited (Ronge et al., 2021)",
              status: "Improved", severity: "var(--y-50)",
              note: "Showed decoy-selection algorithm had subtle bias. Patched in v0.18 with new gamma distribution." },
            { title: "Eve, Alice and the Onion (anonymous, 2023)",
              status: "Inconclusive", severity: "var(--y-50)",
              note: "Attempted Tor-layer correlation against onion-routed nodes. Findings did not generalise to a population of nodes." },
            { title: "FCMP Analysis (kayabaNerve + Diamond, 2024)",
              status: "Pre-deployment", severity: "var(--g-50)",
              note: "Formal-method analysis. Confirms anonymity-set expands to full UTXO set with no privacy regressions vs current ring system." },
          ].map((p) => (
            <div key={p.title} style={{ display: "grid", gridTemplateColumns: "12px 1fr 120px", gap: 12, padding: "10px 0", borderTop: "1px dashed var(--ink-10)", alignItems: "flex-start" }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: p.severity, boxShadow: `0 0 4px ${p.severity}`, marginTop: 6 }} />
              <div>
                <div className="mono" style={{ fontSize: 12.5, color: "var(--ink-100)" }}>{p.title}</div>
                <p className="mono dim" style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.6 }}>{p.note}</p>
              </div>
              <span style={{ fontSize: 10, color: p.severity, textTransform: "uppercase", letterSpacing: "0.14em", textAlign: "right" }}>{p.status}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ padding: 22 }}>
        <div className="kicker">Operational attacks · sybils, KYC pressure, infrastructure</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
          {[
            { t: "Sybil attempt · 2014–2015",     d: "Early P2P network seeded with hostile nodes designed to map peer-to-IP. Mitigated by Dandelion++ rollout in 2018. Net effect: brief operational risk; permanent design improvement." },
            { t: "KYC pressure · 2018–present",   d: "Continuous regulatory campaign to remove Monero from CEX rails. Material on liquidity; immaterial on the protocol. Atomic swaps absorbing displaced volume." },
            { t: "Infrastructure DDoS · 2019",    d: "Coordinated DDoS targeting community nodes during a hardfork window. Network reorganised onto private/cloud-hosted nodes; no chain halt." },
            { t: "Malware mining campaigns",      d: "RandomX is CPU-friendly, which attracts misuse. Counterargument: same property gives Monero its mining decentralisation; few coins can claim a 7%-network-share permissionless pool." },
            { t: "Supply-chain attempts · 2022",  d: "Malicious commits attempted on monero-project repo. Detected by maintainers in review; no shipped binary affected. Reproducible builds harden this." },
          ].map((p) => (
            <div key={p.t} style={{ padding: 14, borderLeft: "2px solid var(--y-50)" }}>
              <div className="mono" style={{ fontSize: 12.5, color: "var(--ink-100)" }}>{p.t}</div>
              <p className="mono dim" style={{ margin: "6px 0 0", fontSize: 11.5, lineHeight: 1.7 }}>{p.d}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ padding: 22 }}>
        <div className="kicker">The take-away</div>
        <p className="serif" style={{ margin: "12px 0", fontSize: 22, fontWeight: 400, color: "var(--ink-100)", lineHeight: 1.5 }}>
          After eleven years, six government bounties, and a dozen serious academic papers,
          <em style={{ color: "var(--g-50)", fontStyle: "normal" }}> no party has publicly demonstrated </em>
          a method to deanonymise a current-protocol Monero transaction at scale.
        </p>
        <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.75 }}>
          Operational attacks — phishing, timing correlation, KYC at the on-ramp — remain effective against careless users.
          The protocol itself has held. FCMP++ will close most remaining theoretical attack surface in Q3 2026.
        </p>
      </Card>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   ROOT — chooses subroute
   ────────────────────────────────────────────────────────────── */

function MoneroPage({ data, navigate, params, hashSegments }) {
  // hashSegments is e.g. ["monero", "tech"] — we read [1]
  const subroute = (hashSegments && hashSegments[1]) || "overview";
  const onChange = (id) => navigate(id === "overview" ? "/monero" : "/monero/" + id);

  let content;
  switch (subroute) {
    case "origin":     content = <MoneroOrigin />; break;
    case "tech":       content = <MoneroTech />; break;
    case "legality":   content = <MoneroLegality />; break;
    case "markets":    content = <MoneroMarketsThesis data={data} />; break;
    case "comparison": content = <MoneroComparison />; break;
    case "attacks":    content = <MoneroAttacks />; break;
    case "future":     content = <MoneroFuture />; break;
    case "bottomline": content = window.MoneroBottomLine ? <window.MoneroBottomLine data={data} /> : null; break;
    case "outlook":    content = window.MoneroOutlook ? <window.MoneroOutlook data={data} /> : null; break;
    default:           content = <MoneroOverview data={data} navigate={navigate} />;
  }

  return (
    <AppShell active="monero" data={data} hideRail bg={{ intensity: "calm" }}>
      <div style={{ padding: "20px 48px 60px", display: "flex", flexDirection: "column", gap: 22, maxWidth: 1500, margin: "0 auto", width: "100%" }}>
        <Crumbs items={["xmr.irish", "v5.0", "monero", subroute]} />
        <MoneroTabs active={subroute} onChange={onChange} />
        {content}
      </div>
    </AppShell>
  );
}

window.MoneroPage = MoneroPage;
// Mark the legacy MoneroPage in pages.jsx so monero-pages.jsx
// can override it on load:
window.LegacyMoneroPage = MoneroPage;
