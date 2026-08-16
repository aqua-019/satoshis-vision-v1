/**
 * pages/monero/legality/data.ts — country × activity legality matrix.
 * Moved verbatim out of LegalityTab.tsx (v6.0.10 mobile rewrite); notes unchanged.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type ActivityStatus = "legal" | "restricted" | "illegal" | "unclear";

/**
 * A citation: a label, and the naming authority's own page — or `null`.
 *
 * The `null` is not a placeholder. It means "this note names a body we can name but
 * cannot link to a page we are certain of", and the UI renders it UNLINKED rather
 * than guessing a path. On a legal-claims surface a URL that 404s is worse than no
 * URL, because it spends the reader's trust and returns nothing.
 *
 * Shape borrowed verbatim from `pages/future/data.ts:26`'s `EcoLink`, which already
 * carries label-plus-honest-null through this codebase.
 */
export type LegalSource = readonly [label: string, href: string | null];

export type MatrixRow = {
  c: string;
  n: string;
  hold: ActivityStatus;
  cex: ActivityStatus;
  p2p: ActivityStatus;
  mine: ActivityStatus;
  pay: ActivityStatus;
  note: string;
  /**
   * ISO `YYYY-MM-DD`. **The date this row's `note` last MATERIALLY CHANGED** —
   * recovered from git history, not the date any release ran.
   *
   * Read the distinction, because the field name is friendlier than the fact:
   * this is when the claim was last WRITTEN, and it is a LOWER BOUND on staleness,
   * not evidence that a human re-checked the law that day. The UI says
   * "note last updated", never "verified" — see LegalityTab's dating note.
   *
   * Mass-stamping today's date on 21 rows nobody re-verified today would be a
   * fabricated review: exactly the defect class this site exists to refuse. So the
   * initial values are derived, and only a row an operator actually re-verifies
   * may be moved forward.
   *
   * Derivation (repeatable — the repo must be UNSHALLOWED first, or the graft
   * boundary sits on the split commit and hides the true vintage):
   *   git fetch --unshallow
   *   for each commit touching a legality home, extract `n:`/`note:` pairs from the
   *   blob, whitespace-normalise, and take the last commit where a row's note
   *   differs from its predecessor.
   * `git log -S` is NOT sufficient: it counts occurrence deltas and is blind to an
   * edit that leaves the count unchanged.
   *
   * REQUIRED, deliberately. An optional field would let a 22nd jurisdiction ship
   * undated and silent; required makes it a compile error. Measured, not asserted:
   * adding these two fields turned all 21 rows into `TS2739 … missing the
   * following properties from type 'MatrixRow': reviewed, sources`.
   *
   * NO "REVIEW OVERDUE" TINT, and the reason is arithmetic rather than taste.
   * At ship time 20 rows read 2026-06-05 and one reads 2026-07-31, so against
   * today (2026-08-16) the ages are 72 days and 16. ANY horizon either fires on
   * ~everything or on nothing: 90d tints zero rows (an unexercised feature, green
   * because nothing reaches it — the vacuity class this repo fails builds over),
   * 60d tints 20 of 21, 30d tints all 21. A page of warnings reads as broken, and
   * an untriggerable one proves nothing. A tint is also a HUE-ONLY channel, which
   * is exactly what StatusMark exists to avoid. The date and the page-level range
   * already make staleness visible; a threshold nobody has justified would only
   * add a judgment on top. Recorded, not shipped.
   */
  reviewed: string;
  /**
   * Primary sources for this row's claims. REQUIRED for the same reason as
   * `reviewed`: a new jurisdiction must answer the question, and `[["…", null]]`
   * is a valid, honest answer that says so on the page.
   */
  sources: readonly LegalSource[];
};

export type ActivityKey = "hold" | "cex" | "p2p" | "mine" | "pay";

// ── Data ───────────────────────────────────────────────────────────────────────

