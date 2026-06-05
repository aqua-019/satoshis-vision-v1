# METAPHORS · further analogical visualizations

Catalog of metaphor-driven visualizations for Monero concepts. Each is
pickable — they're independent. Sorted by what they explain.

Built ones live in `src/protocols/` already. The rest are sketches —
budget ~2-3 days each to build.

---

## ✅ Built · in this codebase

| Concept | Metaphor | File |
|---|---|---|
| Decoy selection | **Time tide** — buoys on a log-normal wave | `protocols/decoy-selection.jsx` |
| Dandelion++ | **Botanical dandelion** — stem grows, fluff bursts | `protocols/dandelion.jsx` |
| View tags | **Lighthouse in fog** — 256× scanner race | `protocols/view-tags.jsx` |
| RingCT | **Assembly line** — 5 cryptographic stations | `protocols/ringct.jsx` |
| Stealth addresses | **Two-key chamber** — DH ≡ across silent rooms | `protocols/stealth.jsx` |
| FCMP++ | **Murmuration** — 16 → 150M+ starling cloud | `protocols/fcmp.jsx` |

---

## 🟧 Strong candidates · to build next

### Tail emission · *the eternal hearth*
A fireplace. The big logs (block subsidy) burn out over 8 years and turn
to embers. But the hearth never goes cold — a tiny stream of fuel (the
0.6 XMR tail emission) keeps the fire alive forever. Use this as the
hero on a "Why Monero won't die" page.

Visual ingredients: burning logs that consume over time (rendered as a
height-decreasing flame), an ember bed below, a continuous trickle of
small embers entering from the side. Annotations show "Year 1: 60% from
subsidy", "Year 8: 50/50", "Year 50: 99% from tail".

### Block target · *the metronome*
A wood-cased metronome ticking at exactly 120s. Compare with Bitcoin's
600s, Ethereum's 12s. The arm swings; each "tick" produces a glowing
block crystal. Demonstrates predictable cadence vs probabilistic miner
luck.

### Hashrate · *the lighthouse rotation*
A massive lighthouse lamp rotating. Sweep speed = hashrate. As difficulty
adjusts, the lamp gets heavier/lighter; the rotation speed stays
constant. Demonstrates "difficulty tracks hashrate" without graphs.

### Difficulty adjustment · *thermostat*
A wall thermostat with a constantly-adjusting setpoint. The room
temperature (hashrate) drifts; the thermostat (difficulty) compensates
every ~720 blocks (~24h) to keep the perceived block time at exactly
2:00. Show two needles — one chasing the other.

### Mempool fees · *bidding auction*
A live auction hall. Each tx is a paddle with a fee number. Blocks open
every 2 minutes; the highest 100-ish paddles get a seat. Lower paddles
return to the room for the next round. Beautiful when slow + dense.

### Monetary policy · *grain silo + faucet*
A grain silo (current supply) with a faucet at the top. The faucet
drips emission. Compare:
- **Bitcoin silo**: faucet pours hard then shuts off. After year ~2140,
  zero new grain. Silo grows asymptotically.
- **Monero silo**: faucet pours hard, slows, then settles at the tail
  trickle. Forever. Linear supply growth in the limit.

Use this to discuss the *security budget* honestly — Bitcoin's drying
faucet, Monero's eternal one.

### Pool decentralization · *the city skyline*
Pool dominance rendered as a city skyline. Each pool a building, height
= hashrate share. P2Pool is the cathedral (decentralized, no fee).
Color the centralized pools red, the decentralized ones green. Skyline
*changes silhouette* over weeks as miners migrate. Add a "decentralization
HHI" gauge — Herfindahl-Hirschman Index, gold standard for measuring
concentration.

### Atomic swap · *handshake over a chasm*
Two people standing on cliffs across a gorge. They want to exchange
boxes (XMR and BTC) without trusting each other. A series of
time-locked drops. Show the protocol step-by-step. Educational gem.

### Wallet sync · *librarian shelving books*
Without view tags: librarian walks every shelf, reads every spine.
With view tags: librarian sees colored dots on each spine; she ignores
every dot that isn't hers. Companion to the lighthouse-in-fog
visualization — more "low-tech" feel.

### Key images · *the inkpad stamp*
A custodial inkpad. Each spent output gets a deterministic ink-print on
a public board. If two spends try to use the same key, their stamps
match — and the network refuses the duplicate. No revealed identity,
just "this one already left a print here".

### Ring signature math · *the rosary*
A 16-bead rosary. Each bead is a possible signer's public key. The real
signer's bead is hidden among 15 others, but the *chain* (the linkable
group element) ties them together without revealing which bead the
prayer started at.

