/**
 * layout/NavTop.tsx — global navigation strip: 6-section IA (nav/ia.ts) with
 * hover-intent dropdowns, a morphing active-pill, and a mobile bottom tab bar
 * (layout/BottomTabBar.tsx) below the D1207 720px container-query threshold.
 *
 * Rebuilt from the flat 11-item `NavLink` list per the P5 nav restructure —
 * see docs/v6-mockups/nav-ia-mockup.html for the mechanics this copies
 * (D1542 hover intent, D0235 morphing pill, D1207 container queries), and
 * nav/ia.ts for the real 6-section data the mockup's own inventory is
 * fiction for. Every destination below is read from `IA`; nothing here
 * hardcodes a path except the two structural links (brand → `/`, version →
 * `${R.ABOUT_SOURCES}#release-notes`) that predate the section data and
 * aren't part of it.
 *
 * ── WHAT SURVIVED THE REWRITE (D0744-adjacent, unchanged) ──────────────────
 * Brand `<Link>` + version `<Link>`, the exhaustive `ChromeState` status pill,
 * XMR + BTC tickers, `<DesignPanel/>` as the LAST child of `.ticker-strip`
 * (see design/DesignPanel.tsx's header for why that position is load-bearing).
 * The old hamburger + slide-in drawer is gone; BottomTabBar replaces it below
 * 720px instead of hiding the same 6 destinations inside a drawer.
 *
 * ── CONTAINER, NOT VIEWPORT (D1207) ─────────────────────────────────────────
 * `.topbar` is the `container-type: inline-size; container-name: navshell`
 * root (styles.css). `.dd` (the shared dropdown panel) is nested inside it so
 * `top: 100%` and its left-clamp read the SAME box the container query does —
 * no hardcoded topbar-height constant (compare the `.mp-switcher { top: 60px
 * }` trap CLAUDE.md documents). BottomTabBar registers a SECOND `navshell`
 * container of its own (`.tabbar-anchor`) for a reason specific to it — see
 * that file's header — and container-query rule blocks in styles.css target
 * both by name, not by DOM nesting.
 *
 * ── FOCUS, NOT JUST HOVER ────────────────────────────────────────────────
 * The mockup has no keyboard/focus handling for the dropdown at all — that is
 * a gap in the mockup, not the spec. This version: ArrowDown on a `.navitem`
 * opens its panel and moves focus to the first link inside it; Escape (from
 * either the item or the panel) closes and returns focus to the trigger;
 * focus leaving the combined item+panel region closes it too (`onBlur` with a
 * `relatedTarget` containment check); a document-level pointerdown outside
 * both closes it for mouse/touch users who click elsewhere without hovering
 * out first.
 */

import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useMoneroLive } from "@/data/DataContext";
import { DesignPanel } from "@/design/DesignPanel";
import { useReducedMotion } from "@/design/useReducedMotion";
import { SITE_VERSION } from "@/data/releases";
import { assertNever, CHAIN_MARKET_CHROME_KEYS, hasData } from "@/data/feed-status";
import { CHROME_LABEL, chromeDetail, useChromeState } from "@/design/useOnline";
import { IA, sectionForPath, type IaSection } from "@/nav/ia";
import { usePaletteHotkey } from "@/nav/usePaletteHotkey";
import { usePrefetch } from "@/nav/usePrefetch";
import { R, ROUTES } from "../../scripts/routes.mjs";
import { BottomTabBar } from "./BottomTabBar";

/** Human label for a prerendered route, for the JS-off nav below.
 *
 *  Reads the IA rather than carrying a fourteenth hand-typed list: if a leaf
 *  names the route, its label is already the one the nav shows. The fallback
 *  is derived from the path itself, so a route added to ROUTES without an IA
 *  leaf still gets a usable link instead of an empty <a>. */
function noscriptLabel(path: string): string {
  if (path === R.HOME) return "Home";
  for (const s of IA) {
    for (const c of s.cols) {
      const hit = c.items.find((i) => i.p === path);
      if (hit) return `${s.label} · ${hit.l}`;
    }
  }
  const tail = path.split("/").filter(Boolean).pop() ?? path;
  return tail.replace(/-/g, " ").replace(/^./, (ch) => ch.toUpperCase());
}

