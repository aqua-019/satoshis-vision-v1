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
export async function render(url: string, passes = 6): Promise<string> {
  let html = "";
  for (let i = 0; i < passes; i++) {
    html = renderToString(
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    );
    if (!/loading[….]/.test(html)) break;
    await new Promise((r) => setTimeout(r, 0));
  }
  return html;
}