export const LEGALITY_MATRIX: MatrixRow[] = [
  { c: "🇺🇸", n: "United States",       hold: "legal",      cex: "restricted", p2p: "legal",      mine: "legal",      pay: "legal",
    note: "FinCEN classifies XMR as a 'convertible virtual currency'. Several US-facing exchanges have delisted (Kraken, Bittrex, Coinbase). Non-custodial holding, P2P trade, mining, and accepting XMR as payment remain fully legal in all 50 states.",
    reviewed: "2026-06-05",
    sources: [["FinCEN", "https://www.fincen.gov/"]] },
  { c: "🇺🇸", n: "United States · New York", hold: "legal", cex: "restricted", p2p: "legal",      mine: "legal",      pay: "legal",
    note: "BitLicense (23 NYCRR Part 200) creates significant regulatory barriers for BUSINESSES offering XMR services in New York — a $5,000 application fee, extensive compliance, and roughly 30 licences issued since 2015. It is not a ban on the technology. Individuals may legally hold, mine, and send Monero in NY. Most exchanges block NY users because of compliance cost, not because individual use is illegal. Acquire via P2P, atomic swaps, or non-custodial venues (Haveno, Trocador).",
    reviewed: "2026-07-31",
    sources: [["23 NYCRR Part 200 · NYDFS", "https://www.dfs.ny.gov/"]] },
  { c: "🇨🇦", n: "Canada",              hold: "legal",      cex: "restricted", p2p: "legal",      mine: "legal",      pay: "legal",
    note: "FINTRAC reporting threshold of $10K CAD applies to MSBs but not individuals. Kraken Canada still lists XMR. Mining is taxed as business income; payment acceptance treated like any commodity.",
    reviewed: "2026-06-05",
    sources: [["FINTRAC", "https://fintrac-canafe.canada.ca/"]] },
  { c: "🇪🇺", n: "European Union (MiCA)", hold: "legal",   cex: "illegal",    p2p: "legal",      mine: "legal",      pay: "legal",
    note: "MiCA Article 76 prohibits CASPs from listing privacy coins as of Dec 30, 2024. Holding, P2P trade, mining, and merchant acceptance remain legal across all 27 member states. Wallet providers exempted (so far).",
    reviewed: "2026-06-05",
    sources: [["MiCA · Regulation (EU) 2023/1114", "https://eur-lex.europa.eu/eli/reg/2023/1114/oj"]] },
  { c: "🇬🇧", n: "United Kingdom",      hold: "legal",      cex: "restricted", p2p: "legal",      mine: "legal",      pay: "legal",
    note: "FCA registration requirement effectively delisted XMR from UK-licensed CEXs. The Travel Rule applies to MSBs, not individuals. P2P and self-custody remain fully unrestricted.",
    reviewed: "2026-06-05",
    sources: [["FCA", "https://www.fca.org.uk/"], ["UK statute book", "https://www.legislation.gov.uk/"]] },
  { c: "🇯🇵", n: "Japan",               hold: "legal",      cex: "illegal",    p2p: "legal",      mine: "legal",      pay: "legal",
    note: "FSA banned 'anonymous virtual currencies' from JFSA-licensed exchanges in 2018. P2P, holding, mining, and merchant use are not regulated at the individual level.",
    reviewed: "2026-06-05",
    sources: [["JFSA", "https://www.fsa.go.jp/"]] },
  { c: "🇰🇷", n: "South Korea",         hold: "legal",      cex: "illegal",    p2p: "unclear",    mine: "legal",      pay: "legal",
    note: "FSC required 'dark coin' delisting from licensed exchanges in 2021. P2P platforms operate in legal grey zone (no specific ban; AML reporting required at scale).",
    reviewed: "2026-06-05",
    sources: [["FSC", "https://www.fsc.go.kr/"]] },
  { c: "🇨🇭", n: "Switzerland",         hold: "legal",      cex: "legal",      p2p: "legal",      mine: "legal",      pay: "legal",
    note: "FINMA treats Monero like any virtual asset. Bity offers up to CHF 1,000/day KYC-free. Zug ('Crypto Valley') accepts XMR for tax payments below CHF 100K.",
    reviewed: "2026-06-05",
    sources: [["FINMA", "https://www.finma.ch/"], ["Canton of Zug", "https://www.zg.ch/"]] },
  { c: "🇩🇪", n: "Germany",             hold: "legal",      cex: "illegal",    p2p: "legal",      mine: "legal",      pay: "legal",
    note: "BaFin treats XMR as 'units of account'. MiCA delisting applies. Held >1 year = tax-free under §23 EStG (private sale rule). Payment acceptance fully legal.",
    reviewed: "2026-06-05",
    sources: [["BaFin", "https://www.bafin.de/"], ["§23 EStG", "https://www.gesetze-im-internet.de/estg/"]] },
  { c: "🇦🇺", n: "Australia",           hold: "legal",      cex: "restricted", p2p: "legal",      mine: "legal",      pay: "legal",
    note: "AUSTRAC pressured major exchanges (Coinbase, Binance) to delist privacy coins in 2020. ATO treats Monero like any digital asset for CGT. P2P and mining unaffected.",
    reviewed: "2026-06-05",
    sources: [["AUSTRAC", "https://www.austrac.gov.au/"], ["ATO", "https://www.ato.gov.au/"]] },
  { c: "🇷🇺", n: "Russia",              hold: "legal",      cex: "restricted", p2p: "legal",      mine: "restricted", pay: "restricted",
    note: "Crypto mining permitted for registered entities only since Nov 2024. Crypto payments for goods/services within Russia are prohibited (only cross-border).",
    reviewed: "2026-06-05",
    sources: [["No primary source named in this note", null]] },
  { c: "🇨🇳", n: "China",               hold: "illegal",   cex: "illegal",    p2p: "illegal",   mine: "illegal",   pay: "illegal",
    note: "Total crypto ban since 2021. All transactions, exchanges, mining, and holding are prohibited. Enforcement focuses on businesses; individual holders face confiscation.",
    reviewed: "2026-06-05",
    sources: [["No primary source named in this note", null]] },
  { c: "🇦🇪", n: "UAE / Dubai",         hold: "legal",      cex: "restricted", p2p: "legal",      mine: "legal",      pay: "legal",
    note: "Dubai's VARA permits regulated venues to delist privacy assets (most have). Free zones (ADGM, DIFC) have relaxed individual rules. P2P and self-custody fully legal.",
    reviewed: "2026-06-05",
    sources: [["VARA", "https://www.vara.ae/"], ["ADGM", "https://www.adgm.com/"]] },
  { c: "🇧🇷", n: "Brazil",              hold: "legal",      cex: "legal",      p2p: "legal",      mine: "legal",      pay: "legal",
    note: "CVM treats Monero like any crypto. Bitso (regional CEX) lists XMR. Mining taxed as business activity. Merchant acceptance is common in fintech and remittance corridors.",
    reviewed: "2026-06-05",
    sources: [["CVM", "https://www.gov.br/cvm/"]] },
  { c: "🇸🇬", n: "Singapore",           hold: "legal",      cex: "restricted", p2p: "legal",      mine: "legal",      pay: "legal",
    note: "MAS guidance disfavors privacy coins on regulated venues but doesn't prohibit them. Most retail-facing CEXs have delisted; P2P and merchant payment fully legal.",
    reviewed: "2026-06-05",
    sources: [["MAS", "https://www.mas.gov.sg/"]] },
  { c: "🇲🇽", n: "Mexico",              hold: "legal",      cex: "legal",      p2p: "legal",      mine: "legal",      pay: "legal",
    note: "Banxico requires authorization for fintechs offering crypto; Monero not singled out. Bitso continues to list. Merchant acceptance growing in border corridors.",
    reviewed: "2026-06-05",
    sources: [["Banxico", "https://www.banxico.org.mx/"]] },
  { c: "🇮🇳", n: "India",               hold: "legal",      cex: "unclear",    p2p: "legal",      mine: "legal",      pay: "unclear",
    note: "30% flat tax on crypto gains + 1% TDS on transfers since 2022. Most Indian CEXs do not list XMR. Holding and mining are legal; payment use exists in legal grey zone.",
    reviewed: "2026-06-05",
    sources: [["Income Tax Dept · India", "https://www.incometax.gov.in/"]] },
  { c: "🇮🇩", n: "Indonesia",           hold: "legal",      cex: "legal",      p2p: "legal",      mine: "legal",      pay: "illegal",
    note: "Bappebti permits crypto trading as a commodity. Bank Indonesia prohibits using crypto as a payment method. Some local exchanges list XMR.",
    reviewed: "2026-06-05",
    sources: [["Bappebti", "https://bappebti.go.id/"], ["Bank Indonesia", "https://www.bi.go.id/"]] },
  { c: "🇹🇷", n: "Turkey",              hold: "legal",      cex: "legal",      p2p: "legal",      mine: "legal",      pay: "illegal",
    note: "Crypto payments for goods/services banned since 2021. Trading and holding remain fully legal. Major Turkish exchanges list XMR.",
    reviewed: "2026-06-05",
    sources: [["TCMB · Central Bank", "https://www.tcmb.gov.tr/"]] },
  { c: "🇦🇷", n: "Argentina",           hold: "legal",      cex: "legal",      p2p: "legal",      mine: "legal",      pay: "legal",
    note: "Crypto activity broadly permitted. Heavy inflation drives extensive P2P trading. Monero used in remittance corridors via Lemon Cash and Bitso.",
    reviewed: "2026-06-05",
    sources: [["No primary source named in this note", null]] },
  { c: "🇿🇦", n: "South Africa",        hold: "legal",      cex: "legal",      p2p: "legal",      mine: "legal",      pay: "legal",
    note: "SARB classifies crypto as a 'financial asset'. Luno doesn't list XMR but VALR does. Mining is taxed; payment acceptance unrestricted.",
    reviewed: "2026-06-05",
    sources: [["SARB", "https://www.resbank.co.za/"]] },
];

