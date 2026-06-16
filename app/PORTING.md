# PORTING — how this repo plugs into your host

A pragmatic guide to taking the xmr.irish v5 codebase from "Claude design
hub" to "production app inside your stack" (claude.ai, Next.js, Astro,
Remix, whatever).

---

## The seams

There are three points where the repo is intentionally decoupled from
its environment:

### 1. Data (`@/data/DataContext`)

`useMoneroLive()` is the only data hook. Replace its provider:

```tsx
function useHostFeed(): MoneroLive {
  // your subscription / poll / WS logic
}

<DataProvider useFeed={useHostFeed}>
  <App />
</DataProvider>
```

Anywhere your runtime already has a Monero data layer, this is where it
plugs in. The default feed (`xmrirish-feed.ts`) polls same-origin
`/api/*` proxies — supply `useFeed` to replace it.

### 2. Routing (`@/App`)

`App.tsx` uses `react-router-dom`'s `<Routes>`. If your host uses Next.js
App Router, Astro routes, or a different router:

- Replace `App.tsx` with your own composition
- Keep importing the page components from `@/pages/*` — each is
  self-contained and works in any router
- The page-to-URL mapping is in App.tsx; lift it into your routes config

Pages don't import `react-router` directly except for `NavLink` (in
`NavTop`), `Link`, and `useNavigate`. Replace those three with your
router's equivalents in two files: `NavTop.tsx` and any page using
`useNavigate`.

### 3. Asset host (`vite.config.ts`)

`base` is read from `VITE_BASE`. Set it if you mount the app under a
sub-path:

```
VITE_BASE=/v5/ npm run build
```

Bundled assets land under `assets/*` with stable 8-char hashes — safe
to cache aggressively.

---

## Pattern: dropping into claude.ai

If claude.ai renders TSX/JSX directly:

```tsx
// claude.ai/your-host-file.tsx
import "./xmrirish/src/styles.css";
import { App } from "./xmrirish/src/App";
import { useClaudeMoneroFeed } from "./your-claude-feed";

export default function ClaudeXmrIrish() {
  return (
    <BrowserRouter>      {/* or your host's router */}
      <App useFeed={useClaudeMoneroFeed} />
    </BrowserRouter>
  );
}
```

That's the full port. Your `useClaudeMoneroFeed` hook is the only new
file you write. Everything else is unchanged.

---

## Pattern: dropping into Claude Code

Claude Code agents prefer ESM modules + a clear `package.json`. This repo
ships exactly that. Drop the `repo/` folder into your project as
`packages/xmrirish-v5/` (or wherever), set up workspaces:

```json
// root package.json
{
  "workspaces": ["packages/*"]
}
```

Then `import { App } from "@xmr/v5"` from your shell app.

The `port` script (`npm run port`) is idempotent and safe to commit to a
build pipeline — re-run it whenever `legacy/` changes.

---

## Pattern: static export

```bash
npm run build
# output: dist/
npx serve dist
```

`dist/` is a static SPA. Host on Cloudflare Pages, Netlify, IPFS, or
your .onion mirror. The `BrowserRouter` will need a 404 → /index.html
rewrite — add this to your host config:

- **Cloudflare Pages**: add a `_redirects` file with `/* /index.html 200`
- **Nginx**: `try_files $uri /index.html;`
- **Apache**: `FallbackResource /index.html`

For .onion / static-only hosts, swap `BrowserRouter` → `HashRouter` in
`main.tsx`. Same code, different URL syntax (`/#/mempool`).

---

## Files you'll touch when porting

| Concern              | File(s)                              |
|----------------------|--------------------------------------|
| Live data            | `src/data/DataContext.tsx` callers   |
| Router               | `src/main.tsx` + `src/App.tsx`       |
| Brand strings        | `src/layout/NavTop.tsx`              |
| Footer copyright     | `src/layout/Footer.tsx`              |
| Color tokens         | `src/styles.css` (`:root`)           |
| Type stack           | `src/styles.css` (`--f-serif` etc.)  |
| Add a route          | `src/pages/*.tsx` + `src/App.tsx`    |
| Add a mempool view   | `src/mempool/*` + `src/views/index.tsx` |
| Add a protocol sim   | `src/protocols/*` + `src/views/index.tsx` |

---

## What's deliberately NOT in this repo

- **Tweaks panel** — that's a design-time tool, not user-facing UX. It
  lives in the design hub (`design-hub.html` in the source project).
- **Edit mode wiring** — same reason.
- **Service workers / offline cache** — host's responsibility.
- **Analytics** — Monero is a privacy site. None.
- **CoinGecko in production** — the default feed reaches it only via
  the same-origin `/api/coingecko` proxy; a custom `useFeed` hook
  should do the same so users on Tor never hit `coingecko.com` directly.
