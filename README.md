```
                         *#%%+%%%=*    *=%%%+%%#*
                       +##%%%+%##=#****#=##%+%%%##+
                      -****##=##*=**++**=*##=##****-
                    -:.:+**##=###=**++**=###=##**+:.:-
                *##**++:--#%%+%%%+%####%+%%%+%%#--:++**##*
               #%%##***##---@+@@@+%%%%%%+@@@+@---##***##%%#
              #%%%######%%@@---@@@@@%%@@@@@---@@%%######%%%#
              #%%%##*##%%%@@@@---@@@%%@@@---@@@@%%%##*##%%%#
               ####***##%%@@@@@@---@%%@---@@@@@@%%##***####
                =***++**#%%%%@@@@%%%##%%%@@@@%%%%#**++***=
                =***++**#%%%%@@@@%%%##%%%@@@@%%%%#**++***=
               ####***##%%@@@@@@---@%%@---@@@@@@%%##***####
              #%%%##*##%%%@@@@---@@@%%@@@---@@@@%%%##*##%%%#
              #%%%######%%@@---@@@@@%%@@@@@---@@%%######%%%#
               #%%##***##---@+@@@+%%%%%%+@@@+@---##***##%%#
                *##**++:--#%%+%%%+%####%+%%%+%%#--:++**##*
                    -:.:+**##=###=**++**=###=##**+:.:-
                      -****##=##*=**++**=*##=##****-
                       +##%%%+%##=#****#=##%+%%%##+
                         *#%%+%%%=* ###*=%%%+%%#*
                                    |##|
                                    |###
                                     ###|
                                     |##|
                                      ###
                                      |##|
```

# Satoshi's Vision Archive — xmr.irish

An educational site on Bitcoin's surveillance trajectory and Monero's privacy
architecture, rendered from live chain and market data.

