/**
 * pages/monero/legality/data.ts — country × activity legality matrix.
 * Moved verbatim out of LegalityTab.tsx (v6.0.10 mobile rewrite); notes unchanged.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type ActivityStatus = "legal" | "restricted" | "illegal" | "unclear";

export type MatrixRow = {
  c: string;
  n: string;
  hold: ActivityStatus;
  cex: ActivityStatus;
  p2p: ActivityStatus;
  mine: ActivityStatus;
  pay: ActivityStatus;
  note: string;
};

export type ActivityKey = "hold" | "cex" | "p2p" | "mine" | "pay";

// ── Data ───────────────────────────────────────────────────────────────────────

export const LEGALITY_MATRIX: MatrixRow[] = [
  { c: "🇺🇸", n: "United States",       hold: "legal",      cex: "restricted", p2p: "legal",      mine: "legal",      pay: "legal",
    note: "FinCEN classifies XMR as a 'convertible virtual currency'. Several US-facing exchanges have delisted (Kraken, Bittrex, Coinbase). Non-custodial holding, P2P trade, mining, and accepting XMR as payment remain fully legal in all 50 states." },
  { c: "🇺🇸", n: "United States · New York", hold: "legal", cex: "restricted", p2p: "legal",      mine: "legal",      pay: "legal",
    note: "BitLicense (23 NYCRR Part 200) creates significant regulatory barriers for BUSINESSES offering XMR services in New York — a $5,000 application fee, extensive compliance, and roughly 30 licences issued since 2015. It is not a ban on the technology. Individuals may legally hold, mine, and send Monero in NY. Most exchanges block NY users because of compliance cost, not because individual use is illegal. Acquire via P2P, atomic swaps, or non-custodial venues (Haveno, Trocador)." },
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
