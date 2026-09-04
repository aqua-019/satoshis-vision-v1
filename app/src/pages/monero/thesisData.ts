/**
 * pages/monero/thesisData.ts — the seven pressures, their sources, and the
 * pairwise overlap sentences. Pure data; imports NOTHING.
 *
 * ONE IMPORTER, AND IT IS LAZY. `ThesisTab.tsx` is the only consumer and
 * MoneroPage reaches it through `React.lazy`, so this module compiles into
 * the thesis chunk rather than MoneroPage's. That is not a style choice: the
 * page mounts exactly ONE tab, and `/monero`'s route row had 1,138 B of gzip
 * margin on the base measured for p4·M11 while this module's content is
 * ~13.3 kB gzip on its own. views/index.tsx makes the identical argument for
 * the ten mempool view engines, and verify-bundle.mjs:2288 records that
 * dynamicImports are excluded from a route's closure for exactly that reason.
 *
 * GENERATED FROM THE APPROVED MOCKUP, NOT RETYPED. Every string below is
 * byte-identical to `p4-M11-thesis-MOCKUP.html`'s own S / P / TH / WHY /
 * THUE objects; the generator refuses to emit if a numeral is unknown, a
 * `srcs` key has no source, HUEBY stops being derivable, or WHY is not
 * exactly the 21 sorted pairs over ORDER. p4·06's rule: move it
 * programmatically, do not retype it.
 *
 * THREE STRUCTURAL CHANGES, all shape and none content:
 *  1. `numeral` is an explicit field. The mockup did `p.num.split(' ')[0]`
 *     at every use site because "II · the hinge" carries a suffix; parsing a
 *     display string to get an identity is a defect waiting for a second
 *     suffix.
 *  2. `HUEBY` is DERIVED (`hueOf`), not restated — it was a hand-copied
 *     second copy of the hue each pressure already declares.
 *  3. `oursLabel` moves out of the template's `id === 'p4' ? … : 'p6' ? …`
 *     ternary and into the record it describes.
 *
 * THE HTML STRINGS ARE AUTHOR CONSTANTS AND ARE RENDERED WITH
 * dangerouslySetInnerHTML. Nothing here is URL-derived, user-supplied or
 * interpolated at runtime: the tab id is validated by `resolveTab` against a
 * fixed list before this module is even reached, and every field below is a
 * compile-time literal. `verify-thesis.mjs` asserts that no template in
 * ThesisTab.tsx interpolates a non-constant into an HTML sink.
 */

/** A theme two pressures can share. Seven, bijective with the seven hues. */
export type ThesisThemeId = "privacy" | "data" | "state" | "risk" | "freeze" | "future" | "trace";

/** Roman numeral identity of a pressure. Ordering is argument order. */
export type ThesisNumeral = "I" | "II" | "III" | "IV" | "V" | "VI" | "VII";

export interface ThesisSource {
  /** Publisher and headline, as the source itself titles it. */
  label: string;
  /** Absolute https permalink. Rendered target="_blank" rel="noopener noreferrer". */
  url: string;
  /** Publication date as the publisher states it — never today's date. */
  date: string;
}

export interface ThesisSection {
  /** Section heading. */
  h: string;
  /** Optional prose, HTML. */
  t?: string;
  /** Optional definition rows: [term, description-HTML]. */
  dl?: readonly (readonly [string, string])[];
}

export interface ThesisPressure {
  id: string;
  numeral: ThesisNumeral;
  /** Display form of the numeral — may carry a suffix ("II · the hinge"). */
  num: string;
  /** CSS custom property naming this pressure's hue. */
  hue: string;
  kicker: string;
  title: string;
  /** Card body. Exactly one of card / cardHTML is set. */
  card?: string;
  cardHTML?: string;
  figs: readonly (readonly [string, string])[];
  /** Attribution line on the card face. */
  srcline: string;
  /** Our own reasoning, labelled as ours. */
  ours?: string;
  oursLabel?: string;
  lede: string;
  secs: readonly ThesisSection[];
  /** Keys into THESIS_SOURCES. */
  srcs: readonly string[];
  themes: readonly ThesisThemeId[];
  /** Closing-box row: [numeral, what it establishes, what answers it]. */
  ans: readonly [string, string, string];
}

/** 28 sources. Every one an absolute https permalink with the
 *  publisher's own date. 2 are declared and not cited by any
 *  pressure — see verify-thesis.mjs §3, which pins that set by NAME so a third
 *  cannot appear unnoticed. */
