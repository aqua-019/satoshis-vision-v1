/**
 * PanelBoundary.tsx — a thrown render inside one panel stops there.
 *
 * D0864 / D1615 / D0869.
 *
 * Before this, RootBoundary was the ONLY error boundary in the app, mounted at
 * exactly two places: the app root and the /simulate lazy chunk. Everything
 * else was unprotected, so a throw while rendering one panel on /network
 * unwound to main.tsx and blanked the entire site. `feed-status.ts`'s
 * `assertNever` returns a fallback instead of throwing FOR THIS REASON, and
 * says so in its docblock — that comment is corrected in the same change that
 * adds this file.
 *
 * ── IT IS A CLASS, NECESSARILY ─────────────────────────────────────────────
 * React 18 has no hook error-boundary API. RootBoundary.tsx is the in-repo
 * precedent and this follows its shape.
 *
 * ── STYLING: LITERAL HEX, NO var() ─────────────────────────────────────────
 * Same rule as RootBoundary and index.html's critical paint floor. A boundary
 * that reaches for var(--ui-accent) is useless in precisely the case where the
 * stylesheet or the palette is what failed. verify-resilience.mjs asserts this
 * file contains no `var(--`, which mechanises a rule that was previously prose
 * in one file. A pleasant side effect: this component needs no new CSS at all.
 *
 * ── IT NAMES ITS ENDPOINT, BY TYPE ─────────────────────────────────────────
 * `keys` is a non-empty tuple of FeedKey, and the message is built from
 * FEED_ENDPOINT[k]. The vocabulary is enforced by the TYPE, not by prose — the
 * same trick NodeProvenance uses to make a false `fresh="live"` unrepresentable.
 * A generic "something went wrong" is not expressible here.
 *
 * ── RESERVE ────────────────────────────────────────────────────────────────
 * The fallback renders `minHeight: reserve`, and callers pass the SAME constant
 * the content and the skeleton use. minHeight, never height: a fallback TALLER
 * than the content shifts the page just as badly as a shorter one.
 *
 * ── WHERE TO MOUNT IT ──────────────────────────────────────────────────────
 * INSIDE PanelFrame's body, not around the frame. The title, provenance badge,
 * `· stale` chip and UPD stamp are all computed outside the throwing subtree,
 * so they survive — and they are what tell the reader WHICH panel broke.
 */

import * as React from "react";
import { FEED_ENDPOINT, type FeedKey } from "../data/feed-status";

/* Literal hex, no var(). See the header. Lifted from RootBoundary's palette so
   the two failure surfaces look like the same system. */
const WRAP: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
  gap: 10,
  padding: "16px 12px",
  border: "1px solid rgba(255,122,26,0.28)",
  borderRadius: 3,
  background: "rgba(255,122,26,0.03)",
};
const MSG: React.CSSProperties = {
  font: "12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
  color: "#a8a094",
  margin: 0,
};
const PATH: React.CSSProperties = { color: "#ff7a1a" };
const BTN: React.CSSProperties = {
  font: "12px/1 ui-monospace, SFMono-Regular, Menlo, monospace",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#ff7a1a",
  background: "transparent",
  border: "1px solid rgba(255,122,26,0.45)",
  borderRadius: 2,
  /* >= 44px tall including padding — a tap target, not a desktop-only link. */
  padding: "14px 16px",
  minHeight: 44,
  cursor: "pointer",
};
const ATTEMPTS: React.CSSProperties = {
  font: "11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
  color: "#6f675e",
  margin: 0,
};

export interface PanelBoundaryProps {
  /** The endpoint(s) this panel reads. Named in the failure message. */
  keys: readonly [FeedKey, ...FeedKey[]];
  /**
   * An additional same-origin path with no FeedKey — e.g. "/api/markets",
   * which the feed does not poll and which would need six unrelated entries in
   * STALE_AFTER/BOOT_OBS/deriveAll to be given one.
   *
   * Gated: verify-resilience.mjs asserts every literal `also=` in the tree is a
   * path with a real api/<name>.js behind it, so this cannot become a place to
   * invent endpoint names.
   */
  also?: string;
  /** Same constant the content and skeleton use. minHeight, not height. */
  reserve: number | string;
  /** Triggers a real refetch. Without it, retry only clears the error. */
  onRetry?: () => void;
  /**
   * When any of these change, the boundary clears itself. Pass the panel's
   * arrival time (e.g. `freshAt(status.network)`) so a panel HEALS when real
   * data lands, with no click.
   */
  resetKeys?: readonly unknown[];
  children: React.ReactNode;
}

interface PanelBoundaryState {
  error: Error | null;
  attempts: number;
}

export class PanelBoundary extends React.Component<PanelBoundaryProps, PanelBoundaryState> {
  override state: PanelBoundaryState = { error: null, attempts: 0 };

  static getDerivedStateFromError(error: Error): Partial<PanelBoundaryState> {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Console only. No telemetry — this is a Monero privacy site and
    // app/README.md's "Privacy hygiene" rule is no third-party analytics.
    // Same choice as RootBoundary.
    console.error("[xmr.irish] panel render failed:", error, info.componentStack);
  }

  override componentDidUpdate(prev: PanelBoundaryProps) {
    if (!this.state.error) return;
    const a = prev.resetKeys;
    const b = this.props.resetKeys;
    if (!a || !b || a.length !== b.length) return;
    // Self-heal the moment real data arrives, so a transient bad payload does
    // not leave a dead panel until someone notices the button.
    if (a.some((v, i) => !Object.is(v, b[i]))) this.setState({ error: null });
  }

  private retry = () => {
    this.setState((s) => ({ error: null, attempts: s.attempts + 1 }));
    this.props.onRetry?.();
  };

  override render() {
    const { error, attempts } = this.state;
    if (!error) return this.props.children;

    const named = this.props.keys.map((k) => FEED_ENDPOINT[k]);
    if (this.props.also) named.push(this.props.also);

    return (
      <div style={{ ...WRAP, minHeight: this.props.reserve }} role="alert">
        <p style={MSG}>
          This panel failed to render its data from{" "}
          <span style={PATH}>{named.join(" · ")}</span>. The rest of the page is
          unaffected.
        </p>
        <button type="button" style={BTN} onClick={this.retry}>
          Retry {named.length === 1 ? named[0] : "these endpoints"}
        </button>
        {/* Showing the count makes a synchronous re-throw loop VISIBLE rather
            than an unexplained flicker. There is no auto-retry: a render that
            throws deterministically would spin forever. */}
        {attempts > 0 ? <p style={ATTEMPTS}>attempt {attempts + 1}</p> : null}
      </div>
    );
  }
}
