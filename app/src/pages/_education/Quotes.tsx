// Quotes.tsx — /education/quotes
// The Satoshi quote archive — primary-source forum posts and emails,
// categorized and weighted toward privacy / Monero-predictive language.

import * as React from "react";
import { PageHeader } from "@/layout/AppShell";

const Q_CATS = ["all", "privacy", "philosophy", "technical", "economics", "security", "farewell"] as const;
type QCat = typeof Q_CATS[number];

const Q_LABEL: Record<QCat, string> = { all: "All", privacy: "Privacy", philosophy: "Philosophy", technical: "Technical", economics: "Economics", security: "Security", farewell: "Farewell" };

interface Quote {
  c: Exclude<QCat, "all">;
  key?: boolean;
  t: string;
  s: string;
  d: string;
}

const QUOTES: Quote[] = [
  // privacy
  { c: "privacy", key: true, t: "What we need is a way to generate additional blinded variations of a public key. The blinded variations would have the same properties as a public key and could be used to receive payments. Others could not tell the blinded public keys belong to the owner of the original public key.", s: "BitcoinTalk Thread #174", d: "August 11, 2010" },
  { c: "privacy", key: true, t: "With group signatures, it is possible for something to be signed but not know who signed it.", s: "BitcoinTalk Thread #174", d: "August 11, 2010" },
  { c: "privacy", key: true, t: "The network would track a bunch of independent outpoints. It doesn't know what transactions or amounts they belong to. A private key could have a counter so you can derive any number of random variations of the public key.", s: "BitcoinTalk Thread #174", d: "August 11, 2010" },
  { c: "privacy", key: true, t: "It's hard to think of how to apply zero-knowledge-proofs in this case. We're trying to prove the absence of something, which seems to require knowing all of something and that's a lot.", s: "BitcoinTalk Thread #174", d: "August 10, 2010" },
  { c: "privacy", key: true, t: "If we have to hide transaction amounts, we'd need something like David Chaum's approach. Transactions would be split into standard denominations.", s: "BitcoinTalk Thread #174", d: "August 13, 2010" },
  { c: "privacy", t: "For privacy, it's best to use new addresses for each transaction. Your client creates new addresses automatically, but you need to remember to use them.", s: "BitcoinTalk Thread #82", d: "July 8, 2010" },
  { c: "privacy", t: "The possibility of a pseudo-anonymous currency is not on any regulatory radar at this point. When they notice Bitcoin, they'll focus on the normal KYC procedures at the exchange endpoints.", s: "BitcoinTalk Thread #82", d: "July 8, 2010" },
  // philosophy
  { c: "philosophy", key: true, t: "The root problem with conventional currency is all the trust that's required to make it work. The central bank must be trusted not to debase the currency, but the history of fiat currencies is full of breaches of that trust.", s: "P2P Foundation", d: "February 11, 2009" },
  { c: "philosophy", key: true, t: "With e-currency based on cryptographic proof, without the need to trust a third party middleman, money can be secure and transactions effortless.", s: "P2P Foundation", d: "February 11, 2009" },
  { c: "philosophy", t: "A lot of people automatically dismiss e-currency as a lost cause because of all the companies that failed since the 1990s. I hope it's obvious it was only the centrally controlled nature of those systems that doomed them.", s: "P2P Foundation", d: "February 11, 2009" },
  { c: "philosophy", t: "If you don't believe me or don't get it, I don't have time to try to convince you, sorry.", s: "BitcoinTalk", d: "July 29, 2010" },
  { c: "philosophy", t: "It's very attractive to the libertarian viewpoint if we can explain it properly. I'm better with code than with words though.", s: "Email to Hal Finney", d: "November 2008" },
  { c: "philosophy", t: "I am not Dorian Nakamoto.", s: "P2P Foundation (after 5 years of silence)", d: "March 7, 2014" },
  { c: "philosophy", key: true, t: "The Times 03/Jan/2009 Chancellor on brink of second bailout for banks", s: "Genesis Block Coinbase", d: "January 3, 2009" },
  // technical
  { c: "technical", key: true, t: "We have proposed a system for electronic transactions without relying on trust.", s: "Bitcoin Whitepaper", d: "October 31, 2008" },
  { c: "technical", t: "The nature of Bitcoin is such that once version 0.1 was released, the core design was set in stone for the rest of its lifetime.", s: "BitcoinTalk", d: "June 17, 2010" },
  { c: "technical", t: "As long as a majority of CPU power is controlled by nodes that are not cooperating to attack the network, they'll generate the longest chain and outpace attackers.", s: "Bitcoin Whitepaper", d: "October 31, 2008" },
  { c: "technical", t: "The Bitcoin network might actually reduce spam by diverting zombie farms to generating bitcoins instead.", s: "Cryptography Mailing List", d: "November 14, 2008" },
  { c: "technical", t: "SHA-256 is very strong. It's not the same as the stepping from MD5 to SHA1. It can last several decades unless there's some massive breakthrough attack.", s: "BitcoinTalk", d: "June 14, 2010" },
  { c: "technical", t: "I'm sure that in 20 years there will either be very large transaction volume or no volume.", s: "BitcoinTalk", d: "February 14, 2010" },
  // economics
  { c: "economics", key: true, t: "Banks must be trusted to hold our money and transfer it electronically, but they lend it out in waves of credit bubbles with barely a fraction in reserve.", s: "P2P Foundation", d: "February 11, 2009" },
  { c: "economics", t: "Lost coins only make everyone else's coins worth slightly more. Think of it as a donation to everyone.", s: "BitcoinTalk", d: "June 21, 2010" },
  { c: "economics", t: "In a few decades when the reward gets too small, the transaction fee will become the main compensation for nodes.", s: "BitcoinTalk", d: "February 14, 2010" },
  { c: "economics", t: "The price of any commodity tends to gravitate toward the production cost. If the price is below cost, then production slows down. If the price is above cost, profit can be made by generating and selling more.", s: "BitcoinTalk", d: "February 21, 2010" },
  { c: "economics", t: "It might make sense just to get some in case it catches on. If enough people think the same way, that becomes a self fulfilling prophecy.", s: "Cryptography Mailing List", d: "January 17, 2009" },
  // security
  { c: "security", t: "The software is not at all resistant to DoS attack. This is one improvement, but there are still more ways to attack than I can count.", s: "BitcoinTalk", d: "December 5, 2010" },
  { c: "security", t: "Imagine someone stole something from you. You can't get it back, but if you could, if it had a kill switch that could be remote triggered, would you do it?", s: "BitcoinTalk", d: "August 2010" },
  // farewell
  { c: "farewell", key: true, t: "WikiLeaks has kicked the hornet's nest, and the swarm is headed towards us.", s: "BitcoinTalk — Final Public Post", d: "December 5, 2010" },
  { c: "farewell", key: true, t: "I've moved on to other things. It's in good hands with Gavin and everyone.", s: "Email to Mike Hearn", d: "April 23, 2011" },
  { c: "farewell", t: "It would have been nice to get this attention in any other context.", s: "BitcoinTalk", d: "December 5, 2010" },
  { c: "farewell", t: "I make this appeal to WikiLeaks not to try to use Bitcoin. Bitcoin is a small beta community in its infancy. You would not stand to get more than pocket change, and the heat you would bring would likely destroy us at this stage.", s: "BitcoinTalk", d: "December 5, 2010" },
];