export const THESIS_SOURCES: Readonly<Record<string, ThesisSource>> = {
  irs: { label: "IRS Criminal Investigation — Samourai founders sentenced", url: "https://www.irs.gov/compliance/criminal-investigation/founders-of-samourai-wallet-cryptocurrency-mixing-service-sentenced-to-five-and-four-years-in-prison", date: "Nov 2025" },
  skad: { label: "Skadden — US establishes first federal stablecoin framework", url: "https://www.skadden.com/insights/publications/2025/07/us-establishes-first-federal-regulatory-framework", date: "Jul 2025" },
  fedreg: { label: "Federal Register — FinCEN/OFAC proposed rule 2026-06963", url: "https://www.federalregister.gov/documents/2026/04/10/2026-06963/permitted-payment-stablecoin-issuer-anti-money-launderingcountering-the-financing-of-terrorism", date: "10 Apr 2026" },
  genius: { label: "GENIUS Act — S.1582, 119th Congress (full text)", url: "https://www.congress.gov/bill/119th-congress/senate-bill/1582/text", date: "2025" },
  aml: { label: "AMLBot — stablecoin freezes 2023–2025", url: "https://blog.amlbot.com/stablecoin-freezes-2023-2025-a-data-backed-analysis-of-usdt-vs-usdc-by-amlbot/", date: "5 Dec 2025" },
  ell: { label: "Elliptic — Congress pushes for CLARITY Act passage", url: "https://www.elliptic.co/insights/crypto-regulatory-affairs-us-congress-pushes-for-clarity-act-passage/", date: "16 Feb 2026" },
  irs99: { label: "IRS — final regulations for broker digital-asset reporting", url: "https://www.irs.gov/newsroom/final-regulations-and-related-irs-guidance-for-reporting-by-brokers-on-sales-and-exchanges-of-digital-assets", date: "2024" },
  rsm: { label: "RSM — DAC8 and CARF reporting challenges", url: "https://rsmus.com/insights/tax-alerts/2025/dac8-and-carf-present-extensive-reporting-challenges-for-crypto-platforms.html", date: "2025" },
  npr: { label: "NPR — why cities are cancelling Flock contracts", url: "https://www.npr.org/2026/02/17/nx-s1-5612825/flock-contracts-canceled-immigration-survillance-concerns", date: "17 Feb 2026" },
  aclu: { label: "ACLU — Flock roundup: aggressive expansions", url: "https://www.aclu.org/news/privacy-technology/flock-roundup", date: "Aug 2025" },
  aclu2: { label: "ACLU — Get the Flock Out (campaign)", url: "https://www.aclu.org/campaigns-initiatives/get-the-flock-out", date: "2026" },
  dn: { label: "Democracy Now — \"Privacy for Profits\"", url: "https://www.democracynow.org/2026/7/21/flock_aclu_chad_marlow", date: "21 Jul 2026" },
  calea: { label: "EFF — CALEA", url: "https://www.eff.org/issues/calea", date: "enacted 1994" },
  umich: { label: "University of Michigan — history of surveillance timeline", url: "https://safecomputing.umich.edu/protect-privacy/history-of-surveillance-timeline", date: "1994–2015" },
  fcc: { label: "FCC — CALEA", url: "https://www.fcc.gov/calea", date: "—" },
  trm: { label: "TRM Labs — Monero in 2025: persistent use, network-layer insights", url: "https://www.trmlabs.com/resources/blog/monero-in-2025-persistent-use-and-emerging-network-layer-insights", date: "13 Feb 2026" },
  cha: { label: "Chainalysis — 2026 Crypto Crime Report", url: "https://www.chainalysis.com/blog/2026-crypto-crime-report-introduction/", date: "Mar 2026" },
  chasanc: { label: "Chainalysis — Crypto sanctions, 2026 report", url: "https://www.chainalysis.com/blog/crypto-sanctions-2026/", date: "Mar 2026" },
  bh: { label: "Blockhead — sanctions evasion surged 694% in 2025", url: "https://www.blockhead.co/2026/03/06/sanctions-evasion-through-crypto-surged-sevenfold-in-2025-chainalysis-report-shows/", date: "6 Mar 2026" },
  bis: { label: "BIS — CBDC survey (BIS Papers 159)", url: "https://www.bis.org/publ/bppdf/bispap159.htm", date: "2024 survey" },
  mo: { label: "Monero Observer — FCMP++/Carrot alpha stressnet v1", url: "https://monero.observer/fcmp++-carrot-alpha-stressnet-v1-released/", date: "29 Sep 2025" },
  hf: { label: "monero-project — fcmp++ hf milestone", url: "https://github.com/monero-project/monero/milestone/1", date: "live" },
  seiz: { label: "Chainalysis — asset seizure and cryptocurrency", url: "https://www.chainalysis.com/blog/cryptocurrency-asset-seizure/", date: "—" },
  disc: { label: "Discord — update on security incident involving third-party customer service", url: "https://discord.com/press-releases/update-on-security-incident-involving-third-party-customer-service", date: "3 Oct 2025" },
  hibp: { label: "Have I Been Pwned — Ledger breach record", url: "https://haveibeenpwned.com/Breach/Ledger", date: "Jun 2020" },
  ledceo: { label: "Ledger — message from the CEO on the July data breach", url: "https://www.ledger.com/message-ledgers-ceo-data-leak", date: "2020" },
  led26: { label: "SiliconANGLE — Ledger confirms leak via third-party Global-e", url: "https://siliconangle.com/2026/01/05/ledger-confirms-leak-customer-data-third-party-global-e-hack/", date: "5 Jan 2026" },
  ell21: { label: "Elliptic — how Iran uses Bitcoin mining to evade sanctions", url: "https://www.elliptic.co/blog/how-iran-uses-bitcoin-mining-to-evade-sanctions", date: "13 May 2021" },
};