### Bulletproofs+ · *the press*
A printing press / textile loom that takes wide raw data (a number's
binary range proof) and compresses it into a tightly-folded artifact
that's log-size to verify. Show before/after byte counts.

### CLSAG signing · *the wax seal*
A wax-stamp ceremony. 16 stamps fall onto the document at once; only
one was held by a hand. The verifier sees an even spread of wax — no
hint at which hand pressed.

### Network growth · *coral reef*
The full P2P topology rendered as growing coral, polyp by polyp.
Watching a year of node growth as a time-lapse. Each node a polyp;
each connection a coral branch. Beautiful.

### Privacy attacks · *the bloodhound*
A bloodhound following a scent trail. Each Monero privacy primitive
adds *masking smell* that confuses the hound:
- Ring signatures = 15 false trails
- Dandelion++ = the trail leads to a peer who didn't originate it
- Stealth addresses = there's no recurring scent across visits
- FCMP++ = the entire forest smells the same

Demonstrate each defense as a hound losing the trail at a different
station.

### Confidential amounts · *envelope on a balance*
A two-pan balance with sealed envelopes. The balance still works (you
can confirm in=out) without anyone opening any envelope. This is the
intuition for Pedersen commitments and the rangeproof — the contents
remain sealed, but the conservation property is publicly verifiable.

### View key vs spend key · *the keyholder split*
A safe with two keyholes — one labeled "see", one labeled "open". A
viewer-only wallet has the see-key; auditors, tax tools, kids. The
spend-key stays in the cold side of the wallet. Beautiful little
analogy for hardware wallets + watch-only.

### Sub-addresses · *post office mailboxes*
A single physical address (the main one) splits into 2³² mailboxes via
sub-address indexing. Each mailbox keeps payments separate to your
view, but to everyone outside they all look like normal one-time
outputs. Companion to the chamber visualization for stealth addresses.

### Tor + I2P routing · *underground network of pneumatic tubes*
The blockchain runs over the open internet; some peers tunnel through
Tor and I2P pipes hidden below ground. Show transactions taking
unpredictable routes through both above- and below-ground networks.

### Atomic units · *the grain of sand*
1 XMR = 1e12 piconero. Show a beach scene where each grain is one
piconero. Zoom out: handful → cup → bucket → ton → 1 XMR. Calibrates
intuition for the unit system.

---

## 🟨 Storytelling visualizations (not protocol-specific)

### The history of Monero · *the genealogy tree*
Bytecoin → CryptoNote → Monero ↘ many forks → MoneroV, Wownero, etc.
A branching botanical tree with dates, key contributors at each branch.

### IRS bounty timeline · *the wall of failed attempts*
A scoreboard wall with attempts by Chainalysis, Integra, CipherTrace.
Each entry has: bounty $, year, the technique they tried, status
(failed / partial / ongoing). Underline the message: "after a decade
of failed contracts, Monero is still off-limits".

### Privacy bit-by-bit · *cumulative shielding*
A figure standing in a square. With nothing: fully visible. Add
ring-16: partially shielded. Add Dandelion++: source obscured. Add
stealth address: no name. Add RingCT: no amount. Add view-tag: no
performance penalty. Add FCMP++: blended into 150M+ figures behind.
Each layer adds shading until the figure is gone.

### Comparison wall · *tarot deck*
Mini cards for each privacy coin (Monero, Zcash, Dash, Aztec, Iron
Fish, etc.) — front is hero stat, back is honest tradeoffs. Educational
counter-FUD piece.

---

## 🟪 For the **Home** page specifically

Reimagine your existing radar circle as a **live anonymity-set
nebula** — a cloud of points whose density grows toward 150M as you
scroll. The price callout sits inside the nebula. Visually says
"every output is hiding somewhere in this cloud".

Alternative home metaphors:
- **The lantern** — XMR as a lantern in a dark room, casting selective
  light only where the holder chooses
- **The constellation** — your existing fav, expanded with a map of
  the whole site as a node graph
- **The hearth** — the tail-emission fireplace as the dominant visual
  for the front page (warmth, permanence)

---

## Authoring guidance

Good metaphor pages:
- One central visual that animates on first paint, then stabilizes
- A serif lede sentence ("A dandelion. The transaction is...")
- A 4–5 step explanation with numbered chrome
- A parameters panel with the actual canonical values
- A footer caveat: "This is educational, not a cryptographic reference"
- Cross-links to related simulations

Bad metaphor pages:
- Too many simultaneous animations
- Math notation without the visual first
- Generic crypto art (chains, gold coins, padlocks)
- Anything that requires text-walls of explanation before the picture makes sense
