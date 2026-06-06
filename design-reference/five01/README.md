# five01 — xmr.irish v5.0.1

Design system + interactive mockups for the next iteration of **xmr.irish**.
The codebase is structured to be lifted into your production site or used
as a high-fidelity reference while you build.

## What's in here

```
index.html                          ─ design hub (loads everything)
five01/
├── styles.css                      ─ global terminal-CRT base + protocol chrome
├── lib/
│   ├── design-canvas.jsx           ─ Figma-style pan/zoom canvas (vendored)
│   └── tweaks-panel.jsx            ─ floating tweaks panel (vendored)
└── src/
    ├── shared.jsx                  ─ data hook, atoms, NavTop, NetRail, ProtoChrome
    ├── app.jsx                     ─ root component + tweaks wiring
    ├── mempool/                    ─ 5 directions for the flagship surface
    │   ├── reactor.jsx             ─ ★ 3D iso + hex lattice + ring fan (text-dense)
    │   ├── bridge.jsx              ─ ◇ 12-pane Bloomberg-meets-NASA
    │   ├── sediment.jsx            ─ ◇ vertical core-sample tube (must-have)
    │   ├── constellation.jsx       ─ ◇ luminous peer-globe (must-have)
    │   └── terminal.jsx            ─ ◇ CLI-first monerod tail
    └── protocols/                  ─ 6 protocol simulations, metaphor-driven
        ├── decoy-selection.jsx     ─ Time-tide · log-normal sampling
        ├── dandelion.jsx           ─ Botanical · stem→fluff bloom
        ├── view-tags.jsx           ─ Lighthouse-in-fog · 256× race
        ├── ringct.jsx              ─ Assembly line · 5 stations
        ├── stealth.jsx             ─ Two-key chamber · DH ≡
        └── fcmp.jsx                ─ Murmuration · 16 → 150M+
```

## Getting started

Open `index.html`. The canvas has two sections — Mempool, then Protocols.
Click any artboard label to enter fullscreen focus mode. `←`/`→` walk
between artboards in focus mode; `Esc` exits.

Tweaks panel lives bottom-right when **Tweaks** is toggled on in the
toolbar. Knobs:

| Knob | Values |
|---|---|
| Accent | Phosphor orange · Privacy purple · Telemetry cyan · Acid green |
| Type pairing | Newsreader×Mono · Geist×Mono · Mono-only · Editorial |
| Glow | 0 – 4 |
| Background | calm · busy · chaotic |
| Scanlines | on / off |
| Anim speed | 0.25× – 2.5× |
| Density | sparse · standard · dense · hyper |

All tweak state is persisted in the `EDITMODE` block inside `app.jsx`.

## Data plug-points (for porting to live data)

The single source of truth for runtime state is the `useMoneroLive()` hook
in `five01/src/shared.jsx`. It:

1. **Live price (real):** polls CoinGecko every 60s for XMR/USD, BTC/USD,
   and computes the XMR/BTC ratio. Open CORS, no API key. Falls back
   silently if blocked.
2. **Mempool / blocks (simulated):** generates a plausible mempool with
   realistic txids (64-char hex), fees per byte, ring sizes, ages; ticks
   every 2.2s for new arrivals and every 30s for new blocks. Designed
   to be **drop-in replaceable** with a websocket or RPC feed.

### Where to plug a real Monero node feed

Replace the two simulation `useEffect`s in `useMoneroLive()` with subscriptions:

```js
// In shared.jsx, inside useMoneroLive():

React.useEffect(() => {
  const ws = new WebSocket("wss://your-node.example/ws");
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "tx")    setState(s => ({ ...s, mempool: [...s.mempool, msg.tx] }));
    if (msg.type === "block") setState(s => ({ ...s, blocks: [msg.block, ...s.blocks].slice(0, 14), height: msg.block.height }));
  };
  return () => ws.close();
}, []);
```

Or polled RPC:

```js
const r = await fetch("https://your-node.example/get_info");   // monerod RPC
const r2 = await fetch("https://your-node.example/get_transaction_pool");
```

CORS notes: most public Monero RPC nodes do not send `Access-Control-Allow-Origin`.
For production deployment, run a thin server proxy (Cloudflare Worker, FastAPI,
edge function) that adds the CORS header. Don't expose your wallet RPC.