/** Theme id -> the label rendered on a chip. */
export const THESIS_THEMES: Readonly<Record<ThesisThemeId, string>> = {
  privacy: "privacy",
  data: "data value",
  state: "state power",
  risk: "risk",
  freeze: "freezability",
  future: "forward demand",
  trace: "traceability",
};

/** Theme id -> hue. Bijective with the pressure hues but an INDEPENDENT
 *  mapping: a theme is not a pressure, and nothing derives one from the other. */
export const THESIS_THEME_HUE: Readonly<Record<ThesisThemeId, string>> = {
  privacy: "--th-p7",
  data: "--th-p4",
  state: "--th-p3",
  risk: "--th-p2",
  freeze: "--th-p1",
  future: "--th-p5",
  trace: "--th-p6",
};

/** Argument order. The closing box and every correlation list sort by it. */
export const THESIS_ORDER: readonly ThesisNumeral[] = ["I", "II", "III", "IV", "V", "VI", "VII"];

export const THESIS_PRESSURES: readonly ThesisPressure[] = [
  {
    id: "p1",
    numeral: "I",
    num: "I",
    hue: "--th-p1",
    kicker: "Reporting mandates · still arriving",
    title: "Regulatory Progression Toward Total Transparency",
    card: "GENIUS is law but its requirements bite in <strong>January 2027</strong>. CLARITY passed the House in July 2025 and is <strong>still in the Senate</strong> — the Banking Committee markup was indefinitely postponed. The wave is forward-looking, not spent.",
    figs: [["1099-DA", "from 2026"], ["DAC8", "live 1 Jan 2026"], ["GENIUS", "effective Jan 2027"], ["CLARITY", "still in Senate"]],
    srcline: "Elliptic · IRS · EU",
    ours: "Every mandate is a compliance cost on transparent assets and a marketing budget for the one that cannot be enumerated.",
    oursLabel: "Our reading",
    lede: "Four reporting regimes land between 2026 and 2027. None of them can reach an asset whose ledger does not record who paid whom.",
    secs: [
      { h: "What is actually in force", t: "<p><strong>GENIUS is enacted</strong> — signed in 2025 — but takes effect on <em>\"the earlier of (1) 18 months after the date of enactment; or (2) 120 days after the date on which the primary federal payment stablecoin regulators issue any final implementing regulations.\"</em> Elliptic reads the operative date as <strong>January 2027</strong>.</p><p><strong>CLARITY is not law.</strong> It <em>\"passed the US House of Representatives in July 2025 and is undergoing debate in the Senate.\"</em> The Senate Banking Committee markup scheduled for mid-January was <strong>indefinitely postponed</strong> over disagreement about whether stablecoin issuers may pay interest.</p><p>The original version of this thesis said \"the GENIUS and CLARITY Acts now require…\" — that was wrong, and correcting it makes the argument stronger. The compliance burden is <strong>ahead</strong> of the reader, not behind them.</p>" },
      { h: "The reporting stack", dl: [["1099-DA", "US brokers report digital-asset proceeds to the IRS. Final regulations issued; reporting begins with the 2026 filing season."], ["DAC8", "EU directive, live 1 January 2026. Obliges crypto-asset service providers to report customer identity and transaction detail to tax authorities."], ["CARF", "OECD framework DAC8 implements — the same reporting logic, exported to signatory jurisdictions."], ["GENIUS", "Federal stablecoin framework. 100% reserve backing, and the seize-freeze-burn mandate covered under pressure II."], ["CLARITY", "Market-structure bill. House-passed, Senate-pending, contested."]] },
      { h: "Our reading", t: "<p><span class=\"th-tag\">reasoning, not a finding</span></p><p>No source says these mandates create Monero demand. The inference is ours and it is simple: each regime raises the cost of holding a transparent asset through a regulated venue, and none of them has a mechanism that reaches an asset with no readable ledger. A rule that can only be enforced against what it can see is an advertisement for what it cannot.</p>" },
    ],
    srcs: ["ell", "irs99", "rsm", "genius"],
    themes: ["freeze", "state", "future"],
    ans: ["I", "Four reporting regimes land 2026–2027.", "A rule reaches only what it can <b>see</b>. Monero’s ledger records no payer, no payee, no amount."],
  },
  {
    id: "p5",
    numeral: "V",
    num: "V",
    hue: "--th-p5",
    kicker: "Adoption evidence · the leading indicator",
    title: "Nation-State &amp; Illicit Demand",
    card: "Illicit demand is not the thesis — it is the <strong>leading indicator</strong>. The population with the strongest privacy requirement adopts first, and 73 delistings failing to dent on-chain usage is the cleanest evidence available that this demand is inelastic to exchange access.",
    figs: [["48%", "new DNMs XMR-only"], ["73", "delistings in 2025"], ["14–15%", "peers non-standard"], ["usage", "did not contract"]],
    srcline: "TRM Labs 13 Feb 2026",
    lede: "The cleanest natural experiment in crypto: seventy-three exchanges removed access in a single year, and on-chain usage did not fall.",
    secs: [
      { h: "What TRM measured", dl: [["48%", "<em>\"Nearly half (48%) of newly launched darknet markets supported only Monero\"</em> — XMR-exclusive, not XMR-accepting. The direction of travel is exclusivity."], ["73", "<em>\"Some reports suggest there were 73 exchanges delisting Monero in 2025 alone.\"</em> TRM hedges this and so do we — it is quoted with the hedge intact."], ["no contraction", "<em>\"Monero's on-chain usage has not meaningfully contracted\"</em>, and <em>\"transaction volumes in 2024 and 2025 were significantly higher than in the early 2020–2021 period.\"</em>"], ["14–15%", "<em>\"Around 14–15% of reachable peers in the observed Monero network exhibited non-standard behaviour\"</em> — i.e. surveillance of the network layer is being attempted, and detected."]] },
      { h: "Why the delisting number is the interesting one", t: "<p>Delistings are a <strong>supply-of-access</strong> shock. If demand were speculative, removing seventy-three venues in twelve months would show up immediately as reduced on-chain activity — fewer holders, fewer transfers, thinner blocks. It did not.</p><p>That is the definition of <strong>inelastic demand</strong>: the people using it are not using it because it is convenient to buy.</p>" },
      { h: "Two things this point does NOT claim", t: "<p><span class=\"th-tag\">scope</span></p><p><strong>It does not claim illicit use is the thesis.</strong> It claims the illicit margin is the fastest-moving cohort, and therefore the earliest visible signal.</p><p><strong>Two figures from the original version were cut.</strong> \"Monero is mandatory or preferred on 89% of active markets\" and \"monthly transaction volume estimated at $450M+\" appear nowhere in TRM's report and could not be sourced anywhere else. They are gone rather than softened.</p>" },
    ],
    srcs: ["trm"],
    themes: ["privacy", "risk", "future"],
    ans: ["V", "73 venues closed; usage held.", "Demand that survives losing access is <b>need</b>, not speculation — and need is what the protocol serves."],
  },
  {
    id: "p3",
    numeral: "III",
    num: "III",
    hue: "--th-p3",
    kicker: "Surveillance · physical, and contested",
    title: "Surveillance State Expansion",
    card: "You can verify this one by walking outside — and thirty towns have now voted it out. Surveillance stopped being an abstraction about databases and became <strong>infrastructure with a procurement contract</strong>, which is why the public reaction is measurable for the first time.",
    figs: [["76,000", "readers mapped"], ["5,000+", "agencies"], ["30", "localities cancelled"], ["14 days", "one town's retention"]],
    srcline: "NPR 17 Feb 2026 · ACLU · Democracy Now",
    lede: "The awareness is the new variable. Cameras have been spreading for years; organised, funded, city-by-city refusal is recent — and it is what turns a privacy argument into a constituency.",
    secs: [
      { h: "This did not start with cameras — it started in 1994", t: "<p>The Flock network is the visible end of a thirty-year legislative arc, and the arc has one recurring move: <strong>require the capability to be built in, then expand what it covers.</strong></p>", dl: [["1994 · CALEA", "The Communications Assistance for Law Enforcement Act forced telephone companies to <em>\"redesign their network architectures to make it easier for law enforcement to wiretap digital telephone calls.\"</em> Not a warrant power — an <strong>architecture mandate</strong>."], ["2001 · USA PATRIOT Act", "<em>\"Expands the government's authority to monitor phone and email communications\"</em> in the name of national security."], ["2003 · Room 641A", "An AT&amp;T facility used for <em>\"warrantless surveillance\"</em>, with the capability to monitor <em>\"widespread internet activity, domestic and international.\"</em>"], ["2005 · CALEA expanded", "Congress had <em>explicitly exempted</em> internet data in 1994. The FCC extended CALEA anyway — to broadband ISPs and VoIP — after a 2004 petition from the DOJ, FBI and DEA. <strong>The exemption lasted eleven years.</strong>"], ["2008 · Section 702", "<em>\"Authorizes collection of foreign intelligence from non-Americans located outside the United States.\"</em>"], ["2013 · Snowden", "Documents showed the NSA collecting <em>\"phone records from millions of cell phone customers\"</em> and data from social platforms."], ["2015 · USA FREEDOM", "A partial rollback — <em>\"limiting the government's authority to collect data\"</em> after bulk collection was exposed."]] },
      { h: "Why 1994 matters to a page about money", t: "<p><span class=\"th-tag\">reasoning, not a finding</span></p><p>CALEA is the precedent for the GENIUS Act clause in pressure II. Both do the same thing: they do not ask an operator to hand over data on request — <strong>they require the operator to build and maintain the capability in advance.</strong> A wiretap port in a switch; a freeze function in a stablecoin.</p><p>Thirty-one years apart, same architecture mandate, different asset class. And the 2005 expansion is the part worth remembering: <strong>a written exemption is a delay, not a boundary.</strong></p>" },
      { h: "The network today, in numbers", dl: [["5,000+ agencies", "Flock holds contracts with <em>\"more than 5,000 law enforcement agencies across the country.\"</em>"], ["76,000 readers", "DeFlock.me has <em>\"mapped the locations of more than 76,000 license plate readers across the country\"</em> — a crowd-sourced map, which is itself evidence of the awareness this point is named for."], ["30 localities", "<em>\"at least 30 localities that have either deactivated their Flock cameras or canceled their contracts since the beginning of 2025.\"</em>"], ["retention is a dial", "Flagstaff cut its window to <em>\"14 days, down from 30.\"</em> There is no national standard — retention is set locally, which means it can be argued locally."], ["capability creep", "AI video search, live feeds, and <em>\"15-second clips of cars passing by the cameras.\"</em> The plate reader was the wedge, not the product."]] },
      { h: "Why \"blooming awareness\" and not \"cameras on poles\"", t: "<p>The cameras are not the news. <strong>The refusal is.</strong></p><p>The ACLU runs a national campaign against this specific vendor — <em>\"Get the Flock Out\"</em> — and has characterised the business model as <strong>\"Privacy for Profits.\"</strong> Councils are holding hearings. A volunteer project has mapped seventy-six thousand devices. Contracts are being cancelled in places that had already signed them.</p><p>A privacy argument needs an audience that already feels surveilled. For the first time, that audience is forming around a physical object it can point at.</p>" },
      { h: "The link to financial privacy", t: "<p><span class=\"th-tag\">reasoning, not a finding</span></p><p>Nobody in these sources mentions Monero. The connection is ours: a person who has just learned their car's movements are logged and searchable has been handed the concept of <strong>ambient, retained, queryable records of ordinary behaviour</strong>. Financial records are the same category, denser, and older. Awareness travels.</p>" },
    ],
    srcs: ["npr", "aclu", "aclu2", "dn", "calea", "umich", "fcc"],
    themes: ["state", "data", "privacy"],
    ans: ["III", "76,000 readers; 30 towns refusing.", "Awareness of ambient records creates the constituency. <b>Financial records are the densest kind.</b>"],
  },
  {
    id: "p4",
    numeral: "IV",
    num: "IV",
    hue: "--th-p4",
    kicker: "Asymmetry · reasoning, no figures",
    title: "Data Value Appreciation · Privacy Value Appreciation",
    card: "Personal data rises in value and volume without a ceiling. The supply of genuinely private data only ever <strong>shrinks</strong> — every breach, merger and mandate is one-way. <strong>Ledger. Discord. Your exchange.</strong> Nothing puts data back.",
    figs: [["1M+", "Ledger emails, 2020"], ["70,000", "Discord government IDs"], ["Global-e", "Ledger again, Jan 2026"]],
    srcline: "Discord · Have I Been Pwned · Ledger · SiliconANGLE",
    ours: "The breach roster is sourced. What is <em>not</em> sourced — and therefore not claimed — is any aggregate figure for the value of personal data; the aggregators disagree too widely to quote one.",
    oursLabel: "No numbers, deliberately",
    lede: "The only point on this page with no statistics, and it says so. Everything here is an argument you can accept or reject on its logic.",
    secs: [
      { h: "The asymmetry", t: "<p>Two quantities move in opposite directions and neither can reverse.</p><p><strong>The value of a personal record rises.</strong> Every new model, platform, broker and advertiser raises what a behavioural profile is worth. Attention has a market; the inputs to targeting it have a market.</p><p><strong>The stock of private data falls.</strong> Every breach is permanent — data does not become unleaked. Every acquisition merges two profiles into one richer one. Every reporting mandate converts a private record into a filed one. There is no mechanism running the other way.</p><p>So the price of privacy rises on both blades: more valuable to take, scarcer to keep.</p>" },
      { h: "The roster — and why crypto users are on it twice", t: "<p>These are named because they are documented, and because two of them are specifically about people who buy privacy hardware.</p>", dl: [["Ledger · 2020", "<strong>Over 1 million email addresses</strong>, with <em>names, phone numbers and physical addresses</em>. Have I Been Pwned classes it a June 2020 breach. The people exposed were, by definition, people who had bought a device to protect their crypto — and the leak told the world <strong>where they live</strong>."], ["Ledger · again, 2026", "January 2026: Ledger confirmed customer names and contact data leaked through its payments partner <strong>Global-e</strong>. Same company, six years later, different vendor."], ["Discord · 2025", "<strong>~70,000 users had government-ID photos exposed</strong> — Discord's own words: <em>\"approximately 70,000 users that may have had government-ID photos exposed.\"</em> Also names, emails, IP addresses, partial card data and support-chat transcripts. The vendor was <strong>5CA</strong>, a third-party support contractor."], ["The pattern", "Ledger did not lose the data. Discord did not lose the data. <strong>Their vendors did.</strong> You cannot audit a company's subcontractors, and consent you gave to one party ends up held by parties you never heard of."]] },
      { h: "Why there are no aggregate numbers here", t: "<p><span class=\"th-tag\">deliberate omission</span></p><p>The named breaches above are sourced to the companies' own disclosures. What is <em>not</em> here is a headline aggregate — \"$X billion data-broker market\", \"Y billion records breached this year\". We looked. Those totals exist in abundance and the aggregators disagree by margins wide enough that quoting any single one would be choosing a number rather than reporting one. The primary research is paywalled.</p><p>This site gates a claim that no number is invented. A figure we cannot source is worse than no figure, so this panel carries none — and the argument stands on its own shape instead.</p>" },
      { h: "Where Monero enters", t: "<p><span class=\"th-tag\">reasoning, not a finding</span></p><p>Financial data is the densest personal record there is. A transaction history reveals location, relationships, health, employment, politics, addiction and habit in a single stream, and it is retained by default.</p><p>Monero is the only widely-used money where that record <strong>is not created in the first place</strong>. Not access-controlled, not encrypted-at-rest, not deleted on request — never written. That is a different kind of protection from every other privacy promise a reader has been offered.</p>" },
    ],
    srcs: ["hibp", "ledceo", "led26", "disc"],
    themes: ["data", "privacy", "future"],
    ans: ["IV", "Data appreciates; privacy only shrinks.", "The one record Monero <b>never creates</b> is the one worth most — and the only one you cannot get back."],
  },
  {
    id: "p2",
    numeral: "II",
    num: "II · the hinge",
    hue: "--th-p2",
    kicker: "Freezable money, traceable money, and a prison sentence",
    title: "Privacy as a service has an operator. Privacy as a property does not.",
    cardHTML: "<p style=\"margin:0 0 10px\">Three facts, one shape. <strong>Stablecoins are freezable by statute</strong> — GENIUS requires issuers to hold the technical capability to seize, freeze and burn. <strong>Bitcoin privacy is a service</strong>, so it has a CEO, and he is serving five years. <strong>Monero privacy is a protocol property</strong> — there is no operator to indict and no switch to reach.</p><p style=\"margin:0\">This is the panel that makes the argument for Monero <em>specifically</em>, rather than for privacy in general.</p>",
    figs: [["Rodriguez", "5 years"], ["Hill", "4 years"], ["$237M", "proceeds"], ["80,000 BTC", "through the service"], ["$3.29B", "USDT frozen"], ["7,268", "addresses blacklisted"]],
    srcline: "IRS-CI · Skadden · Federal Register · AMLBot",
    lede: "The strongest point on the page, because it is the only one where the mechanism is visible rather than inferred.",
    secs: [
      { h: "1 · Stablecoins are freezable — and it is a legal requirement, not a flaw", t: "<blockquote>Issuers will need to have the technological capability to comply with all lawful orders to seize, freeze, burn or prevent the transfer of outstanding stablecoins.<cite>Skadden, on the GENIUS Act · July 2025</cite></blockquote><p>Treasury's implementing rule goes further, requiring <em>\"maintenance of technical capabilities, policies, and procedures to block, freeze, and reject specific or impermissible transactions\"</em> — and defines a lawful order as one <em>\"issued or promulgated by a Federal agency or court to seize, freeze, burn, or prevent the transfer of payment stablecoins.\"</em></p><p><strong>Read that as a design spec.</strong> A compliant dollar-stablecoin is required by law to be confiscatable at the protocol level. That is not a scandal; it is the product working as legislated. But it means \"digital dollars\" and \"your money\" are not the same sentence.</p>" },
      { h: "It is already routine, at scale", dl: [["$3.29B", "USDT frozen, 2023–2025."], ["7,268", "USDT addresses blacklisted."], ["$1.75B", "of that frozen on TRON alone."], ["$109M", "USDC frozen, across 372 addresses."], ["~30×", "the scale gap between the two issuers in both value and address count."]] },
      { h: "2 · Bitcoin privacy had an operator, and he was sentenced", t: "<blockquote>The sentences the defendants received send a clear message that laundering known criminal proceeds — regardless of the technology used or whether the proceeds are in the form of fiat or cryptocurrency — will face serious consequences.<cite>Nicolas Roos, prosecuting · IRS Criminal Investigation</cite></blockquote>", dl: [["Keonne Rodriguez", "CEO of Samourai Wallet. <strong>5 years</strong>, sentenced 6 November 2025."], ["William Lonergan Hill", "CTO. <strong>4 years</strong>, sentenced 19 November 2025."], ["The charge", "Conspiracy to operate a money transmitting business while knowingly transmitting criminal proceeds."], ["$237 million", "Criminal proceeds laundered through the service."], ["80,000+ BTC", "<em>\"valued at over $2 billion at the time\"</em> — total volume through Whirlpool and Ricochet per the indictment."], ["$6,367,139.69", "Forfeited between them, plus $250,000 fines and 3 years supervised release each."]] },
      { h: "3 · The structural difference", t: "<p><span class=\"th-tag\">reasoning, and the core of the thesis</span></p><p>Bitcoin is transparent by design, so privacy on Bitcoin must be <strong>added</strong> — by a mixer, a coinjoin coordinator, a service. Anything added has a provider, and a provider has a name, a jurisdiction, a bank account and a criminal exposure. Samourai is what that exposure looks like when it is realised.</p><p>Monero is private <strong>at the base layer</strong>. Ring signatures, stealth addresses and RingCT are not a feature switched on by a company; they are how a transaction is constructed. There is no coordinator to charge, no premises to raid, no company to serve with a lawful order, and — critically — <strong>no capability to seize, freeze or burn for a court to compel</strong>, because the protocol never had one to build.</p><p>Stablecoins can be frozen because the law requires the switch to exist. Bitcoin privacy can be prosecuted because the service has an owner. Monero has neither switch nor owner. <strong>That is the whole thesis in one paragraph.</strong></p>" },
    ],
    srcs: ["irs", "skad", "fedreg", "genius", "aml"],
    themes: ["freeze", "trace", "risk", "privacy"],
    ans: ["II", "Freezable by statute. Prosecutable as a service.", "No switch to compel, no operator to charge. <b>Privacy as a property, not a permission.</b>"],
  },
  {
    id: "p6",
    numeral: "VI",
    num: "VI",
    hue: "--th-p6",
    kicker: "Geopolitics · a prediction, labelled",
    title: "Sanctioned States",
    card: "Chainalysis does <strong>not</strong> say sanctioned actors are moving to Monero. It says they moved $104bn on chains it can read, and that it can attribute Iranian flows specifically. The exit inference is ours, and conditional.",
    figs: [["$104bn", "sanctioned flows, 2025"], ["694%", "year-over-year surge"], ["~$3bn", "Iran"], ["$154bn", "all illicit volume"]],
    srcline: "Chainalysis 2026 Crypto Crime Report · 6 Mar 2026",
    ours: "An actor whose $3bn is counted and published annually has two options: stop transacting, or transact where attribution fails. <em>If</em> forensics keep improving, <em>then</em> the exit is toward opacity.",
    oursLabel: "Ours, and conditional",
    lede: "The most-abused argument in the privacy-coin case, presented with its inference marked as an inference.",
    secs: [
      { h: "What Chainalysis actually reports", dl: [["$104 billion", "<em>\"Sanctioned entities moved $104 billion in cryptocurrency throughout 2025.\"</em>"], ["694%", "The year-over-year surge in sanctions evasion through crypto."], ["~$3 billion", "Iranian entities — <em>\"total transfers reaching $3 billion for the year.\"</em>"], ["$154 billion", "Total illicit volume identified across the 2026 report."]] },
      { h: "The part that is a prediction", t: "<p><span class=\"th-tag\">ours, conditional, not a finding</span></p><p>Chainalysis makes no claim about migration to privacy coins. What its report demonstrates is something subtler and more useful: <strong>these flows were measured</strong>. Attributed to a country. Published in a report. Annually.</p><p>An actor operating under sanctions who reads that has learned their evasion channel is instrumented. There are two responses — reduce transacting, or move to a channel where attribution fails. Which one they choose is not in any dataset we have.</p><p>So the honest form is conditional: <em>if</em> chain forensics continue improving, <em>then</em> pressure on sanctioned actors moves toward assets where attribution does not work. Monero is the largest such asset. <strong>That is a forecast, and this panel labels it one.</strong></p>" },
      { h: "What was cut from the original, and why", t: "<p>The earlier version of this point claimed the cost to mine one Bitcoin in Iran was <strong>≈$1,320 against a market price of ~$68,000</strong> — a stated arbitrage.</p><p>Both halves failed. The only sourceable analysis of Iranian mining economics is Elliptic's, and it is <strong>May 2021</strong>: 4.5% of global hashrate, roughly $1bn annualised, ~10 million barrels of oil equivalent per year. Five years stale. And the $68,000 reference price has not been current for a long time.</p><p>Elliptic's framing does survive as context — Iran <em>\"effectively selling its energy reserves on the global markets, using the Bitcoin mining process to bypass trade embargoes\"</em> — but it is cited <strong>as of 2021 only</strong>, and no arbitrage figure appears on this page.</p>" },
    ],
    srcs: ["cha", "chasanc", "bh", "ell21"],
    themes: ["trace", "risk", "state"],
    ans: ["VI", "$104bn measured, attributed, published.", "Pressure runs toward wherever <b>attribution fails</b>. One asset is built so it does."],
  },
  {
    id: "p7",
    numeral: "VII",
    num: "VII",
    hue: "--th-p7",
    kicker: "Protocol · no committed fork date",
    title: "Monero Exponentially Develops Onwards",
    card: "FCMP++ replaces 16-member decoy rings with membership proofs over the <strong>entire UTXO set</strong>. CARROT has been formally audited. <code>fcmp++ hf</code> is a tracked milestone in monero-project, not a press release.",
    figs: [["alpha stressnet", "block 2847330"], ["CARROT", "audited"], ["fork date", "not committed"], ["ring 16", "→ whole set"]],
    srcline: "Monero Observer 29 Sep 2025 · monero-project · moneroresearch.info",
    lede: "Every other pressure on this page is external. This one is the asset answering.",
    secs: [
      { h: "What is documented", dl: [["Alpha stressnet", "v0.19.0.0-alpha.1 released for public testing. Monero Observer's own words: <em>\"this is ALPHA software, and will likely have bugs.\"</em>"], ["Testnet fork", "<em>\"scheduled to hard fork from the current testnet on October 3rd, 2025, at block 2847330.\"</em>"], ["Tracked work", "<code>fcmp++ hf</code> is an open milestone in <code>monero-project/monero</code> — issues and PRs, not an announcement."], ["CARROT audit", "<em>An Audit of the FCMP++ Addressing Protocol: CARROT</em>, published via moneroresearch.info."], ["Mainnet date", "<strong>Not committed.</strong> Any date you read elsewhere is a working plan, non-binding."]] },
      { h: "What FCMP++ changes", t: "<p>Today a Monero input is hidden among <strong>16</strong> possible sources — a ring. Chain analysis against rings is hard but finite, and the decoy set is the bound on it.</p><p>Full-Chain Membership Proofs replace the ring with a proof that the spent output is <strong>somewhere in the entire set of outputs that has ever existed</strong>. The anonymity set stops being 16 and becomes the chain.</p><p><span class=\"th-tag\">note on figures</span> The original version of this thesis quoted \"150M+ UTXOs\". That number is unsourced here on purpose — <strong>this site runs its own node</strong>, and a page that can query the live chain should publish a measured count with a timestamp rather than repeat a remembered one.</p>" },
      { h: "And the honesty constraint", t: "<p>This site already maintains a page whose entire job is not overstating the roadmap. This panel matches it: alpha means alpha, an audit of the addressing protocol is not an audit of the whole system, and no mainnet fork date is committed.</p><p>The argument does not need a date. It needs the direction, which is documented: <strong>the privacy floor is rising while the surveillance pressure rises.</strong></p>" },
    ],
    srcs: ["mo", "hf"],
    themes: ["privacy", "future", "trace"],
    ans: ["VII", "Ring of 16 → the entire UTXO set.", "The floor rises while the pressure does. <b>The only line on this page moving in your favour.</b>"],
  },
];

