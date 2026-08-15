/**
 * data/timeline.ts — the privacy-evolution timeline, as DATA.
 *
 * ONE SOURCE, TWO SURFACES. These 49 events were declared inside
 * `pages/_education/Timeline.tsx` and rendered by exactly one page. The markets
 * annotation layer (D0833) needs the same events, and importing the education
 * COMPONENT from the markets page would drag EducationPage's whole chunk into
 * the markets graph. So the data moved here and both surfaces import it; the
 * component kept its rendering byte-for-byte, which is what
 * `verify-markets-dom` §7 asserts rather than assumes.
 *
 * A LEAF WITH A BUNDLING JOB — the `design/canvasColor.ts` rule, applied.
 * This module imports NOTHING. Its importers must ALL be lazy, and today both
 * are (`EducationPage` and `MarketsPage` are React.lazy in App.tsx), so Rollup
 * mints it a chunk of its own and it costs first paint zero bytes. Import it
 * from an eagerly-reachable module and 12,941 B of prose lands in the entry
 * chunk on every route — including the twelve that never show a timeline.
 * MEASURED, not assumed: doing exactly that leaves `eagerJsRaw`, `eagerJsGz`,
 * `lazyJsRaw`, `totalJsRaw` and the chunk-count detector ALL GREEN, and reds
 * ten of the thirteen per-route ceilings instead — `/` not among them. The
 * full table is in verify-bundle.mjs beside the lazyJsRaw budget.
 *
 * ── THE DATE FIELDS, AND THE ONE RULE THAT MAKES THEM HONEST ──────────
 *
 * `d` is the DISPLAY string and it is the ONLY thing any surface may print as
 * this event's date. It is editorial, and it is deliberately imprecise where
 * the history is: "2013 – 2014", "Mid-2026 (tentative)", "2026".
 *
 * `iso` / `iso2` are POSITION ONLY — the interval the display string denotes,
 * added so an event can be placed on a time axis. `iso` is the interval's
 * START, never a midpoint: a midpoint is a number nobody wrote down, and this
 * repo's first rule is that a displayed figure is real or it is an em-dash.
 * `iso2` is absent exactly when the event is day-precise; when it is present
 * the annotation layer draws the interval as a BAND, so the reader sees the
 * uncertainty instead of a false point. `tent` marks a date the source itself
 * calls tentative, and the flag renders visibly tentative.
 *
 * Derived mechanically from `d` (see the p3·13 session note) and reviewed line
 * by line; `verify-markets-dom` re-derives every one of them from `d` at build
 * time, so a hand-edited `iso` that contradicts its own display string fails
 * the build rather than shifting a flag quietly.
 *
 * `slug` is the stable deep-link id. It is derived from `t`, but once shipped
 * it is a URL: change a title freely, change a slug only deliberately.
 */

export const TL_CAT = {
  bitcoin:    { label: "Bitcoin",    color: "var(--c-50)" },
  monero:     { label: "Monero",     color: "var(--tk-accent)" },
  crossover:  { label: "Crossover",  color: "var(--p-50)" },
  regulatory: { label: "Regulatory", color: "var(--y-50)" },
} as const;

export type TlCat = keyof typeof TL_CAT;

export interface TlEvent {
  /** display date — editorial, imprecise where the history is, and the ONLY
   *  string any surface may print as this event's date. */
  d: string;
  /** title */
  t: string;
  /** category */
  c: TlCat;
  /** body */
  b: string;
  /** ISO start of the interval `d` denotes. POSITION ONLY — never displayed. */
  iso: string;
  /** ISO end, present exactly when `d` is not day-precise. */
  iso2?: string;
  /** `d` calls itself tentative. */
  tent?: true;
  /** stable deep-link id: /learn/timeline?e=<slug> */
  slug: string;
}

export interface TlEra {
  id: string;
  span: string;
  name: string;
  events: TlEvent[];
}