// CommandPalette.tsx is React.lazy and imported ONLY here, on first ⌘K — see
// nav/usePaletteHotkey.ts's header for why the hook that triggers it is
// eager while this is not. Defining the lazy wrapper at module scope (rather
// than inside the component) does not by itself fetch anything: React.lazy's
// factory only runs the first time the resulting component is actually
// rendered, which only happens once `everOpened` below goes true.
const LazyCommandPalette = React.lazy(() =>
  import("@/nav/CommandPalette").then((m) => ({ default: m.CommandPalette })),
);

/** D1542 — 150ms to open, 220ms to close. Zeroed under reduced motion (the
 *  delay is UX smoothing tied to motion, not a functional gate — every
 *  destination stays reachable at 0ms, just without the smoothing). */
const HOVER_OPEN_MS = 150;
const HOVER_CLOSE_MS = 220;

/** `useLayoutEffect` warns under renderToString (scripts/prerender.mjs runs
 *  this component on the server for the no-JS HTML) — same shape as
 *  routes/useRouteChrome.ts:124 / mempool/useRibbonGlide.ts:45, copied rather
 *  than shared for the same reason those two don't share it either. */
const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export function NavTop() {
  const data = useMoneroLive();
  const chromeState = useChromeState(data.status, CHAIN_MARKET_CHROME_KEYS);
  const location = useLocation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  const activeKey = sectionForPath(location.pathname)?.key ?? null;

  // ── ⌘K command palette trigger ──────────────────────────────────────────
  // usePaletteHotkey (eager, tiny) owns `open`. `everOpened` is this
  // component's own — the palette chunk must not even be REQUESTED until
  // the first ⌘K/click, but once it has been, the mounted LazyCommandPalette
  // stays in the tree (toggling its own `open` prop) rather than being
  // torn down and re-fetched on every close; V6Modal (which it wraps) is
  // itself what keeps `[role="dialog"]` absent from the DOM while closed,
  // so "mounted" here does not mean "a dialog exists" — see
  // verify-future.mjs:259's zero-dialogs-before-any-open assertion, which
  // this satisfies through V6Modal's own present/open split, not through
  // this flag.
  const palette = usePaletteHotkey();
  const [paletteEverOpened, setPaletteEverOpened] = React.useState(false);
  React.useEffect(() => {
    if (palette.open) setPaletteEverOpened(true);
  }, [palette.open]);

  const topbarRef = React.useRef<HTMLDivElement>(null);
  const navRef = React.useRef<HTMLElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const pillRef = React.useRef<HTMLSpanElement>(null);
  const itemRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());

  // ── D1542 hover-intent open/close ─────────────────────────────────────
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  // The panel keeps rendering the LAST open section's content while it
  // fades out, exactly like the mockup's renderDD (never cleared on close)
  // — otherwise the closing transition plays over an empty box.
  const [renderedKey, setRenderedKey] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (openKey) setRenderedKey(openKey);
  }, [openKey]);
  const renderedSection: IaSection | undefined = renderedKey
    ? IA.find((s) => s.key === renderedKey)
    : undefined;

  const tIn = React.useRef<number | undefined>(undefined);
  const tOut = React.useRef<number | undefined>(undefined);
  const clearTimers = React.useCallback(() => {
    window.clearTimeout(tIn.current);
    window.clearTimeout(tOut.current);
  }, []);
  React.useEffect(() => clearTimers, [clearTimers]);

  // openDD early-returns when already open on this section — re-entrant
  // hover/keyboard events must not restart the panel's own effects.
  const openDD = React.useCallback((key: string) => {
    setOpenKey((cur) => (cur === key ? cur : key));
  }, []);
  const closeDD = React.useCallback(() => setOpenKey(null), []);

  // D0724 hover prefetch — fires exactly when a dropdown ACTUALLY opens
  // (openKey transitioning from null/another key to this one), never on raw
  // pointerenter. That transition already sat behind the D1542 hover-intent
  // timers above (openDD is only ever called from the HOVER_OPEN_MS timeout
  // or an ArrowDown keydown) — this effect adds no timer of its own, it just
  // observes the state that timer already produces. See nav/usePrefetch.ts's
  // header for why a fetch() exists here at all alongside index.html's
  // speculation-rules block.
  const prefetchSection = usePrefetch();
  React.useEffect(() => {
    if (openKey) prefetchSection(openKey);
  }, [openKey, prefetchSection]);

  const focusPanelOnOpen = React.useRef(false);

  const onItemPointerEnter = (key: string) => () => {
    // Clear the pending CLOSE first — this is the whole mechanism that makes
    // crossing an item on the way somewhere else fire nothing; do not
    // paraphrase the order.
    window.clearTimeout(tOut.current);
    tIn.current = window.setTimeout(() => openDD(key), reducedMotion ? 0 : HOVER_OPEN_MS);
  };
  const onItemPointerLeave = () => {
    window.clearTimeout(tIn.current);
    tOut.current = window.setTimeout(closeDD, reducedMotion ? 0 : HOVER_CLOSE_MS);
  };
  const onPanelPointerEnter = () => window.clearTimeout(tOut.current);
  const onPanelPointerLeave = () => {
    tOut.current = window.setTimeout(closeDD, reducedMotion ? 0 : HOVER_CLOSE_MS);
  };

  const escapeClose = (key: string | null) => {
    closeDD();
    if (key) itemRefs.current.get(key)?.focus();
  };

  const onItemKeyDown = (key: string) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      clearTimers();
      focusPanelOnOpen.current = true;
      openDD(key);
    } else if (e.key === "Escape" && openKey !== null) {
      e.preventDefault();
      escapeClose(openKey);
    }
  };
  const onPanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      escapeClose(openKey);
    }
  };

  // Move focus into the panel's first link — but only when the open was
  // triggered from the keyboard (ArrowDown), never on a hover-opened panel;
  // stealing focus on mouse hover is its own accessibility bug. Gated on
  // `renderedKey === openKey`, not just `openKey`: the panel's content is
  // populated by the SEPARATE renderedKey-sync effect above, which commits
  // one render later — focusing here on the bare `[openKey]` transition
  // would run before any `<a>` exists yet and silently find nothing.
  // The rAF is load-bearing, not decoration: `.dd` starts `visibility:
  // hidden` and only flips on the SAME frame `.on` is applied — measured
  // flaky (~1/3 of runs) calling `.focus()` synchronously in the effect,
  // because a target that the engine hasn't yet recomputed as "being
  // rendered" silently no-ops a focus call instead of queuing it.
  React.useEffect(() => {
    if (openKey && renderedKey === openKey && focusPanelOnOpen.current) {
      focusPanelOnOpen.current = false;
      // D0699-EXEMPT: one deferred focus after panel commit, not a loop
      const id = requestAnimationFrame(() => {
        panelRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [openKey, renderedKey]);

  // Focus leaving the combined item+panel region closes the panel — Tabbing
  // past the last link, or a click landing somewhere else that also moves
  // focus, both count.
  const onRegionBlur = (e: React.FocusEvent) => {
    const next = e.relatedTarget as Node | null;
    if (next && (navRef.current?.contains(next) || panelRef.current?.contains(next))) return;
    closeDD();
  };

  // Outside POINTER activity (a click that doesn't move focus, e.g. on a
  // non-focusable element) also closes an open panel.
  React.useEffect(() => {
    if (!openKey) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (navRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      closeDD();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openKey, closeDD]);

  // ── dropdown panel geometry ──────────────────────────────────────────
  // Adapted from the mockup's nav-relative clamp: here `.dd`'s positioned
  // ancestor is `.topbar` (not `.nav-main`, which is only the middle grid
  // column) so both the panel and its clamp read the SAME box — see the
  // file header.
  const positionPanel = React.useCallback((key: string) => {
    const topbar = topbarRef.current;
    const btn = itemRefs.current.get(key);
    const panel = panelRef.current;
    if (!topbar || !btn || !panel) return;
    const topbarRect = topbar.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const left = Math.max(
      8,
      Math.min(btnRect.left - topbarRect.left - 12, topbarRect.width - panel.offsetWidth - 8),
    );
    panel.style.left = `${left}px`;
  }, []);
  useIsoLayoutEffect(() => {
    if (openKey) positionPanel(openKey);
  }, [openKey, renderedKey, positionPanel]);
  React.useEffect(() => {
    if (!openKey) return;
    const onResize = () => positionPanel(openKey);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [openKey, positionPanel]);

  // ── D0235 morphing pill ──────────────────────────────────────────────
  const recomputePill = React.useCallback(() => {
    const nav = navRef.current;
    const pill = pillRef.current;
    if (!nav || !pill) return;
    const btn = activeKey ? itemRefs.current.get(activeKey) : undefined;
    if (!btn || getComputedStyle(btn).display === "none") {
      pill.style.width = "0";
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    pill.style.width = `${btnRect.width}px`;
    pill.style.transform = `translateX(${btnRect.left - navRect.left}px)`;
  }, [activeKey]);
  useIsoLayoutEffect(() => {
    recomputePill();
  }, [recomputePill, location.pathname]);
  React.useEffect(() => {
    window.addEventListener("resize", recomputePill);
    let ro: ResizeObserver | undefined;
    if (navRef.current) {
      ro = new ResizeObserver(recomputePill);
      ro.observe(navRef.current);
    }
    return () => {
      window.removeEventListener("resize", recomputePill);
      ro?.disconnect();
    };
  }, [recomputePill]);

  const onItemClick = (section: IaSection) => () => {
    navigate(section.cols[0].items[0].p);
    closeDD();
  };

  return (
    <>
      {/* `.nav-shell` is the D1207 container root (styles.css) — `.topbar`
          keeps its own padding, unowned by containment maths. */}
      <div className="nav-shell">
      <div className="topbar" ref={topbarRef}>
        <div className="brand-col" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link to={R.HOME} className="brand" style={{ textDecoration: "none", color: "inherit" }}>
            <span className="brand-mark" />
            <span>xmr<b>.irish</b></span>
          </Link>
          <Link
            to={`${R.ABOUT_SOURCES}#release-notes`}
            className="kicker"
            style={{ textDecoration: "none" }}
            title="Release notes"
          >
            {SITE_VERSION}
          </Link>
        </div>

        <nav ref={navRef} className="nav-main" aria-label="Primary" onBlur={onRegionBlur}>
          {IA.map((section) => {
            const count = section.cols.reduce((n, c) => n + c.items.length, 0);
            const isOpen = openKey === section.key;
            const isActive = section.key === activeKey;
            return (
              <button
                key={section.key}
                type="button"
                ref={(el) => {
                  if (el) itemRefs.current.set(section.key, el);
                  else itemRefs.current.delete(section.key);
                }}
                className="navitem"
                aria-expanded={isOpen}
                aria-haspopup="true"
                aria-controls="nav-dd-panel"
                aria-current={isActive ? "page" : undefined}
                onPointerEnter={onItemPointerEnter(section.key)}
                onPointerLeave={onItemPointerLeave}
                onKeyDown={onItemKeyDown(section.key)}
                onClick={onItemClick(section)}
              >
                {section.label}
                <span className="cnt">{count}</span>
              </button>
            );
          })}
          {/* Plain `.nav-main` child, not `.navitem` — the D1207 container
              query at 720px hides `.navitem`/`#pill`/`.dd` and shows the
              tab bar, but names none of THIS class, so the trigger stays
              reachable at every width without a rule of its own. */}
          <button type="button" className="nav-kbd" onClick={() => palette.setOpen(true)} aria-label="Open command palette (⌘K)">
            ⌘K
          </button>
          <span id="pill" ref={pillRef} />
        </nav>

        {/* ── DEGRADED NAVIGATION ──────────────────────────────────────────
            Six <button> triggers replaced eleven flat <a href> links, and the
            dropdown that holds the real links is only in the DOM while it is
            open. With scripting disabled that left 6 of 13 routes with NO
            anchor anywhere on the page — /live/markets, /live/network,
            /about/peers, /live/markets/thesis, /future/outlook and /learn/sim
            were simply unreachable. Every one of them is prerendered to real
            HTML, so the pages existed and nothing could get to them.

            index.html's #boot-fallback does not cover this: it reveals itself
            only when #root is EMPTY, and prerendering means #root is never
            empty. Caught by verify-degraded.mjs §B1.

            It is NOT a <noscript> block, and that distinction cost a round to
            learn. <noscript> renders only when scripting is DISABLED; §B1
            blocks the module bundle with scripting ON, where <noscript>
            content is never parsed into elements at all, so
            querySelectorAll('#root a') cannot see it. Both degraded modes need
            real anchors in the prerendered DOM.

            So it is always rendered, and hidden by CSS keyed on
            html[data-boot="ok"] — a flag main.tsx sets from inside the MODULE
            bundle. Blocked bundle or scripting off, the flag never lands and
            these links stay. index.html's inline pre-paint script would be the
            wrong signal: it runs even when the module is blocked, which is
            precisely the case this covers.

            Rendered from ROUTES rather than IA leaves on purpose: only those 13
            are prerendered to real documents. A ?v= / ?p= leaf would advertise
            a URL that needs the bundle to mean anything, which is the same
            broken promise one level down. */}
        <nav className="nav-noscript" aria-label="All pages">
          {ROUTES.map((path) => (
            <a key={path} href={path}>{noscriptLabel(path)}</a>
          ))}
        </nav>

        <div className="ticker-strip">
          {/* Exhaustive over ChromeState: a fifth FeedPhase stops compiling here
              rather than silently falling through to LIVE. `error` and `offline`
              are separate facts and say separate things — see design/useOnline.ts. */}
          {(() => {
            const state = chromeState;
            const title = chromeDetail(state, data.status, CHAIN_MARKET_CHROME_KEYS) ?? undefined;
            switch (state) {
              case "offline":
                return (
                  <span className="pill" title={title}>
                    <span className="led" style={{ background: "var(--ink-40)", boxShadow: "none" }} />
                    {CHROME_LABEL.offline}
                  </span>
                );
              case "loading":
                return (
                  <span className="pill" title={title}>
                    <span className="led" style={{ background: "var(--ink-40)", boxShadow: "none" }} />
                    {CHROME_LABEL.loading}
                  </span>
                );
              case "error":
                return (
                  <span className="pill" title={title}>
                    <span className="led" style={{ background: "var(--r-50)", boxShadow: "0 0 6px var(--r-50)" }} />
                    {CHROME_LABEL.error}
                  </span>
                );
              case "stale":
                return (
                  <span className="pill" title={title}>
                    <span className="led pulse" style={{ background: "var(--y-50)" }} />
                    {CHROME_LABEL.stale}
                  </span>
                );
              case "live":
                return (
                  <span className="pill live">
                    <span className="led pulse" />
                    LIVE
                  </span>
                );
              default:
                return assertNever(state, "NavTop pill");
            }
          })()}
          <span className="tk dim">
            XMR <b className="acc">{hasData(data.status.market) ? `$${data.price.toFixed(2)}` : "—"}</b>
            <em className={data.change24h < 0 ? "dn" : ""}>
              {hasData(data.status.market) ? `${data.change24h >= 0 ? "+" : ""}${data.change24h.toFixed(2)}%` : "—"}
            </em>
          </span>
          <span className="tk dim tk--btc">
            BTC <b>{hasData(data.status.market) ? `$${Math.round(data.btc).toLocaleString()}` : "—"}</b>
            <em className={data.btcChg < 0 ? "dn" : ""}>
              {hasData(data.status.market) ? `${data.btcChg >= 0 ? "+" : ""}${data.btcChg.toFixed(2)}%` : "—"}
            </em>
          </span>
          {/* Must stay the LAST child of .ticker-strip — see
              design/DesignPanel.tsx's header comment for why. */}
          <DesignPanel />
        </div>

        <div
          id="nav-dd-panel"
          ref={panelRef}
          className={"dd" + (openKey ? " on" : "")}
          onPointerEnter={onPanelPointerEnter}
          onPointerLeave={onPanelPointerLeave}
          onKeyDown={onPanelKeyDown}
          onBlur={onRegionBlur}
          role="region"
          aria-label={renderedSection ? `${renderedSection.label} menu` : undefined}
          aria-hidden={!openKey}
        >
          {renderedSection ? (
            <>
              <div
                className="dd-grid"
                style={{ gridTemplateColumns: `repeat(${renderedSection.cols.length}, minmax(0, 1fr))` }}
              >
                {renderedSection.cols.map((col) => (
                  <div className="dd-col" key={col.h}>
                    <h4>{col.h}</h4>
                    {col.items.map((it) => (
                      <Link key={it.p} to={it.p} onClick={closeDD} tabIndex={openKey ? 0 : -1}>
                        {it.l}
                        {it.note ? <small>{it.note}</small> : null}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
              <div className="dd-foot">
                <span>{renderedSection.blurb}</span>
                <span className="dd-foot-kbd">⌘K to type instead</span>
              </div>
            </>
          ) : null}
        </div>
      </div>
      </div>

      <BottomTabBar />

      {/* Not requested until the first ⌘K/click — see LazyCommandPalette's
          own comment above. `fallback={null}` is safe: the chunk is tiny
          and already resolving by the time React would need to paint
          anything in its place, and a visible "loading…" here would be a
          worse first frame than a one-tick-late dialog. */}
      {paletteEverOpened ? (
        <React.Suspense fallback={null}>
          <LazyCommandPalette open={palette.open} onClose={() => palette.setOpen(false)} />
        </React.Suspense>
      ) : null}
    </>
  );
}