// ── Activities ─────────────────────────────────────────────────────────────────

export const ACTIVITIES = [
  { key: "hold", short: "Hold", long: "Hold / self-custody" },
  { key: "cex",  short: "CEX",  long: "Centralized exchange trade" },
  { key: "p2p",  short: "P2P",  long: "Peer-to-peer trade" },
  { key: "mine", short: "Mine", long: "Mining" },
  { key: "pay",  short: "Pay",  long: "Accept as payment" },
] as const satisfies readonly { key: ActivityKey; short: string; long: string }[];

// ── Search aliases ───────────────────────────────────────────────────────────────

export const ALIASES: Record<string, string[]> = {
  "United States": ["usa", "us", "america", "fincen"],
  "United States · New York": ["ny", "nyc", "new york", "bitlicense"],
  "Canada": ["fintrac"],
  "European Union (MiCA)": ["eu", "mica", "europe"],
  "United Kingdom": ["uk", "britain", "fca"],
  "Japan": ["fsa"],
  "South Korea": ["korea", "fsc"],
  "Switzerland": ["finma", "swiss"],
  "Germany": ["deutschland", "bafin"],
  "Australia": ["austrac", "ato"],
  "Russia": ["russian federation"],
  "China": ["prc", "chinese"],
  "UAE / Dubai": ["dubai", "emirates", "vara", "uae"],
  "Brazil": ["cvm", "bitso"],
  "Singapore": ["mas"],
  "Mexico": ["banxico"],
  "India": ["tds"],
  "Indonesia": ["bappebti"],
  "Turkey": ["turkiye"],
  "Argentina": ["lemon cash"],
  "South Africa": ["sarb", "valr", "luno"],
};
