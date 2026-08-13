/**
 * views/mempool-meta.ts — pure-data metadata for the mempool view engines.
 *
 * This is the SINGLE AUTHORITATIVE LIST of which mempool views exist. It was
 * split out of views/index.tsx in p2·7b; that file now holds only the id →
 * component binding and derives MEMPOOL_VIEWS from this array.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────
 * Exactly the same reason views/protocol-meta.ts exists, one directory over:
 * a registry that names React components cannot be read by a consumer that
 * must not pull those components in. Here the consumer is nav/ia.ts, and the
 * wall is harder than a bundle-size preference — it is a hard loader limit:
 *
 *   verify-ia.mjs imports ia.ts under bare Node, where Node's native TS
 *   type-stripping does not support the .tsx extension AT ALL (independent of
 *   whether the file contains JSX — confirmed empirically, see ia.ts's
 *   header). So ia.ts structurally cannot import views/index.tsx.
 *
 * ia.ts therefore HAND-COPIED the view list, with a comment saying it could
 * drift. It drifted on the very first view added after it was written:
 * `orbital` shipped in #174 and was invisible in every nav surface —
 * NavTop's dropdowns, the ⌘K palette, the tab bar, prefetch and breadcrumbs —
 * because all of them read ia.ts. This file is the fix, and it is structural:
 * there is no second list left to forget.
 *
 * ── CONSTRAINTS THIS FILE MUST KEEP ──────────────────────────────────────
 * It is imported by ia.ts (via nav/registries.mjs, which supplies the
 * explicit `.ts` extension bare Node needs — see that file's header) and so
 * it MUST stay loadable by bare Node:
 *   - no `@/` aliases — that is a Vite/tsconfig alias bare Node cannot resolve
 *   - no `.tsx` imports, transitively either
 *   - no React import, and no value import of anything component-bearing
 * In practice: this file imports NOTHING, and should stay that way.
 *
 * ── SIX GATES PARSE THIS FILE'S SOURCE TEXT ──────────────────────────────
 * verify-memviews, verify-tracking, verify-memstats, verify-memperf,
 * verify-memshell and verify-nav all read the view list by matching
 * `/\{\s*id:\s*"([a-z]+)"/g` against a source file. That instrument used to
 * point at views/index.tsx; it points HERE now, because that is where the id
 * literals live. Keep each entry's `id:` as a plain double-quoted literal on
 * the object's opening line — a computed or single-quoted id is invisible to
 * all six, and four of them SWEEP the list, so an unparseable file is not
 * automatically a red.
 *
 * MEASURED, not assumed — registry emptied AND the floors removed, which is
 * the state this repo would have been in had p2·7b re-pointed without them:
 *   - verify-memperf  EXIT 0, printing an EMPTY table under the line
 *                     "✅ every canvas view holds ≥30fps at the 5th
 *                     percentile". A green claim about zero views.
 *   - verify-tracking EXIT 0, "0 passed · 0 fixtured · 0 skipped · 0 failed".
 *   - verify-memstats EXIT 1 — it has an INDEPENDENT guard: its declared-key
 *                     both-directions check reds when no view renders a key.
 *   - verify-memviews EXIT 1 by CRASHING, not asserting — an out-of-loop
 *                     `VIEWS[0]` becomes `data-mem-view="undefined"` and
 *                     waitForSelector times out. Zero assertion lines, no
 *                     tally, a stack trace.
 * So the floors are load-bearing for two and defence-in-depth for two — and
 * for verify-memviews they turn a stack trace into a named red. An earlier
 * draft of this comment said all four went vacuously green; that was read off
 * the code rather than run, and it was wrong about half its subject.
 */

/** Metadata for one mempool view — everything about it EXCEPT its component.
 *  views/index.tsx extends this with `Component` to form MempoolViewMeta. */
