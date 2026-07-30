// api/feeds.js — xmr.irish v6 · 24-hour news/feed proxy
//
// Why this file exists: the Future tab wants getmonero.org announcements and
// (optionally) the two X accounts. Neither can be read from a browser —
// verified 2026-07-23:
//
//   getmonero.org/feed.xml   200 OK, real Atom feed, but sends NO
//                            Access-Control-Allow-Origin → fetch() blocked.
//   api.x.com                401 without a bearer token. No unauthenticated
//                            public API exists at any tier.
//
// api.github.com DOES send ACAO:*, but this site's own CSP is
// `connect-src 'self'` (vercel.json), so the browser blocks cross-origin
// fetches regardless. GitHub therefore routes through here too — which also
// keeps visitor IPs off GitHub and keeps the app's same-origin invariant
// (see app/src/data/http.ts).
//
// CommonJS on purpose — api/xmr.js is CommonJS and mixing module systems in
// this directory has bitten this project before (see v5.0.22 notes).
//
// Contract:
//   GET /api/feeds?src=getmonero&n=5
//     → { source, fetchedAt, items: [{ title, url, date }] }
//   GET /api/feeds?src=mrl&n=6
//     → { source, fetchedAt, items: [{ n, t, u, url, c }] }
//   GET /api/feeds?src=ghrepo&repo=owner/name
//     → { source, fetchedAt, repo, stars, pushed, issues }
//   GET /api/feeds?src=x&handle=monero&n=5      (only if X_BEARER_TOKEN set)
//     → { source, fetchedAt, items: [{ title, url, date }] }
//     → 501 + { error, hint } when the token is absent — an honest empty
//       state beats a silent one.

const FEEDS = {
  getmonero: "https://www.getmonero.org/feed.xml",
};

const X_HANDLES = { monero: "monero", moneroresearchl: "MoneroResearchL" };

const DAY = 86400; // seconds

/* GitHub rejects requests with no User-Agent. Sent on every github.com call
   (src=ghrepo and src=mrl). */
const GH_HEADERS = {
  "User-Agent": "xmr.irish/6.0 (+https://xmr.irish)",
  Accept: "application/vnd.github+json",
};

/* Hard allowlist — this endpoint must not become an open GitHub proxy.
   Canonical case as GitHub reports it; matching against the caller's repo
   param is case-insensitive (see canonicalRepo). */
const GH_ALLOWED = [
  "kayabaNerve/fcmp-plus-plus",
  "seraphis-migration/wallet3",
  "UkoeHB/Seraphis",
  "jeffro256/carrot",
  "Cuprate/cuprate",
  "monero-project/monero",
  "monero-project/research-lab",
];

/* ── minimal Atom parser ──────────────────────────────────────────
   getmonero.org is Jekyll-generated Atom: <entry> with <title>,
   <link href> and <published>. Not a general-purpose feed parser —
   deliberately narrow so it fails loudly if the format changes. */
function parseAtom(xml, n) {
  const items = [];
  const entries = xml.split("<entry>").slice(1);
  for (const e of entries.slice(0, n)) {
    const title = (e.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || "";
    const url = (e.match(/<link[^>]*href="([^"]+)"/) || [])[1] || "";
    const date = (e.match(/<published>([^<]+)<\/published>/) || [])[1]
      || (e.match(/<updated>([^<]+)<\/updated>/) || [])[1] || "";
    if (!title || !url) continue;
    items.push({ title: decodeEntities(title.trim()), url, date });
  }
  return items;
}

function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/* Validate a caller-supplied "owner/name" repo string. Pure — no network,
   no allowlist check (see canonicalRepo for that). Returns the trimmed
   string on success, null on any rejection. */
function parseRepoParam(raw) {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > 100) return null;
  if (s.includes("..")) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(s)) return null;
  return s;
}

/* Case-insensitive match against GH_ALLOWED, returning the canonically
   cased entry (what we send upstream) or null if not allowlisted. */
function canonicalRepo(parsed) {
  const lower = parsed.toLowerCase();
  return GH_ALLOWED.find((r) => r.toLowerCase() === lower) || null;
}

/* Pure transform: GitHub repo API JSON → response fields. Separated from
   the network call so it's testable offline. */
function mapRepo(json) {
  return {
    stars: json?.stargazers_count,
    pushed: json?.pushed_at,
    issues: json?.open_issues_count,
  };
}

/* Pure transform: GitHub issues-list API JSON → items[]. The issues
   endpoint also returns PRs (they carry a `pull_request` key) — drop those. */
function mapIssues(json) {
  const arr = Array.isArray(json) ? json : [];
  return arr
    .filter((i) => i && !("pull_request" in i))
    .map((i) => ({
      n: i.number,
      t: i.title,
      u: i.updated_at,
      url: i.html_url,
      c: i.comments,
    }));
}

