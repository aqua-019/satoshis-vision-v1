# v6 design mockups — the reference files five prompts build against

Status: added during v6.1.4 (housekeeping; no `app/`, `api/` or `relay/` change).

Prompts 07, 09, 12, 13 and 14 each say "build against the mockup". These are those mockups.
They used to live outside the repo, so every one of those conversations needed the file
attached by hand; the repo is already checked out in each of them, so committing the files
turns "see attached" into "read this path". That is the whole purpose of this directory.

## The three files

| File | Consumed by | Authoritative for |
|---|---|---|
| `nav-ia-mockup.html` | prompt 07 | The information architecture: 11 top-level nav items collapsed to 6 (Live · Monero · Learn · Future · Operate · About), the ⌘K command palette that makes six viable, hover-intent dropdowns, the morphing active-pill, the mobile bottom tab bar, container-query responsiveness, and the old→new redirect map. |
| `markets-network-mockup.html` | prompts 12, 13, 14 | The Markets and Network chart surfaces: canvas candles, brush-and-zoom in place of refetching range buttons, the dated annotation layer, the accessible table companion, threshold bands, small multiples, the streaming line, the cadence strip, difficulty↔hashrate, and the crosshair synced across panels. |
| `coldboot-splash.html` | prompt 09 (and usefully 08 — its orb readouts are the same dataset) | The Cold Boot splash: the two-phase choreography, the locked 5.00 s base at 0.9×, end-state B where the console becomes the home hero, once-per-session gating, max field density, and the HUD/ring · log/CTA · orb layout. |

## These are design mockups, not shipped code

Nothing here is imported, bundled, typechecked, routed or served. Treat every one as a
picture of an intended surface, not as an implementation to copy.

**The numbers in them are placeholders. The annotations are real.** Each file discloses
this, though not in the same place, so it is worth knowing where to look:

- `coldboot-splash.html` says it on screen: *"Every number here is a placeholder for a real
  feed. Nothing ships as a value."*, and marks the diagrams it invents with an
  `Illustrative` badge.
- `markets-network-mockup.html` says it in its source header: the series are seeded
  placeholders — deliberately seeded, so the same chart renders every load and can be
  screenshot-diffed — while *"the ANNOTATIONS are real: every one is an actual dated event
  from the site's own timeline content."*
- `nav-ia-mockup.html` says it in the page body it stands up in place of a route, and its
  nav destinations and redirect map are the real proposal. The two live figures in its
  topbar rail are placeholders and carry no on-screen marker.

The seeding matters for a second reason: it is what keeps these files honest against the
project's own rule that live surfaces carry no fabricated values. A mockup is allowed
invented numbers precisely because it is never served — which is also why the annotations
being real is the load-bearing half.

## Rules for working on them

- **Do not edit a mockup to match an implementation.** These are the design record. A
  mockup rewritten to agree with the code it was supposed to specify has stopped being a
  spec and become a screenshot.
- **They are not subject to the site's CSP.** The app runs `connect-src 'self'` and reaches
  no third party ever; these files are never served, so that rule does not reach them.
  They already make no network requests and reference no external origin, but do not "fix"
  them to match app conventions they are not bound by.
- **Docs only.** Do not add them to a build, an entry-point list, a route table or a lint
  scope. Nothing in `vite`, `vercel.json`, the prerenderer or the sitemap generator sees
  this directory, and it should stay that way.

One gate does read the files here: `app/verify-future.mjs` walks the whole repo tree for
`.md` and `.html`, checking that no unproven lineage claim about MoneroSpace appears
anywhere. That is a content check, not a build step — it applied to `docs/` before this
directory existed and is why any file added here should avoid asserting that project's
provenance.