export const TL_ERAS: TlEra[] = [
  { id: "e1", span: "2008 — 2011", name: "The Bitcoin Era", events: [
    { d: "Oct 31, 2008", t: "Bitcoin Whitepaper Published", c: "bitcoin", b: "Satoshi publishes 'Bitcoin: A Peer-to-Peer Electronic Cash System'. Section 10 warns that address-based pseudonymity has limits and recommends a new key pair per transaction.", iso: "2008-10-31", slug: "bitcoin-whitepaper-published" },
    { d: "Jan 3, 2009", t: "Genesis Block Mined", c: "bitcoin", b: "Block 0 embeds 'Chancellor on brink of second bailout for banks' — a timestamp and a philosophical statement. The 50 BTC subsidy is permanently unspendable.", iso: "2009-01-03", slug: "genesis-block-mined" },
    { d: "Jan 12, 2009", t: "First Bitcoin Transaction", c: "bitcoin", b: "Satoshi sends 10 BTC to cryptographer Hal Finney in block 170 — the first transaction between two parties.", iso: "2009-01-12", slug: "first-bitcoin-transaction" },
    { d: "Oct 5, 2009", t: "First BTC Price Established", c: "bitcoin", b: "New Liberty Standard publishes the first exchange rate — $0.00076/BTC — based on electricity cost to mine.", iso: "2009-10-05", slug: "first-btc-price-established" },
    { d: "May 22, 2010", t: "Bitcoin Pizza Day", c: "bitcoin", b: "Laszlo Hanyecz pays 10,000 BTC for two pizzas — the first commercial transaction. Bitcoin becomes a medium of exchange.", iso: "2010-05-22", slug: "bitcoin-pizza-day" },
    { d: "Jul 7–8, 2010", t: "Satoshi's Anonymity Thread (#82)", c: "bitcoin", b: "BitcoinTalk #82 'Anonymity' — the community debates whether Bitcoin provides adequate privacy. Satoshi acknowledges the limitations.", iso: "2010-07-07", iso2: "2010-07-08", slug: "satoshis-anonymity-thread-82" },
    { d: "Aug 10–13, 2010", t: "The 'Not a Suggestion' Thread (#174)", c: "bitcoin", b: "Satoshi outlines 'blinded variations of a public key' (stealth addresses), 'group signatures' (ring signatures), and hiding amounts — the exact features that became Monero's core.", iso: "2010-08-10", iso2: "2010-08-13", slug: "the-not-a-suggestion-thread-174" },
    { d: "Aug 15, 2010", t: "Value Overflow Bug", c: "bitcoin", b: "An integer overflow creates 184 billion BTC. Satoshi and devs patch and fork within hours — demonstrating both vulnerability and rapid response.", iso: "2010-08-15", slug: "value-overflow-bug" },
    { d: "Dec 5, 2010", t: "Satoshi's Last Public Post", c: "bitcoin", b: "'WikiLeaks has kicked the hornet's nest.' Satoshi's awareness that Bitcoin's transparent ledger makes it unsuitable for high-profile privacy needs.", iso: "2010-12-05", slug: "satoshis-last-public-post" },
    { d: "Dec 12, 2010", t: "Satoshi's Last Known Activity", c: "bitcoin", b: "Final forum activity. Communicates only by private email after this. ~1.1M BTC remains untouched to this day.", iso: "2010-12-12", slug: "satoshis-last-known-activity" },
    { d: "Apr 23, 2011", t: "Satoshi's Final Email", c: "bitcoin", b: "'I've moved on to other things. It's in good hands with Gavin and everyone.' He disappears permanently.", iso: "2011-04-23", slug: "satoshis-final-email" },
    { d: "June 2011", t: "WikiLeaks Accepts Bitcoin", c: "crossover", b: "Cut off from traditional payments, WikiLeaks turns to Bitcoin — validating censorship resistance, but its transparent ledger makes donations fully traceable.", iso: "2011-06-01", iso2: "2011-06-30", slug: "wikileaks-accepts-bitcoin" },
  ] },
  { id: "e2", span: "2012 — 2014", name: "CryptoNote Emerges", events: [
    { d: "Jul 4, 2012", t: "Bytecoin Launches", c: "monero", b: "The first CryptoNote coin ships ring signatures and one-time addresses — but ~80% was premined by insiders, motivating a fair-launch alternative.", iso: "2012-07-04", slug: "bytecoin-launches" },
    { d: "Dec 12, 2012", t: "CryptoNote v1 Whitepaper", c: "monero", b: "Nicolas van Saberhagen criticizes Bitcoin's transparent ledger, proposing ring signatures for sender privacy and one-time addresses for receiver privacy.", iso: "2012-12-12", slug: "cryptonote-v1-whitepaper" },
    { d: "Feb 2013", t: "Bitcoin Hits $1,000", c: "bitcoin", b: "BTC touches four figures for the first time, drawing investors and regulators alike.", iso: "2013-02-01", iso2: "2013-02-28", slug: "bitcoin-hits-1-000" },
    { d: "March 2013", t: "CryptoNote v2 Whitepaper", c: "monero", b: "Refines ring signatures, one-time key derivation, and formalizes unlinkability and untraceability.", iso: "2013-03-01", iso2: "2013-03-31", slug: "cryptonote-v2-whitepaper" },
    { d: "Oct 2013", t: "Silk Road Shut Down", c: "bitcoin", b: "FBI seizes 144,000 BTC. The investigation relied heavily on Bitcoin's transparent blockchain — proving it pseudonymous, not anonymous.", iso: "2013-10-01", iso2: "2013-10-31", slug: "silk-road-shut-down" },
    { d: "2013 – 2014", t: "Chain Analysis Firms Founded", c: "crossover", b: "Elliptic (2013) and Chainalysis (2014) build tools to trace Bitcoin, signing contracts with dozens of agencies — turning the ledger into a surveillance tool.", iso: "2013-01-01", iso2: "2014-12-31", slug: "chain-analysis-firms-founded" },
    { d: "Feb 2014", t: "Mt. Gox Collapse", c: "bitcoin", b: "~850,000 BTC lost. Accelerates the 'not your keys, not your coins' movement toward self-custody.", iso: "2014-02-01", iso2: "2014-02-28", slug: "mt-gox-collapse" },
    { d: "Apr 18, 2014", t: "Monero (BitMonero) Launched", c: "monero", b: "A community fork of Bytecoin without the premine. Ring signatures and stealth addresses from day one — privacy mandatory and default.", iso: "2014-04-18", slug: "monero-bitmonero-launched" },
    { d: "Sept 2014", t: "Monero Community Takeover", c: "monero", b: "Original creator 'thankful_for_today' ousted. Rebranded BitMonero → Monero. Governance shifts to a decentralized, community-driven model.", iso: "2014-09-01", iso2: "2014-09-30", slug: "monero-community-takeover" },
  ] },
  { id: "e3", span: "2017 — 2022", name: "The Privacy War", events: [
    { d: "Jan 10, 2017", t: "RingCT Activated", c: "monero", b: "Pedersen commitments hide amounts. Completes the trifecta: hidden senders, hidden receivers, hidden amounts.", iso: "2017-01-10", slug: "ringct-activated" },
    { d: "May 2017", t: "WannaCry Ransomware", c: "crossover", b: "Attackers convert Bitcoin proceeds to Monero to evade tracking — a real-world consequence of Bitcoin's traceability.", iso: "2017-05-01", iso2: "2017-05-31", slug: "wannacry-ransomware" },
    { d: "March 2018", t: "Bulletproofs Implemented", c: "monero", b: "Range proofs shrink ~80%, cutting fees proportionally. Privacy and scalability prove compatible.", iso: "2018-03-01", iso2: "2018-03-31", slug: "bulletproofs-implemented" },
    { d: "Sept 2018", t: "Sub-address System", c: "monero", b: "Unlimited unique receiving addresses from one wallet, with no on-chain link between them.", iso: "2018-09-01", iso2: "2018-09-30", slug: "sub-address-system" },
    { d: "Nov 2019", t: "RandomX Activated", c: "monero", b: "ASIC-resistant CPU mining keeps participation accessible to ordinary users, preserving decentralization.", iso: "2019-11-01", iso2: "2019-11-30", slug: "randomx-activated" },
    { d: "Jul 2020", t: "CipherTrace Claims Partial Tracing", c: "crossover", b: "Probabilistic tracing tools announced under DHS contract. Researchers dispute effectiveness; no reliable trace demonstrated.", iso: "2020-07-01", iso2: "2020-07-31", slug: "ciphertrace-claims-partial-tracing" },
    { d: "Sept 2020", t: "IRS Offers $625K Bounty", c: "regulatory", b: "22 companies apply; Chainalysis and Integra FEC selected. Implicitly validates Monero's privacy — and remains effectively unclaimed.", iso: "2020-09-01", iso2: "2020-09-30", slug: "irs-offers-625k-bounty" },
    { d: "Oct 2020", t: "CLSAG Signatures", c: "monero", b: "Replaces MLSAG — 25% smaller, ~20% faster verification, same privacy.", iso: "2020-10-01", iso2: "2020-10-31", slug: "clsag-signatures" },
    { d: "Nov 2020", t: "Chainalysis Wins IRS Contract", c: "regulatory", b: "$22M for Monero tracing. Leaked training later reveals reliance on exchange KYC data and metadata — not cryptographic breaks.", iso: "2020-11-01", iso2: "2020-11-30", slug: "chainalysis-wins-irs-contract" },
    { d: "Apr 2021", t: "Coinbase Refuses to List XMR", c: "regulatory", b: "Despite user demand, citing compliance. A turning point where regulation meaningfully restricts privacy-coin access.", iso: "2021-04-01", iso2: "2021-04-30", slug: "coinbase-refuses-to-list-xmr" },
    { d: "2021 – 2022", t: "Exchange Delisting Wave", c: "regulatory", b: "Bittrex, Huobi and others drop XMR, each citing compliance — accelerating the shift toward DEXs and P2P.", iso: "2021-01-01", iso2: "2022-12-31", slug: "exchange-delisting-wave" },
    { d: "Aug 2022", t: "Tail Emission Begins", c: "monero", b: "0.6 XMR per block, forever. Unlike Bitcoin's eventual zero rewards, Monero ensures perpetual miner incentives.", iso: "2022-08-01", iso2: "2022-08-31", slug: "tail-emission-begins" },
  ] },
  { id: "e4", span: "2022 — 2025", name: "The Regulatory Storm", events: [
    { d: "Dec 2022", t: "EU MiCA Regulation Passed", c: "regulatory", b: "Stringent traceability requirements make it very hard for exchanges to support privacy coins within the EU.", iso: "2022-12-01", iso2: "2022-12-31", slug: "eu-mica-regulation-passed" },
    { d: "Jul 2023", t: "View Tags Implemented", c: "monero", b: "One-byte view tags let wallets skip non-matching outputs — ~40% faster sync, no privacy trade-off.", iso: "2023-07-01", iso2: "2023-07-31", slug: "view-tags-implemented" },
    { d: "Jan 2024", t: "EU Bans Anonymous Crypto >€1000", c: "regulatory", b: "Updated AML rules prohibit anonymous payments above €1,000 through regulated entities.", iso: "2024-01-01", iso2: "2024-01-31", slug: "eu-bans-anonymous-crypto-1000" },
    { d: "May 2024", t: "Binance Delists Monero", c: "regulatory", b: "The world's largest exchange removes XMR globally. Price recovers and surges — independence from CEXes demonstrated.", iso: "2024-05-01", iso2: "2024-05-31", slug: "binance-delists-monero" },
    { d: "June 2024", t: "Dubai DFSA Bans Privacy Tokens", c: "regulatory", b: "Notable given Dubai's crypto-friendly stance — reflecting a growing global regulatory consensus.", iso: "2024-06-01", iso2: "2024-06-30", slug: "dubai-dfsa-bans-privacy-tokens" },
    { d: "Nov 2024", t: "Zcash Governance Crisis", c: "crossover", b: "ECC turmoil fractures the community, reinforcing Monero as the most reliable privacy cryptocurrency.", iso: "2024-11-01", iso2: "2024-11-30", slug: "zcash-governance-crisis" },
    { d: "Jan 2025", t: "XMR Hits ~$800 ATH", c: "monero", b: "Surging demand despite delistings. 73 delistings correlate with a +195% price increase.", iso: "2025-01-01", iso2: "2025-01-31", slug: "xmr-hits-800-ath" },
    { d: "2024 – 2025", t: "73 Exchanges Delist XMR", c: "regulatory", b: "On-chain activity stays flat or grows. P2P, atomic swaps and DEXs absorb volume. No company to sue, no CEO to arrest.", iso: "2024-01-01", iso2: "2025-12-31", slug: "73-exchanges-delist-xmr" },
    { d: "Mar–Apr 2024", t: "FCMP++ Proposal Published", c: "monero", b: "kayabaNerve (Luke Parker) publishes the Full-Chain Membership Proofs design; the Foundation follows with an official explainer.", iso: "2024-03-01", iso2: "2024-04-30", slug: "fcmp-proposal-published" },
    { d: "Oct 3, 2025", t: "FCMP++ Alpha Stressnet Launches", c: "monero", b: "Testnet hard fork at block 2,847,330. Alpha v1 → v1.6 ships CARROT addressing, RAM optimizations, and a 5× proof speedup. Veridise audit completes.", iso: "2025-10-03", slug: "fcmp-alpha-stressnet-launches" },
  ] },
  { id: "e5", span: "2026+", name: "The Future", events: [
    { d: "Jan 2026", t: "EU DAC8 Directive Activates", c: "regulatory", b: "Crypto providers must report transaction data to tax authorities across all EU member states — the most comprehensive surveillance framework yet.", iso: "2026-01-01", iso2: "2026-01-31", slug: "eu-dac8-directive-activates" },
    { d: "2026", t: "CLARITY Act & GENIUS Act", c: "regulatory", b: "US expands crypto reporting (Form 1099-DA), creating a comprehensive surveillance framework — and driving demand for privacy alternatives.", iso: "2026-01-01", iso2: "2026-12-31", slug: "clarity-act-and-genius-act" },
    { d: "May 6, 2026", t: "FCMP++ Beta Stressnet Launches", c: "monero", b: "Final scaling parameters and wallet integrations (watch-only, hardware, multisig, tx proofs) are exercised before the mainnet hard fork.", iso: "2026-05-06", slug: "fcmp-beta-stressnet-launches" },
    { d: "Mid-2026 (tentative)", t: "FCMP++ Mainnet Hard Fork", c: "monero", b: "Replaces ring signatures with full-chain membership proofs (anonymity set of 150M+). Bundled with CARROT addressing; backward compatible with 95-char addresses.", iso: "2026-05-01", iso2: "2026-09-30", tent: true, slug: "fcmp-mainnet-hard-fork" },
    { d: "2026", t: "Cuprate Rust Node", c: "monero", b: "Implementation diversity reduces the risk that one bug affects all nodes. Rust's memory safety shrinks the attack surface.", iso: "2026-01-01", iso2: "2026-12-31", slug: "cuprate-rust-node" },
    { d: "2026", t: "Seraphis & Jamtis in Beta", c: "monero", b: "Seraphis redesigns the transaction protocol; Jamtis brings new addressing with forward secrecy and tiered wallet permissions.", iso: "2026-01-01", iso2: "2026-12-31", slug: "seraphis-and-jamtis-in-beta" },
  ] },
];

/** Every event, flattened and sorted by interval start — the order a time axis
 *  wants, which is NOT the order the eras declare (era 4 lists "Mar–Apr 2024"
 *  after "2024 – 2025"). Sorted once at module scope: the annotation layer's
 *  clustering pass assumes ascending time and would silently mis-group without
 *  it. Ties break on slug so the order is total and stable across engines. */
export const TL_EVENTS: readonly TlEvent[] = TL_ERAS
  .flatMap((e) => e.events)
  .map((e) => ({ ...e, t0: Date.parse(e.iso + "T00:00:00Z") }))
  .sort((a, b) => a.t0 - b.t0 || (a.slug < b.slug ? -1 : 1))
  .map(({ t0: _t0, ...e }) => e);

/** Interval, in ms, that an event's date denotes. `to` is the END of the last
 *  named day, so a day-precise event spans its whole day rather than an
 *  instant — which is what makes a 4h candle bucket able to contain it. */
export function tlSpan(e: TlEvent): { from: number; to: number } {
  const from = Date.parse(e.iso + "T00:00:00Z");
  const to = Date.parse((e.iso2 ?? e.iso) + "T23:59:59.999Z");
  return { from, to };
}