### Suggested data shape (keep this stable as you wire live feeds)

```ts
interface MoneroLive {
  // network
  height: number; hashrate: number; difficulty: number; nonce: number;
  hardfork: string; protocol: string; blockTarget: number;
  // mempool
  mempool: Tx[]; blocks: Block[]; poolDist: Pool[];
  // peers
  peers: Peer[]; peerIn: number; peerOut: number;
  // market
  price: number; change24h: number; btcRatio: number; btc: number; btcChg: number;
  // series
  hashSeries: number[]; priceSeries: number[]; feeHist: number[];
  // meta
  source: "simulated" | "coingecko" | "rpc" | "ws";
  lastUpdate: number;
  live: boolean;
}
interface Tx     { id: string; size: number; fee: number; ringSize: number; perB: number; age: number; inputs: number; outputs: number; }
interface Block  { height: number; hash: string; txs: number; sizeKB: number; reward: number; difficulty: number; pool: string; age: number; conf: number; }
interface Peer   { ip: string; port: number; h: number; agent: string; lat: number; cnt: string; }
interface Pool   { name: string; share: number; fee: number; type: string; rec: boolean; color: string; }
```

## How to add a new variation

1. Drop `five01/src/mempool/<name>.jsx` (or `protocols/<name>.jsx`).
2. Define a top-level `function MyView({ data, bg }) { ... }`.
3. End the file with `window.MyView = MyView;`.
4. Add a `<script type="text/babel" src=...>` line to `index.html`.
5. Register it in `app.jsx`'s `variants`/`protocols` array.

The `<ProtoArtboard>` helper in `shared.jsx` gives you consistent chrome
(header strip + 2-col stage/panel layout) for protocol explainers.

## Design system primitives (in `shared.jsx`)

- `<NavTop active="mempool" />` — full top nav strip
- `<NetRail data={data} />` — persistent telemetry sidebar
- `<Footer data={data} />` — bottom status strip
- `<PanelFrame title=... right=...>` — HUD-bracketed panel
- `<Stat k v sub tone>` — KPI tile (tone: "acc" | "g" | "p" | "dn")
- `<Pill tone>` — badge
- `<Sparkline data />`, `<MiniBar data />` — inline charts
- `<ProtoArtboard kicker title sub badges stage panel />` — protocol shell
- `<ProtoStep n on done title>{children}</ProtoStep>` — numbered step
- `<ArtBackground intensity scan />` — particle bg + noise + vignette

## Type system

- **Serif display** — Newsreader (Google Fonts) — section titles, lede sentences
- **Sans UI** — Geist — nav, buttons, secondary headings
- **Mono data** — JetBrains Mono — every number, txid, address, kicker, log line

All three are CSS variables (`--f-serif`, `--f-sans`, `--f-mono`) that the
type tweak swaps wholesale.

## Color tokens (`styles.css`)

The site's existing **black / orange / green / grey** stays. Two new
phosphors join the system to encode meaning:

- `--p-50: #b87aff` — **privacy purple** — Dandelion, stealth, FCMP, anything zero-knowledge
- `--c-50: #5ed3f4` — **telemetry cyan** — secondary data, peer info, view-tag
- `--g-50: #4ade80` — **acid green** — confirmation, sync, up-ticks (existing)
- `--y-50: #ffd400` — **caution yellow** — queued, warning, true-spender pointer
- `--r-50: #ff4d6d` — **drop red** — down-ticks, errors, decentralization warnings

Use the accent CSS var (`--tk-accent`) for primary action; the privacy
purple specifically signals "this layer is hiding something". That rule
keeps the palette legible.

## Caveats

- CoinGecko fetch may be blocked in some preview iframes; falls back to
  simulated. Check `data.source === "coingecko"` to confirm live.
- All artboards are designed at 1500–1800px wide. Use focus mode to
  evaluate.
- Tweak state is per-session unless you save to disk via the EDITMODE block.

## Roadmap

See `METAPHORS.md` for additional analogical visualizations not yet built.
See `DATA.md` for a deeper guide to wiring live RPC feeds.
