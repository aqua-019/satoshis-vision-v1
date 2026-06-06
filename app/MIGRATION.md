# MIGRATION — manual fixups after `npm run port`

The auto-porter (`scripts/port-jsx-to-tsx.mjs`) does the boring 90%:

- Strips `window.X = X` / `Object.assign(window, {...})` blobs
- Adds an ES-module imports preamble (React, primitives, helpers, hooks)
- Renames `.jsx` → `.tsx`
- Adds `: any` annotations to component props (TS-lite mode)

What it does NOT do — your manual checklist after running it:

---

## 1. Tighten parameter types

The porter writes `function FooView({ data, bg }: any) {`. Replace
`any` with the proper types:

```ts
import type { MoneroLive } from "@/data/types";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

export function ReactorView({ data, bg }: ViewProps) { … }
```

Same for sub-components — they typically receive `mempool`, `peers`,
or `blocks` arrays. Use `Tx[]`, `Peer[]`, `Block[]` from `data/types`.

## 2. Switch to `useMoneroLive()` inside views (optional)

Views currently take `data` as a prop, which is fine. If you'd rather
read it from context, drop the prop and call `useMoneroLive()` inside.
Pick one convention and stick with it across all views.

## 3. Update `src/views/index.tsx`

Replace each `stub("…")` with a real import:

```tsx
import { ReactorView }       from "@/mempool/reactor";
import { BridgeView }        from "@/mempool/bridge";
// …

export const MEMPOOL_VIEWS = [
  { id: "reactor", label: "Reactor", sub: "…", star: true, Component: ReactorView },
  // …
];
```

## 4. Resolve `ProtoArtboard` `title` prop

The legacy files pass JSX directly into `title`:

```jsx
title={<>Dandelion++ — where the <em>originator</em> gets lost</>}
```

The TS `ProtoArtboard` types `title` as `string` (rendered via
`dangerouslySetInnerHTML`). Either:

- Convert each title to an HTML string: `title='Dandelion++ — where the <em>originator</em> gets lost'`
- Or widen the prop type in `ProtoArtboard.tsx` to `string | React.ReactNode`
  and branch on `typeof title`

Going with HTML strings keeps the title editable in-line by non-engineers.

## 5. Drop the legacy `NavTop` / `NetRail` / `Footer` inside views

Each mempool view contained its own copy of the page chrome. After
porting, the page (`MempoolPage`) renders the chrome and the view
renders only its content. Delete the chrome from each `*View.tsx`:

```diff
- <div className="art">
-   <ArtBackground intensity={…} />
-   <div className="art-stage">
-     <NavTop active="mempool" />
-     <div className="shell">
-       <NetRail data={data} />
-       <main className="main">
-         {/* view content */}
-       </main>
-     </div>
-     <Footer data={data} />
-   </div>
- </div>
+ <div className="main" style={{ overflow: "auto" }}>
+   {/* view content */}
+ </div>
```

Protocol views (`ProtoArtboard`) need no change — they already render
only their stage + panel.

## 6. Remove unused imports

The porter adds a blanket import preamble. After cleanup, run:

```bash
npm run typecheck
```

Then delete what's unused per `tsc` complaints (or run a quick
`eslint --fix` if you've configured it).

## 7. Fix `useTick` and `randHex` references

- `useTick` is exported from `@/design/ArtBackground` — already in
  the preamble
- `randHex`, `shortHash`, `fmtN`, `fmtFee`, `fmtBytes` are in
  `@/data/types` — also in the preamble
- The legacy code calls them as bare globals (`useTick(60)`, `randHex(64)`).
  These now resolve via the imports — no rename needed

---

## Estimated effort

Per file: ~10–20 minutes for a clean pass. There are 11 view files
(5 mempool + 6 protocol), so ~2–3 hours total for a careful migration.

If you're handing this to Claude Code: paste this MIGRATION.md as
context and point it at one file. It can do the boilerplate cleanup
in a few iterations per file.

---

## Verification

After porting all views:

```bash
npm run typecheck   # should pass with zero errors
npm run build       # should bundle without warnings
npm run dev         # navigate every route, every view
```

A visual diff against `design-hub.html` (the legacy canvas) is the
best regression check — every artboard there should be reproducible
under the new TS modules.
