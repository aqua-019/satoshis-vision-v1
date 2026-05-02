# FCMP++ canonical facts (v4.0 site reference)

**Last updated:** May 2, 2026
**Sources:** seraphis-migration/monero releases, getmonero.org official posts,
monero-project/monero milestone tracker, official @monero Twitter, Monero Research
Lab logs, kayabaNerve/fcmp-plus-plus-paper

---

## Status as of May 2, 2026

- **NOT YET ACTIVATED on mainnet.**
- Alpha stressnet: **running since October 3, 2025**, hard forked from testnet at
  block 2,847,330. Latest alpha release: **v0.19.0.0-alpha.1.6** (Feb 4, 2026).
- Beta stressnet: **scheduled to launch May 6, 2026** (per official Monero Twitter
  announcement, April 29, 2026).
- Mainnet hard fork: **tentatively mid-2026**, no specific block height confirmed.

---

## What FCMP++ does

Replaces ring signatures with **full-chain membership proofs**. When spending Monero,
instead of proving "you own 1 of 16 outputs" you prove "you own 1 of 150M+ outputs
across the entire Monero blockchain."

Anonymity set per input: **from 16 to ~150,000,000+** (and growing every block).

---

## Bundled upgrade: CARROT

FCMP++ ships alongside **CARROT**, a new addressing protocol that becomes the default
post-FCMP++. Backward compatible — existing 95-character Monero addresses remain valid.

- Repository: <https://github.com/jeffro256/carrot>
- Maintained by jeffro256

---

## Key features

- **150M+ anonymity set per input** (entire chain, vs 16 for ring signatures)
- **Forward secrecy** — even quantum adversaries cannot retroactively trace
  transactions made under FCMP++
- **Backward compatibility** — no wallet migration; existing addresses still work
- **~2-3 KB proof size** despite proving membership in 150M+ outputs
- **Transaction chaining** support (enables Layer 2 constructions)

---

## Cryptographic foundation

- **Curve Trees** — logarithmic-size membership proofs
- **Generalized Bulletproofs** — optimized inner-product arguments
- **Eagen's elliptic curve divisors** — accelerated proof construction
- **Helios + Selene** — curve cycle towering Ed25519 (preserves existing anonymity set)
- Independently audited (Veridise, 2025)

---

## Performance

- Proof generation: **5x speedup** achieved (128-input TX from 5m30s to ~1m)
- RAM usage on stressnet: **dropped from ~1.2GB to ~800MB** through optimization
- Verification scales: O(log N) where N is anonymity-set size

---

## Stressnet limitations (as of v1.6)

The following features are NOT yet supported on the stressnet (under development):

- Watch-only wallets & cold wallets
- Hardware wallet support
- Multisig
- Transaction proofs
- Block explorer

Mainnet activation requires these features to be implemented.

---

## Open questions / TBD

- Specific mainnet block height for activation
- Final scaling decisions (made on beta stressnet)
- Wallet rollout timeline (major wallets expected to default to FCMP++ by late 2026)

---

## Authoritative source list

When updating site content, fact-check against:

- <https://github.com/seraphis-migration/monero/releases> (latest stressnet releases)
- <https://github.com/monero-project/monero/milestone/1> (FCMP++ hard fork milestone)
- <https://www.getmonero.org/2024/04/27/fcmps.html> (official Monero Foundation explainer)
- <https://github.com/kayabaNerve/fcmp-plus-plus-paper> (design paper)
- <https://github.com/jeffro256/carrot> (CARROT spec)
- <https://x.com/monero> (official Monero Twitter)
- <https://x.com/moneroresearchl> (MRL Twitter)
- <https://monero.observer> (Monero Observer)
- <https://www.themoneromoon.com> (community newsletter)

DO NOT cite (unreliable, inaccurate dates):

- coinmarketcap.com/cmc-ai pages
- mexc.com/news pages
- xgram.io/blog
- tradingkey.com analyses
- quasa.io media

---

## Naming

- "FCMP++" (preferred; what the upstream uses)
- "Full-Chain Membership Proofs" (long form)
- Originally "FCMPs+SA+L" (Full-Chain Membership Proofs + Spend Authorization + Linkability)

Do NOT call it just "FCMP" without the "++". The "++" distinguishes from earlier
proposed-but-not-deployed FCMPs (which were tied to Seraphis).