async function getMoneroBlog(n) {
  const r = await fetch(FEEDS.getmonero, {
    headers: { "User-Agent": "xmr.irish/6.0 (+https://xmr.irish)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error("getmonero.org feed HTTP " + r.status);
  const xml = await r.text();
  const items = parseAtom(xml, n);
  if (!items.length) throw new Error("getmonero.org feed parsed to 0 items — format may have changed");
  return items;
}

/* research-lab open issues, newest-updated first. */
async function getMrlIssues(n) {
  const r = await fetch(
    `https://api.github.com/repos/monero-project/research-lab/issues?state=open&sort=updated&per_page=${n}`,
    { headers: GH_HEADERS, signal: AbortSignal.timeout(8000) }
  );
  if (!r.ok) throw new Error("github issues HTTP " + r.status);
  const json = await r.json();
  return mapIssues(json);
}

/* Repo metadata (stars/pushed/open issues) for an allowlisted repo. */
async function getGhRepo(repoCanonical) {
  const r = await fetch(`https://api.github.com/repos/${repoCanonical}`, {
    headers: GH_HEADERS,
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error("github repo HTTP " + r.status);
  const json = await r.json();
  return mapRepo(json);
}

/* ── X / Twitter ──────────────────────────────────────────────────
   Requires X_BEARER_TOKEN in the Vercel project env. Without it this
   returns 501 rather than pretending. Note X's free tier does not
   include tweet reads — a paid tier is required for this to work. */
async function getXPosts(handle, n) {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    const err = new Error("X_BEARER_TOKEN not configured");
    err.code = 501;
    err.hint = "X has no unauthenticated read API. Set X_BEARER_TOKEN (paid tier) to enable, or leave the Future tab's X accounts as link-outs.";
    throw err;
  }
  const auth = { Authorization: "Bearer " + token };
  const u = await fetch(`https://api.x.com/2/users/by/username/${encodeURIComponent(handle)}`, {
    headers: auth,
    signal: AbortSignal.timeout(8000),
  });
  if (!u.ok) throw new Error("X user lookup HTTP " + u.status);
  const uid = (await u.json())?.data?.id;
  if (!uid) throw new Error("X user lookup returned no id");

  const t = await fetch(
    `https://api.x.com/2/users/${uid}/tweets?max_results=${Math.max(5, n)}&tweet.fields=created_at&exclude=retweets,replies`,
    { headers: auth, signal: AbortSignal.timeout(8000) }
  );
  if (!t.ok) throw new Error("X timeline HTTP " + t.status);
  const d = await t.json();
  return (d.data || []).slice(0, n).map((tw) => ({
    title: tw.text.length > 140 ? tw.text.slice(0, 137) + "…" : tw.text,
    url: `https://x.com/${handle}/status/${tw.id}`,
    date: tw.created_at || "",
  }));
}

module.exports = async (req, res) => {
  const src = String(req.query?.src || "getmonero").toLowerCase();
  const n = Math.min(Math.max(parseInt(req.query?.n, 10) || 5, 1), 20);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    if (src === "ghrepo") {
      // Single-object response — no items[]. Validate before touching the network.
      const rawRepo = req.query?.repo;
      const repoParam = typeof rawRepo === "string" ? rawRepo : Array.isArray(rawRepo) ? rawRepo[0] : "";
      const parsed = parseRepoParam(repoParam);
      if (!parsed) {
        res.statusCode = 400;
        return res.end(JSON.stringify({
          error: "invalid repo",
          hint: "repo must look like owner/name (letters, digits, ., _, - only; max 100 chars; exactly one slash; no \"..\")",
        }));
      }
      const canonical = canonicalRepo(parsed);
      if (!canonical) {
        res.statusCode = 400;
        return res.end(JSON.stringify({
          error: "invalid repo",
          hint: "repo is not in the allowlist: " + GH_ALLOWED.join(", "),
        }));
      }
      const repoData = await getGhRepo(canonical);
      res.setHeader("Cache-Control", `s-maxage=${DAY}, stale-while-revalidate=${DAY}`);
      res.statusCode = 200;
      return res.end(JSON.stringify({
        source: src,
        fetchedAt: new Date().toISOString(),
        repo: canonical,
        ...repoData,
      }));
    }

    let items;
    if (src === "getmonero") {
      items = await getMoneroBlog(n);
    } else if (src === "mrl") {
      items = await getMrlIssues(n);
    } else if (src === "x") {
      const raw = String(req.query?.handle || "monero").toLowerCase();
      const handle = X_HANDLES[raw];
      if (!handle) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "unknown handle", allowed: Object.keys(X_HANDLES) }));
      }
      items = await getXPosts(handle, n);
    } else {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "unknown src", allowed: ["getmonero", "mrl", "ghrepo", "x"] }));
    }

    // Cache at the edge for 24h; serve stale for another 24h while
    // revalidating, so a slow upstream never blocks the page.
    res.setHeader("Cache-Control", `s-maxage=${DAY}, stale-while-revalidate=${DAY}`);
    res.statusCode = 200;
    return res.end(JSON.stringify({ source: src, fetchedAt: new Date().toISOString(), items }));
  } catch (e) {
    res.statusCode = e.code === 501 ? 501 : 502;
    // Short negative cache — don't hammer a broken upstream, don't sit on
    // a stale error for a full day either.
    res.setHeader("Cache-Control", "s-maxage=300");
    return res.end(JSON.stringify({ error: String(e.message || e), hint: e.hint || null }));
  }
};

module.exports.parseAtom = parseAtom;
module.exports.decodeEntities = decodeEntities;
module.exports.parseRepoParam = parseRepoParam;
module.exports.mapRepo = mapRepo;
module.exports.mapIssues = mapIssues;
module.exports.GH_ALLOWED = GH_ALLOWED;
