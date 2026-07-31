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
        <div className="serif" style={{ fontSize: 28, color: "var(--ink-100)" }}>This page is not in the mempool.</div>
        <p className="mono dim" style={{ maxWidth: "50ch", fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
          The route you tried doesn't exist in 0.1 yet. Try the nav above.
        </p>
        <button type="button" onClick={() => navigate("/")} className="proto-btn">← HOME</button>
      </div>
    </PageShell>
  );
}
