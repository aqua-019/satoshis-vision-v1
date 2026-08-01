/**
 * pages/NotFoundPage.tsx — fallback for unknown routes.
 */

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/layout/PageShell";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <PageShell width="standard" bg={{ intensity: "calm" }}>
      {/* .page-shell is align-items:stretch, so the 404's centring lives on an
          inner wrapper rather than as a one-off prop on the shared container. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center", textAlign: "center" }}>
        <div className="mono acc glow" style={{ fontSize: 96, letterSpacing: "0.05em" }}>404</div>
        {/* This line was already the page's heading in everything but name, so
            it becomes the real <h1> rather than growing an .sr-only twin.
            `margin: 0` is NOT decoration: @layer reset zeroes margins on
            html/body only — there is no heading reset in this codebase — so a
            bare <h1> would inherit the UA's `margin-block: 0.67em`, and the
            parent is a flex COLUMN, where item margins are honoured (they are
            not collapsed away as they would be in a block container). Without
            it this swap adds ~19px above and below. Measured at 1440 and 390:
            with it, the box is pixel-identical to the <div> it replaces. */}
        <h1 id="page-title" className="serif" style={{ margin: 0, fontSize: 28, fontWeight: 400, color: "var(--ink-100)" }}>This page is not in the mempool.</h1>
        <p className="mono dim" style={{ maxWidth: "50ch", fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
          The route you tried doesn't exist in 0.1 yet. Try the nav above.
        </p>
        <button type="button" onClick={() => navigate("/")} className="proto-btn">← HOME</button>
      </div>
    </PageShell>
  );
}
