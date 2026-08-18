/**
 * pages/future/ProtocolPage.tsx — /future/protocol?p={fcmp|seraphis|jamtis|carrot|cuprate}
 *
 * ── WHY THIS PAGE EXISTS (p4·06) ────────────────────────────────────────
 * The Future dropdown's five protocol rows were `${R.FUTURE}#<id>`, and #184
 * measured that /future renders no panel any of them can scroll to: every one
 * landed you at the top of /future having promised a protocol. `nav/ia.ts`
 * has admitted this in its own comment since p3·16 — "every one of those
 * anchors is hollow". This is the destination they now have.
 *
 * ── ONE ROUTE, FIVE URLS ────────────────────────────────────────────────
 * `?p=` keyed, the shape `/learn/sim?p=` already ships, for the reason
 * scripts/routes.mjs records: five paths would be five ROUTES entries, five
 * prerendered files, five sitemap rows and five budget rows for five
 * renderings of one component over one array.
 *
 * ── THE THREE STATES, AND WHY THE EMPTY ONE IS AN INDEX ─────────────────
 *   no `?p=`        → the INDEX of five.
 *   known `?p=`     → that protocol, rendered by the shared ProtocolDetail.
 *   unknown `?p=`   → names what it could not find, and renders NOTHING else.
 *
 * SimulatePage falls back to a DEFAULT simulator when the key is absent. This
 * page deliberately does not, and the difference is that the bare path here is
 * a real destination: `/future/protocol` is in ROUTES, so it prerenders, it is
 * in sitemap.xml, it is a row in index.html's JS-off nav and it is "Protocols"
 * in RootBoundary. A URL that names no protocol must not quietly serve FCMP++
 * to a search engine and a JS-off reader — the index names all five and links
 * them, which is the honest answer to "which protocol?" when none was asked
 * for.
 *
 * ── THE UNKNOWN-ID BEHAVIOUR IS COPIED, NOT INVENTED ────────────────────
 * `useUrlState`'s third tuple slot distinguishes ABSENT from PRESENT-BUT-
 * UNRECOGNISED, and collapsing the two is the v6.0.9 bug its own docblock
 * records — a "RUN THE JAMTIS SIMULATOR" button that silently opened decoy
 * selection. So `notFound` reproduces SimulatePage.tsx's predicate exactly,
 * including the `!== ""` clause that lets a bare `?p=` fall through to the
 * index rather than erroring, and nothing is ever substituted: no detail, no
 * `aria-current` on any index row.
 *
 * The wired gate for this class is verify-future.mjs §11c, a positive+negative
 * PAIR — the page must NAME the requested id AND must not render the fallback.
 * (verify-sims.mjs states the same rule at its item 2, but it is an ORPHAN
 * wired to neither npm nor CI and every route literal in it is stale, so it is
 * cited here as prose and not as the thing that runs.)
 *
 * ── WHAT THIS PAGE DOES NOT DO ──────────────────────────────────────────
 * It does not fork the data. Every string comes from FUTURE_PROTOCOLS, and the
 * body is ./ProtocolDetail — the same component the /future modal renders, so
 * the two surfaces cannot drift. It also does not import ProtoPopup, V6Modal
 * or ./cards: see ProtocolDetail's header for the byte reason.
 */

import * as React from "react";
import { Link } from "react-router-dom";

import { PageShell } from "@/layout/PageShell";
import { PageHeader } from "@/layout/AppShell";
import { Crumbs, Pill } from "@/design/primitives";
import { useUrlState } from "@/routes/useUrlState";
import { FUTURE_PROTOCOLS } from "./data";
import { ProtocolDetail } from "./ProtocolDetail";
import { R } from "../../../scripts/routes.mjs";

const PROTOCOL_IDS = FUTURE_PROTOCOLS.map((p) => p.id);