/** Hue for a numeral. DERIVED from the pressures rather than restated — the
 *  mockup's HUEBY was a second copy of a value each pressure already carries,
 *  and the generator refuses to emit if the two ever disagree. */
export function hueOf(numeral: string): string {
  return THESIS_PRESSURES.find((p) => p.numeral === numeral)?.hue ?? "--ink-40";
}

/** Sorted-pair key for two numerals, in THESIS_ORDER. */
export function pairKey(a: string, b: string): string {
  const i = (n: string) => THESIS_ORDER.indexOf(n as ThesisNumeral);
  return i(a) <= i(b) ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Why each pair of pressures overlaps — written, not generated. Exactly the
 * 21 unordered pairs over the 7 numerals, every key sorted by
 * THESIS_ORDER. verify-thesis.mjs DERIVES that set and diffs it, so an eighth
 * pressure reds here rather than silently losing links.
 *
 * ONE ENTRY IS UNREACHABLE AND IT IS NAMED RATHER THAN DELETED: the
 * correlation list pairs panels by SHARED THEME, and IV (data · privacy ·
 * future) shares none with VI (trace · risk · state), so WHY["IV|VI"] is
 * never rendered. It is kept because the set is the 21 pairs by construction
 * and a hole in it would be the harder thing to notice; the gate asserts
 * 21 declared AND 20 reachable with the dead pair named, so a SECOND one
 * appearing is a build failure rather than a silent loss.
 */
export const THESIS_WHY: Readonly<Record<string, string>> = {
  "I|II": "Both are architecture mandates: CALEA-style rules that require the capability to exist before anyone asks for it.",
  "I|III": "State capacity expanding on two fronts at once — paperwork and physical infrastructure.",
  "I|IV": "Every reporting regime converts a private record into a filed one — supply of privacy falls by statute.",
  "I|V": "Mandates raise the cost of regulated venues; the margin that already left is where that shows first.",
  "I|VI": "The same reporting apparatus that files your trades is what attributes a sanctioned state's flows.",
  "I|VII": "The rules arrive on a schedule. So does the protocol work. Only one of them is on your side.",
  "II|III": "Both show capability built in advance: a freeze function in a coin, a reader on a pole.",
  "II|IV": "A frozen balance and a leaked address are the same failure — a record someone else controls.",
  "II|V": "Delistings and freezes are both access being withdrawn. Usage held through one; the other has no switch to pull.",
  "II|VI": "Traceability is the shared mechanism: it is what makes a freeze targetable and a sanction enforceable.",
  "II|VII": "The exact gap FCMP++ widens — no operator, and now no practical analysis either.",
  "III|IV": "Cameras are how a person first learns their ordinary behaviour is retained and queryable. Financial records are the same category, denser.",
  "III|V": "Both measure a population responding to surveillance — one by cancelling contracts, one by changing rails.",
  "III|VI": "Domestic and foreign faces of the same instrument: ambient collection, then attribution.",
  "III|VII": "Surveillance capability rises; the privacy floor rises to meet it. This page is that race.",
  "IV|V": "The value of a private record is highest for those who most need it — and they adopted first.",
  "IV|VI": "A sanctioned state and a breached user share one problem: a record they cannot unmake.",
  "IV|VII": "Monero is the only case where the appreciating asset is never created in the first place.",
  "V|VI": "The same demand, at two scales — individuals at the margin, and states at the treasury.",
  "V|VII": "Demand proved inelastic before the protocol got stronger. VII is the tailwind on an already-standing case.",
  "VI|VII": "If attribution is the pressure, membership proofs over the whole set are the answer to it.",
};