function QuoteCard({ q }: { q: Quote }) {
  return (
    <figure style={{ margin: 0, breakInside: "avoid", display: "flex", flexDirection: "column", gap: 14, padding: "20px 22px", borderRadius: 3, marginBottom: 14,
      border: "1px solid " + (q.key ? "rgba(255,122,26,0.35)" : "var(--rule)"),
      borderLeft: "2px solid " + (q.key ? "var(--tk-accent)" : "var(--ink-20)"),
      background: q.key ? "rgba(255,122,26,0.03)" : "rgba(8,7,5,0.6)" }}>
      {q.key ? <div className="mono" style={{ fontSize: 9, letterSpacing: "0.18em", color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>★ KEY</div> : null}
      <blockquote className="serif" style={{ margin: 0, fontSize: 18, lineHeight: 1.5, color: "var(--ink-100)", fontStyle: "italic" }}>"{q.t}"</blockquote>
      <figcaption className="mono" style={{ fontSize: 11, color: "var(--ink-60)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={{ color: "var(--ink-100)" }}>Satoshi Nakamoto</span>
        <span className="dim2">{q.s} · {q.d}</span>
      </figcaption>
    </figure>
  );
}

export function EduQuotes() {
  const [cat, setCat] = React.useState<QCat>("all");
  const shown = QUOTES.filter((q) => cat === "all" || q.c === cat);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader kicker={"Complete archive · " + QUOTES.length + " quotes"}
        title='Satoshi, in <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">his own words</em>'
        sub="Primary-source forum posts and emails — weighted toward the privacy discussions that predicted Monero's core design." />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Q_CATS.map((k) => {
          const on = cat === k;
          const n = k === "all" ? QUOTES.length : QUOTES.filter((q) => q.c === k).length;
          return (
            <button key={k} type="button" onClick={() => setCat(k)}
              style={{ appearance: "none", cursor: "pointer", background: on ? "rgba(255,122,26,0.1)" : "transparent",
                border: "1px solid " + (on ? "var(--tk-accent)" : "var(--ink-20)"), borderRadius: 999, padding: "6px 14px",
                color: on ? "var(--tk-accent)" : "var(--ink-60)", fontFamily: "var(--f-mono)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase",
                textShadow: on ? "var(--glow-1)" : "none" }}>
              {Q_LABEL[k]} <span className="dim2" style={{ fontSize: 9 }}>{n}</span>
            </button>
          );
        })}
      </div>

      <div style={{ columns: 2, columnGap: 14 }}>
        {shown.map((q, i) => <QuoteCard key={i} q={q} />)}
      </div>
    </div>
  );
}