**Live**: [xmr.irish](https://xmr.irish)

This file is not a contributor's map. It is a statement of how this site treats
the people who read it, and every claim in it names the thing in this
repository that enforces it — a file, a header, or a build gate. An ethos you
cannot check is a slogan.

---

## What this is

A teaching tool and a blockchain explorer at the same time. The explanations
sit beside the live chain they describe, so a claim made here can be checked
against the numbers on the same screen.

It is non-profit. There is nothing to buy, no account to make, no wallet to
connect. **The site is read-only and non-custodial: it holds no funds, takes
custody of nothing, and has no mechanism by which anything on it can move
money.**

---

## How this site treats you

Each row names the mechanism. Every one is in this repository.

| Claim | Mechanism, and where to check it |
|---|---|
| **Your browser reaches no third party.** | `Content-Security-Policy: … connect-src 'self'` in `vercel.json`. The browser is *forbidden* to open a connection to another origin. Gated by `app/verify-origins.mjs`, which sweeps the source tree for off-origin fetches **and** drives the site in a real browser counting the requests that actually leave. |
| **No analytics, beacons, tracking pixels, cookies, accounts or fingerprinting.** | None of it is in the tree, and `connect-src 'self'` means none of it could phone home if it were. There is no consent banner because there is nothing to consent to. |
| **No CAPTCHAs, bot challenges or interstitials.** | Absent by decision, permanently. There is no challenge code in this repository. The machinery that makes much of the web hostile to Tor is not here, and is not coming. |
| **Third parties never see you.** | Market data, repository activity and the public node census are fetched **server-side** by the functions in `api/`. Your address reaches CoinGecko, GitHub and the node census exactly never. Outbound links carry `Referrer-Policy: no-referrer`, so a site you open from here is not told where you came from. |
| **The fonts are local too.** | 12 `woff2` in `app/public/fonts/`. No CDN, no `fonts.googleapis`, no `fonts.bunny.net`. The count of third-party browser requests is zero and is gated at zero. |
| **It works with JavaScript off.** | Every static route is prerendered to real HTML at build time by `app/scripts/prerender.mjs`. Tor Browser at its Safest setting reads this site whole. Live data enriches a page; it is never the price of admission. Gated by `app/verify-nojs.mjs` and `app/verify-degraded.mjs`. |
| **No number is invented.** | See [Real values, or none](#real-values-or-none) below. |
| **Usable at 390px, nothing under 12px, and reduced motion loses no information.** | Gated by `app/verify-mobile.mjs`, `app/verify-legibility.mjs` and `app/verify-reduce.mjs`. |

### Real values, or none

A figure on a live surface is one the site actually received, or it is an
em-dash. It is never a plausible guess wearing the clothes of a measurement.
When a feed degrades, the page carries the last good value and says
`STALE · reconnecting`; it never synthesises a replacement.

Randomness exists in exactly two places, and neither of them renders a value:

- **`app/src/protocols/`** — the educational simulators, which are *supposed*
  to invent values and are labelled as doing so. This is the rule's one
  carve-out, and it is enforced from both sides: `app/verify-prng.mjs` strips
  comments, scans every `.ts`/`.tsx` file under `app/src/`, and asserts **zero**
  `Math.random()` call sites outside `src/protocols/` — plus a positive control
  that the exemption is load-bearing, so the check cannot pass by scanning
  nothing.
- **Retry backoff in `api/`** — `api/markets.js` and `api/coingecko.js` jitter
  the delay before re-trying a rate-limited upstream, so a fan-out of requests
  does not retry in lockstep. The random number is a count of milliseconds to
  wait. It never becomes a value anyone reads.

### What is honestly still true

This site keeps no log of its own. It is served by a host that meters requests
the way any origin does, and edge caching collapses simultaneous readers into
a single upstream fetch. **So there are logs — the operator's view of them is
that a page was read, never who read it.** Anyone claiming a website generates
no records at all is describing something other than a website.

Your browser does store things locally: the last good market data, a
short-lived feed cache, and your own display settings. None of it identifies
you, and none of it leaves your machine.

---

## Security headers

Served on every path, from `vercel.json`. The policy is quoted in full because
paraphrasing it would cost you the ability to check it.

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';
  font-src 'self'; object-src 'none'; base-uri 'self';

Referrer-Policy:            no-referrer
X-Frame-Options:            DENY
X-Content-Type-Options:     nosniff
Strict-Transport-Security:  max-age=31536000; includeSubDomains; preload
Permissions-Policy:         camera=(), microphone=(), geolocation=(), payment=()
X-XSS-Protection:           1; mode=block
```

`connect-src 'self'` is the load-bearing line. `object-src 'none'` and
`base-uri 'self'` close the plugin and base-tag injection routes.
`Permissions-Policy` denies camera, microphone, geolocation and payment
outright rather than leaving them to default.

To verify the live site rather than this file:

```bash
curl -sI https://xmr.irish | grep -i 'content-security-policy\|referrer-policy'
```

---

## Legal

### Purpose

**This site is for education and documentation only.** It explains publicly
available information about how two public blockchains work. Nothing on it is
an offer, a solicitation, or an inducement to do anything.

### Not advice

**Nothing on this site is financial, investment, legal, tax, accounting or
security advice.** It is not a recommendation to buy, sell, hold, mine, or
transact in any asset, and it is not a recommendation to use any wallet, node,
pool, exchange, service or piece of software mentioned on it. No content here
is tailored to your circumstances, because the site knows nothing about your
circumstances and is built so that it cannot. Consult a qualified professional
in your own jurisdiction before acting on anything you read here.

### No endorsement

Naming a project, protocol, service or organisation is documentation, not
endorsement. Where this site links to an external resource it is neither
controlled nor monitored by this site, its contents may change without notice,
and its accuracy, safety and availability are the responsibility of whoever
operates it. Following an external link is at your own risk.

### Non-custodial and read-only

**This site holds no funds, custodies no assets, and operates no wallet.**
There are no accounts, no sign-in, no balances, and no transaction-signing
capability of any kind. Nothing on this site can move money, and no action
taken on it can spend, receive or authorise a transfer. It cannot recover a
lost key, reverse a transaction, or help with funds sent anywhere.

### Live data may be wrong

Figures on this site come from third-party sources — a Monero node, a market
data provider, a public node census — and are shown as received. They may be
**delayed, incomplete, degraded, cached, or simply wrong**, and the site may
be unreachable at any time. Where data is stale the page says so, but a
correct-looking number is not a guarantee of a correct number. **Do not rely on
anything here for a financial, operational or security decision.** Verify
against your own node or another independent source.

### The simulators are simulated

Some surfaces render **invented values by design**, in order to illustrate a
mechanism, and every one of them says so on its own face — the interactive
protocol demonstrations at `/learn/sim` and the beta-chain explorer at
`/operate/superstress/explorer` are the two a reader is most likely to meet.
They are not chain data, not historical data, and not a prediction of anything.

**The rule is the property, not the list.** A surface that invents a figure
labels it; a surface that reports one names where it came from, through the
provenance vocabulary every displayed figure on this site carries. That is what
`app/verify-provenance.mjs` and `app/verify-prng.mjs` enforce, and it is why
this paragraph deliberately does not enumerate: the previous version of this
sentence scoped the rule to `/learn` and missed the explorer entirely, and a
count would go stale the same way the next time a surface is added.

The explorer is the one that most needs saying, because it wears an explorer's
clothes — block tiles, confirmation depths, a fee ladder, a transaction feed —
and an explorer is normally a window onto a real chain. This one is a window
onto a model. Its header reads `MODEL · WIND TUNNEL · NOTHING HERE WAS
MEASURED`, its transaction ids are `sim:` followed by sixteen hex characters
rather than a real sixty-four, and its chain is *seeded* rather than random, so
the same block always shows the same contents.

(A rule about what a page CLAIMS should not be scoped by the prefix its URL
happens to have, nor by a count of the pages that happened to exist when it was
written.)

### Your jurisdiction is your responsibility

**The legal treatment of cryptocurrency — and of privacy-preserving
cryptocurrency in particular — varies enormously between jurisdictions and
changes frequently.** Something lawful where this site is read may be
restricted, licensable or prohibited where you are. Any description on this
site of a law, regulation or regulatory position is a summary written at a
point in time, is not comprehensive, and may be out of date. **You are solely
responsible for determining and complying with the laws that apply to you.**

### Warranty and liability

Quoting the [`LICENSE`](LICENSE) this project ships under, because it governs
the content as well as the code:

> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
> FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
> IN THE SOFTWARE.

To the fullest extent permitted by law, the operator and contributors accept
no liability for any loss or damage arising from use of, or reliance on, this
site or anything linked from it.

---

## License

MIT — see [`LICENSE`](LICENSE).

```
Copyright (c) 2026 Satoshi's Vision Archive
```

---

*"Privacy is not a crime. It is a right."*
— The Monero Community