export function ProtocolPage() {
  // `fallback` is required by the hook's contract but is never rendered as a
  // substitute here: every branch below reads `raw`/`isKnown`, so an absent
  // key opens the index and an unknown key opens the not-found. Passing the
  // first id keeps the hook's generic honest without giving it authority.
  const [, setProtocol, { raw: requested, isKnown }] = useUrlState({
    key: "p",
    values: PROTOCOL_IDS,
    fallback: PROTOCOL_IDS[0]!,
  });

  const notFound = requested != null && requested !== "" && !isKnown;
  const active = isKnown ? FUTURE_PROTOCOLS.find((p) => p.id === requested) ?? null : null;

  return (
    <PageShell width="standard" bg={{ intensity: "calm" }}>
      {/* `status` is carried on every state EXCEPT the index, and that is the
          p3·16 duplicate-label rule rather than a whim: on the index the header
          Pill already says "5 protocols", so both slots said the same thing
          within ~120px — and the crumbs LED PULSES, which implies a live
          reading for a constant. On a detail page the Pill carries that
          protocol's PHASE instead, so the two say different things and both
          earn their place. TrustedPeersPage is the precedent that keeps both
          ("4 collaborators" / "4 partners"). Found by looking at the render;
          nothing compares two labels for saying the same thing. */}
      <Crumbs
        path={active ? `${R.FUTURE_PROTOCOL}?p=${active.id}` : R.FUTURE_PROTOCOL}
        tail={notFound ? "not found" : undefined}
        status={active || notFound ? `${FUTURE_PROTOCOLS.length} protocols` : undefined}
      />

      {active ? (
        <>
          <PageHeader
            kicker={`Future protocol · ${active.sub}`}
            title={`<em style="color:${active.c};text-shadow:0 0 14px ${active.c}66;font-style:normal">${active.tag}</em> — ${active.head}`}
            sub={active.lede}
            right={<Pill tone="acc" dot>{active.status}</Pill>}
          />
          <ProtocolDetail p={active} />
          <ProtocolSwitcher activeId={active.id} onPick={setProtocol} />
        </>
      ) : notFound ? (
        <>
          {/* THE TITLE DOES NOT NAME THE REQUESTED ID, AND THAT IS A SECURITY
              DECISION rather than an omission. `PageHeader` renders `title`
              through `dangerouslySetInnerHTML` (AppShell.tsx:101) so the house
              style can put an <em> in a headline — interpolating `requested`,
              which comes straight off the URL, would be script injection on a
              page anyone can hand someone a link to. SimulatePage names the id
              in ITS h1 safely because that h1 is a plain React child and React
              escapes it; this one cannot borrow that. The id IS named, one
              element down, as a React child in <ProtocolNotFound>. Do not
              "improve" this by moving it up. */}
          <PageHeader
            kicker="Future protocol · not found"
            title='There is no protocol with that <em style="color:var(--y-50);font-style:normal">id</em>.'
            sub="You were not redirected to a different protocol, because showing you the wrong one would be worse than showing you nothing."
          />
          <ProtocolNotFound requested={requested!} />
          <ProtocolSwitcher activeId={null} onPick={setProtocol} />
        </>
      ) : (
        <>
          <PageHeader
            kicker="Future protocol · the five that follow FCMP++"
            title='What Monero is <em style="color:var(--c-50);text-shadow:0 0 14px rgba(34,211,238,0.4);font-style:normal">becoming</em>.'
            sub="Five protocol changes, each with its own page: what it does, what it costs, and where to read the primary sources."
            right={<Pill tone="acc" dot>{FUTURE_PROTOCOLS.length} protocols</Pill>}
          />
          <ProtocolIndex />
        </>
      )}
    </PageShell>
  );
}

/** The bare-path state. Every protocol is a real link, so this page is worth
 *  prerendering and worth being in the sitemap. */
