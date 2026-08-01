import * as React from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { App } from "./App";

/**
 * Render one route to static HTML.
 *
 * All 11 pages are React.lazy. lazy() only kicks off its import on the FIRST
 * render attempt, which then suspends — so a single renderToString yields the
 * Suspense fallback ("loading…"). Rendering, letting the microtask queue
 * drain, and rendering again lets lazy cache the resolved module and the
 * second pass emit real markup. Repeat for nested lazies.
 */
/**
 * Any Suspense fallback this app can emit.
 *
 * The old pattern was `/loading[….]/` — "loading" followed immediately by an
 * ellipsis. It matched App.tsx's outer fallback ("loading…") and MISSED the
 * nested one ("loading simulators…"), on one character: the space. The cost of
 * that near-miss was invisible and total. /simulate broke out of the loop below
 * after pass 2 while still suspended, then failed the same test in
 * prerender.mjs, so the route shipped with an EMPTY #root and a React
 * "renderToString does not support Suspense" notice — no content, no <main>, no
 * heading, no skip link. One of eleven routes silently had no JS-off document
 * at all, which is the invariant prerendering exists to hold.
 *
 * Matching the word plus an optional qualifier plus the ellipsis keeps it tight
 * enough that ordinary prose ("downloading…", "loading the two faces") does not
 * trip it, while covering any `loading <thing>…` fallback added later. Exported
 * so prerender.mjs tests the SAME pattern this loop breaks on — two copies of
 * this regex drifting apart is precisely how the gap opened.
 */
export const SUSPENDED_RE = /loading(\s+[a-z]+)?[….]|does not support Suspense/i;

export async function render(url: string, passes = 8): Promise<string> {
  let html = "";
  for (let i = 0; i < passes; i++) {
    html = renderToString(
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    );
    if (!SUSPENDED_RE.test(html)) break;
    await new Promise((r) => setTimeout(r, 0));
  }
  return html;
}