export interface MempoolViewMetaBase {
  id: string;
  label: string;
  sub: string;
  star?: boolean;
  /** Default to a fit-to-canvas-width scale on load (P1). The wide canvas views
   *  (reactor/bridge/sediment/constellation) opt in; Classic's intentional block
   *  ribbon, Terminal and Orbital are excluded. */
  fit?: boolean;
  /** Reflows to the viewport on phones instead of panning inside the 900px-pinned
   *  box (styles.css:2502-2516). Classic and Orbital.
   *
   *  It is NOT "pure-DOM only", which is what this said while Classic was the sole
   *  member: the pin exists for views whose proportions are FIXED, and Orbital's
   *  canvas is fluid — `.mem-canvas` is `position: absolute; inset: 0` inside a
   *  host whose height is derived from its measured width, so it has no authored
   *  width to preserve and reflowing costs it nothing. Terminal deliberately KEEPS
   *  the pin: its shell is `1fr 320px` with 8-column readouts, so unpinned it
   *  squeezes to an unreadable sliver instead of panning at desktop proportions. */
  reflow?: boolean;
}

/**
 * The mempool views, in switcher order. `as const` is load-bearing: it is what
 * lets MempoolViewId below be a real union, which in turn makes
 * views/index.tsx's `Record<MempoolViewId, ViewComponent>` a COMPILE ERROR
 * when a view is registered here with no component bound to it (and when a
 * component is bound to an id that is not a view). That is the same
 * exhaustiveness mechanism the two `Record<ProvSource, …>` maps use in
 * design/provenance.tsx — nothing pins the member count, the Record does.
 */
export const MEMPOOL_VIEW_META = [
  { id: "reactor", label: "Reactor", sub: "3D iso · hex lattice · ring fan", star: false, fit: true },
  // v2·5: "12-pane" was already wrong before the rebuild — the shipped view had
  // seven panels and a stat row. Recounted, not adjusted: radar · instrument
  // bank · alert tape · oscilloscope · cadence · console · pool attribution.
  { id: "bridge", label: "Ops Bridge", sub: "7-panel mission control", star: false, fit: true },
  { id: "sediment", label: "Sediment", sub: "vertical core-sample tube", star: false, fit: true },
  { id: "constellation", label: "Constellation", sub: "luminous network sphere", star: false, fit: true },
  // p2·7: the first NET-NEW view of the eleven, and the first hero surface that
  // is neither scaled nor panned — `fit: false` + `reflow: true`, so naturalW
  // settles at canvasW at every viewport and authored 11px renders at 11px,
  // including at 390. See orbital.tsx's header for why that is available to
  // this composition and not to reactor/bridge.
  { id: "orbital", label: "Orbital", sub: "fee rings · age bearing", star: false, reflow: true },
  // p2·8: the second net-new view, and the second fluid one — same `fit: false`
  // + `reflow: true` pair as Orbital, whose mechanism it reuses verbatim
  // (`contain: inline-size` on the root, tabular grids as `.aby-*` CLASSES).
  // Placed next to Orbital because they are the two views that are neither
  // scaled nor panned at any viewport, which is the property a reader of this
  // list most needs to see grouped. See abyss.tsx's header for the identity —
  // it borders sediment and orbital, and the separation is an axis inversion
  // against each.
  { id: "abyss", label: "Abyss", sub: "dark water · fee luminosity", star: false, reflow: true },
  // p2·9: the third net-new view, the third fluid one — same `fit: false` +
  // `reflow: true` pair as Orbital and Abyss — and the first in the suite whose
  // horizontal axis is WALL-CLOCK TIME. It is the only view that draws the FLOW
  // (arrivals over time) rather than the STOCK (the pool's current contents),
  // and the only one with a FUTURE: the segment right of `now`, ending at the
  // instant the next block is due. Placed next to Orbital and Abyss because
  // those three are the views that are neither scaled nor panned at any
  // viewport, which is the property a reader of this list most needs to see
  // grouped. See pulse.tsx's header for the identity — it borders orbital and
  // abyss on the age axis and sediment on the fee axis, and the separation
  // against each is recorded there.
  { id: "pulse", label: "Pulse", sub: "time domain · arrival waveform", star: false, reflow: true },
  { id: "terminal", label: "Terminal", sub: "cli-first · monerod tail", star: false },
  { id: "classic", label: "Classic", sub: "explorer · tx + block inspectors", star: true, reflow: true },
] as const;

/** The union of registered view ids, derived from the array above rather than
 *  restated. See MEMPOOL_VIEW_META's docblock for what this buys. */
export type MempoolViewId = (typeof MEMPOOL_VIEW_META)[number]["id"];