function ProtocolIndex() {
  return (
    <section
      data-protocol-index
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}
    >
      {FUTURE_PROTOCOLS.map((p, i) => (
        <div key={p.id} className="v6-stagger" style={{ ["--stagger-i" as never]: String(i), minWidth: 0 }}>
          <Link
            to={`${R.FUTURE_PROTOCOL}?p=${p.id}`}
            data-protocol-link={p.id}
            className="panel"
            style={{
              display: "flex", flexDirection: "column", gap: 10, minWidth: 0,
              padding: "20px 22px", textDecoration: "none", borderColor: p.c + "44",
            }}
          >
            <span className="v6-status" style={{ color: p.sc }}>
              <span className="led" style={{ background: p.sc, boxShadow: `0 0 8px ${p.sc}`, margin: 0 }} />
              {p.status}
            </span>
            <span className="serif" style={{ fontSize: "clamp(24px, 2vw, 32px)", color: p.c, textShadow: `0 0 14px ${p.c}55` }}>{p.tag}</span>
            <span className="kicker">{p.sub} · ETA {p.eta}</span>
            <span className="mono dim" style={{ fontSize: "var(--fs-body)", lineHeight: 1.7 }}>{p.head}</span>
          </Link>
        </div>
      ))}
    </section>
  );
}

/** Names what was asked for and what exists. Never substitutes a protocol.
 *  Modelled on SimulatePage's SimNotFound, which is the shape verify-future
 *  §11c pins for the sibling route. */
function ProtocolNotFound({ requested }: { requested: string }) {
  return (
    /* No kicker here. PageHeader above already carries one, and an earlier
       draft had both saying "NO SUCH PROTOCOL" within a few lines of each
       other — the duplicate-label defect p3·16 recorded when a page printed
       "5 APPS" twice within 60px. The header states the condition; this
       states the particular id, which is the thing only this element knows. */
    <div role="alert" data-protocol-notfound style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: "72ch" }}>
      <p className="mono" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.75, color: "var(--ink-60)" }}>
        Nothing on this site is published under the id{" "}
        <em style={{ fontStyle: "normal", color: "var(--y-50)" }}>“{requested}”</em>. Pick one of the{" "}
        {FUTURE_PROTOCOLS.length} registered protocols below.
      </p>
      <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--ink-40)", lineHeight: 1.9 }}>
        <div className="kicker" style={{ marginBottom: 6 }}>Registered ids</div>
        {PROTOCOL_IDS.join(" · ")}
      </div>
    </div>
  );
}

/** The switcher, shown beside a rendered protocol and under a not-found.
 *  `activeId` is null under not-found, so nothing carries aria-current —
 *  the page refuses to highlight a substitute as well as refusing to render
 *  one, which is SimulatePage.tsx:57's rule. */
function ProtocolSwitcher({ activeId, onPick }: { activeId: string | null; onPick: (id: string) => void }) {
  return (
    <div data-protocol-switcher style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--rule)" }}>
      {/* "Other protocols" is only true when there IS a current one. Under
          not-found nothing is active, so "other" has no referent — the label
          says what the row is instead. Found by reading the rendered
          not-found page. */}
      <span className="kicker" style={{ alignSelf: "center", color: "var(--ink-40)" }}>
        {activeId ? "Other protocols" : "Registered protocols"}
      </span>
      {FUTURE_PROTOCOLS.map((p) => {
        const on = p.id === activeId;
        return (
          <button
            key={p.id}
            type="button"
            aria-current={on ? "page" : undefined}
            onClick={() => onPick(p.id)}
            style={{
              appearance: "none", cursor: "pointer", background: "transparent",
              border: "1px solid " + (on ? p.c : "var(--ink-10)"),
              color: on ? p.c : "var(--ink-60)",
              padding: "6px 10px",
              fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)",
              letterSpacing: "0.1em", textTransform: "uppercase",
              boxShadow: on ? `0 0 10px ${p.c}44` : "none",
            }}
          >
            {p.tag}
          </button>
        );
      })}
    </div>
  );
}
