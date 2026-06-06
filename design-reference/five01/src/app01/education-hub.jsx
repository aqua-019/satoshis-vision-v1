// education-hub.jsx — /education tabbed hub (overrides the thin EducationPage)
//   /education            → Journey (the BTC→XMR narrative)
//   /education/timeline   → 48-event privacy-evolution timeline
//   /education/quotes     → Satoshi quote archive
//   /education/simulators → the 6 protocol simulators (cards)
//
// Loaded AFTER pages.jsx so this EducationPage wins. Content components live
// in education-journey/-timeline/-quotes .jsx and register on window.

const EDU_TABS = [
  { id: "journey",    label: "Journey" },
  { id: "timeline",   label: "Timeline" },
  { id: "quotes",     label: "Quotes" },
  { id: "simulators", label: "Simulators" },
];

function EduTabs({ active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
      {EDU_TABS.map((t) => {
        const on = t.id === active;
        return (
          <button key={t.id} type="button" onClick={() => onChange(t.id)}
            style={{ appearance: "none", background: "transparent", cursor: "pointer", border: 0,
              borderBottom: "2px solid " + (on ? "var(--tk-accent)" : "transparent"),
              color: on ? "var(--tk-accent)" : "var(--ink-60)", padding: "10px 16px",
              fontFamily: "var(--f-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
              textShadow: on ? "var(--glow-1)" : "none", marginBottom: -1 }}>{t.label}</button>
        );
      })}
    </div>
  );
}
window.EduTabs = EduTabs;

/* ── shared editorial atoms for the education sections ──────── */
function EduChapter({ n, kicker, title, sub }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 0 2px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span className="mono" style={{ fontSize: 11, letterSpacing: "0.22em", color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>{n}</span>
        <span style={{ height: 1, flex: 1, background: "linear-gradient(to right, var(--tk-accent), transparent)", opacity: 0.4 }} />
        <span className="kicker">{kicker}</span>
      </div>
      <h2 className="serif" style={{ margin: 0, fontSize: 38, fontWeight: 400, letterSpacing: "-0.015em", color: "var(--ink-100)", lineHeight: 1.08 }}
        dangerouslySetInnerHTML={{ __html: title }} />
      {sub ? <p className="mono" style={{ margin: 0, maxWidth: "78ch", fontSize: 13.5, lineHeight: 1.7, color: "var(--ink-60)" }}
        dangerouslySetInnerHTML={{ __html: sub }} /> : null}
    </div>
  );
}
window.EduChapter = EduChapter;

function EduMilestone({ date, title, children, tone = "var(--tk-accent)" }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, padding: "18px 0", borderTop: "1px solid var(--rule)" }}>
      <div>
        <div className="mono" style={{ fontSize: 11, color: tone, letterSpacing: "0.04em", textShadow: tone === "var(--tk-accent)" ? "var(--glow-1)" : "none" }}>{date}</div>
        <div className="serif" style={{ fontSize: 21, fontWeight: 500, color: "var(--ink-100)", marginTop: 6, lineHeight: 1.2 }}>{title}</div>
      </div>
      <div className="mono" style={{ fontSize: 13, lineHeight: 1.72, color: "var(--ink-80)" }}>{children}</div>
    </div>
  );
}
window.EduMilestone = EduMilestone;

function EduPullquote({ children, cite }) {
  return (
    <figure style={{ margin: "8px 0", padding: "26px 30px", border: "1px solid var(--rule)", borderLeft: "2px solid var(--tk-accent)", background: "rgba(255,122,26,0.03)", borderRadius: 2 }}>
      <blockquote className="serif" style={{ margin: 0, fontSize: 23, lineHeight: 1.42, color: "var(--ink-100)", fontStyle: "italic" }}>{children}</blockquote>
      {cite ? <figcaption className="mono" style={{ marginTop: 14, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--tk-accent)" }}>— {cite}</figcaption> : null}
    </figure>
  );
}
window.EduPullquote = EduPullquote;

/* ── simulators tab — reuse the global PROTOCOLS registry ───── */
function EduSimulators({ navigate }) {
  const grouped = PROTOCOLS.reduce((acc, p) => { (acc[p.group] = acc[p.group] || []).push(p); return acc; }, {});
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <PageHeader kicker="Interactive · 6 protocol simulators"
        title='See the cryptography <em style="color:var(--p-50);text-shadow:var(--glow-p);font-style:normal">move</em>.'
        sub="Every privacy primitive in the Monero stack, rendered as a metaphor you can run. Open any one full-bleed in the simulator." />
      {Object.entries(grouped).map(([group, items]) => (
        <section key={group} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="kicker">{group}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {items.map((p) => (
              <Card key={p.id} onClick={() => navigate("/simulate?p=" + p.id)} style={{ padding: 18, cursor: "pointer" }}>
                <div className="kicker" style={{ color: p.tone === "priv" ? "var(--p-50)" : "var(--tk-accent)" }}>{p.kicker}</div>
                <div className="serif" style={{ fontSize: 22, fontWeight: 500, color: "var(--ink-100)", margin: "8px 0 6px" }}>{p.label}</div>
                <p className="mono dim" style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>{p.sub}</p>
                <div className="mono acc" style={{ fontSize: 11, marginTop: 12, letterSpacing: "0.08em" }}>Run simulator →</div>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
window.EduSimulators = EduSimulators;

/* ── the page ───────────────────────────────────────────────── */
function EducationPage({ data, navigate, params, hashSegments }) {
  const sub = (hashSegments && hashSegments[1]) || "journey";
  const onChange = (id) => navigate(id === "journey" ? "/education" : "/education/" + id);

  let content;
  switch (sub) {
    case "timeline":   content = window.EduTimeline ? <window.EduTimeline data={data} /> : null; break;
    case "quotes":     content = window.EduQuotes ? <window.EduQuotes /> : null; break;
    case "simulators": content = <EduSimulators navigate={navigate} />; break;
    default:           content = window.EduJourney ? <window.EduJourney navigate={navigate} /> : null;
  }

  return (
    <AppShell active="education" data={data} hideRail bg={{ intensity: "calm" }}>
      <div style={{ padding: "20px 48px 80px", display: "flex", flexDirection: "column", gap: 22, maxWidth: 1180, margin: "0 auto", width: "100%" }}>
        <Crumbs items={["xmr.irish", "education", sub === "journey" ? "btc → xmr" : sub]} status="PRIVACY IS NOT OPTIONAL" />
        <EduTabs active={sub} onChange={onChange} />
        {content}
      </div>
    </AppShell>
  );
}

window.EducationPage = EducationPage;
