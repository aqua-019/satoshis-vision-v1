/* ═══════════════════════════════════════════════════════════════
   Markets Aggregator — Vercel Serverless Function
   Server-side CoinGecko composition for the Markets page. Replaces a
   hardcoded coin list with two data-driven groups (privacy-coin peers,
   market-cap majors), fetches per-coin history ONCE per (id, days) per
   warm lambda instance, and shares it across every visitor instead of
   every visitor re-fetching from CoinGecko client-side.

   Module system: this file is ESM (`export default async function
   handler`), matching api/coingecko.js — its domain sibling (same
   upstream, same last-good/stale-cache shape). RULE: new files adopt
   the module system of the file they most resemble; never convert an
   existing file. (api/feeds.js's CommonJS warning is about converting
   an existing file, not about the directory as a whole — it already
   runs both module systems in production, file by file.)

   Usage:
     GET /api/markets?days=30      -> see api/verify-markets.mjs / the
                                       handoff brief for the full
                                       response contract.

   No other query params are accepted — group composition (which coins,
   how many) is entirely server-controlled, which keeps the cache key
   space at exactly 4 entries (days ∈ {7,30,90,365}).

   ENV: COINGECKO_API_KEY (optional but strongly recommended) — a free
   CoinGecko *demo* key, sent as the 'x-cg-demo-api-key' header. Without
   it this function runs on the anonymous public tier: ~5-15 req/min
   against an IP shared with every other Vercel tenant, which a
   cold-start fan-out (2 rankings + meta + up to 14 histories) will
   exhaust. api/coingecko.js reads the same variable — the two share one
   upstream quota, so set it once and both benefit.

   RESPONSE QUALITY (v6.0.6): every response carries
   'X-Markets-Quality: full|degraded'. Only a fully-live payload is
   cached at the long s-maxage; anything degraded gets
   DEGRADED_S_MAXAGE so the next request retries the origin. This
   exists because caching a degraded payload at the full TTL is what
   turned a transient 429 into permanently "stale" charts in v6.0.5.
   ═══════════════════════════════════════════════════════════════ */

const BASE_URL = 'https://api.coingecko.com/api/v3/';

const GROUPS = {
    peers: {
        source: 'category:privacy-coins',
        chartN: 6,
        listN: 10,
        path: 'coins/markets?vs_currency=usd&category=privacy-coins&order=market_cap_desc&per_page=25&page=1&sparkline=false&price_change_percentage=24h',
    },
    majors: {
        source: 'market_cap_desc',
        chartN: 9,
        listN: 9,
        path: 'coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&page=1&sparkline=false&price_change_percentage=24h',
    },
};

const PIN_ID = 'monero';
const ALLOWED_DAYS = [7, 30, 90, 365];
const DEADLINE_MS = 20_000;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY_MS = 24 * HOUR;

const RANK_FRESH_MS = 15 * MINUTE;
const RANK_GRACE_MS = DAY_MS;
const META_FRESH_MS = DAY_MS;
const META_GRACE_MS = DAY_MS;
const CHART_GRACE_MS = DAY_MS;

/* 15m/30m/60m/60m for days 7/30/90/365 (brief §Cache tiers). */
function chartFreshMs(days) {
    if (days <= 7) return 15 * MINUTE;
    if (days <= 30) return 30 * MINUTE;
    return 60 * MINUTE;
}

/* ── module-scope caches (survive a warm lambda instance) ─────────── */
const rankCache = new Map();    // 'peers' | 'majors' -> { data, at }
const chartCache = new Map();   // `${id}|usd|${days}` -> { data:{t,p}, at }
const metaCache = new Map();    // 'monero' -> { data, at }
const payloadCache = new Map(); // days -> { body, at }

/* ═══════════════════════════════════════════════════════════════
   Pure, exported helpers — these are what api/verify-markets.mjs
   exercises offline (no network in this sandbox reaches CoinGecko).
   ═══════════════════════════════════════════════════════════════ */

/** Clamp an arbitrary `days` query value to the nearest allowed range.
 *  Never throws / never yields a 400 — an unparseable range must not
 *  blank the page, it just falls back to the closest (or default 30). */
export function parseDays(raw) {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return 30;
    let best = ALLOWED_DAYS[0];
    let bestDiff = Math.abs(n - best);
    for (const d of ALLOWED_DAYS) {
        const diff = Math.abs(n - d);
        if (diff < bestDiff) {
            best = d;
            bestDiff = diff;
        }
    }
    return best;
}

/** Edge cache window per range. swr is always 86400 (brief §Cache tiers). */
export function cacheSeconds(days) {
    const table = { 7: 900, 30: 1800, 90: 3600, 365: 3600 };
    return { sMaxAge: table[days] ?? 1800, swr: 86400 };
}

/* How long a payload that ISN'T fully live may be cached. Short on purpose:
   the next request must go to origin and retry rather than inherit a failure. */
export const DEGRADED_S_MAXAGE = 45;

/* Classify a payload by whether every part of it is genuinely live.
   v6.0.6: this exists because caching a degraded payload at the full TTL is
   what turned an intermittent CoinGecko 429 into a permanently "stale" chart —
   one unlucky cold fan-out was pinned in the CDN for 30 minutes and servable
   for 24h under stale-while-revalidate. */
export function payloadQuality(body) {
    if (!body || typeof body !== 'object') return 'degraded';
    if (body.partial) return 'degraded';
    const groups = body.rankings ? Object.values(body.rankings) : [];
    if (groups.some((g) => !g || g.status !== 'live')) return 'degraded';
    const series = body.series ? Object.values(body.series).flat() : [];
    if (series.length === 0) return 'degraded';
    if (series.some((s) => !s || s.status !== 'live')) return 'degraded';
    return 'full';
}

/* Only a fully-live payload earns the long TTL. */
export function cacheHeadersFor(days, quality) {
    if (quality !== 'full') return { sMaxAge: DEGRADED_S_MAXAGE, swr: DEGRADED_S_MAXAGE };
    return cacheSeconds(days);
}

function isFiniteNum(v) {
    const n = Number(v);
    return Number.isFinite(n);
}
function numOrNull(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

/** Stablecoin/peg detector keyed off the all-time band, not raw price —
 *  see the handoff brief for the full rationale. Uses only fields
 *  coins/markets rows actually carry (no market_data dependency). */
export function isPegged(row) {
    const price = Number(row?.current_price);
    const ath = Number(row?.ath);
    const atl = Number(row?.atl);
    if (!Number.isFinite(price) || price <= 0) return false;
    if (!Number.isFinite(ath) || ath <= 0) return false;
    if (!Number.isFinite(atl) || atl < 0) return false;

    const bandLow = atl / price;
    const bandHigh = ath / price;
    const change = Math.abs(Number(row?.price_change_percentage_24h) || 0);

    return bandLow >= 0.5
        && (bandHigh <= 1.5 || Math.abs(price - 1) <= 0.02)
        && change < 2;
}

const DESCRIPTOR_RX = /\b(wrapped|staked|bridged|restaked|liquid)\b/i;
const SHADOW_ANCHORS = ['bitcoin', 'ethereum'];

/** Wrapped/staked/bridged-duplicate detector. `rowsById` is a lookup
 *  over the SAME rows array being filtered (built by selectMembers),
 *  used for the price-shadow backstop against BTC/ETH anchors. */
export function isDerivative(row, rowsById) {
    if (!row || !row.id) return false;
    const text = `${row.id} ${row.name || ''}`.toLowerCase();
    if (DESCRIPTOR_RX.test(text)) return true;

    if (SHADOW_ANCHORS.includes(row.id)) return false; // never flag the anchors themselves

    const price = Number(row.current_price);
    if (!Number.isFinite(price) || price <= 0) return false;

    for (const anchorId of SHADOW_ANCHORS) {
        const anchor = rowsById && rowsById[anchorId];
        if (!anchor) continue;
        const anchorPrice = Number(anchor.current_price);
        if (!Number.isFinite(anchorPrice) || anchorPrice <= 0) continue;
        if (Math.abs(price / anchorPrice - 1) < 0.2) return true;
    }
    return false;
}

function mapMember(row, { charted, pinned }) {
    return {
        id: row.id,
        symbol: (row.symbol || '').toUpperCase(),
        name: row.name || row.id,
        rank: row.market_cap_rank ?? null,
        price: numOrNull(row.current_price),
        marketCap: numOrNull(row.market_cap),
        change24h: numOrNull(row.price_change_percentage_24h),
        charted,
        pinned,
    };
}

/** Data-driven ranking/selection over a coins/markets rows array.
 *  `rows` MUST already contain the pin row (id === pinId) for the pin
 *  to appear at index 0 — the handler ensures this via a fallback pin
 *  row (see extractPinRow/withPin) before calling in here, since
 *  `majors` rows may not naturally include a rank-~26 coin.
 *
 *  Returns { members, excluded }. `excluded` is the only audit trail
 *  for the pegged/derivative heuristics (this sandbox has no network
 *  access to CoinGecko to spot-check them any other way). Rows that
 *  are valid candidates but simply lose out to the rank cutoff (not
 *  enough slots) are NOT logged to excluded — only rows dropped for a
 *  data-quality or heuristic reason are. */
export function selectMembers(rows, { pinId, chartN, listN }) {
    const list = Array.isArray(rows) ? rows : [];
    const rowsById = {};
    for (const r of list) {
        if (r && r.id) rowsById[r.id] = r;
    }

    const pinRow = rowsById[pinId];
    const excluded = [];
    const candidates = [];

    for (const row of list) {
        if (!row || !row.id) continue;
        if (row.id === pinId) {
            // Pinned separately at index 0 — not eligible for an "others" slot.
            excluded.push({ id: row.id, reason: 'pinned' });
            continue;
        }
        if (row.market_cap_rank == null) {
            excluded.push({ id: row.id, reason: 'no-rank' });
            continue;
        }
        if (!(Number(row.market_cap) > 0)) {
            excluded.push({ id: row.id, reason: 'no-marketcap' });
            continue;
        }
        if (!isFiniteNum(row.current_price)) {
            excluded.push({ id: row.id, reason: 'invalid-price' });
            continue;
        }
        if (isPegged(row)) {
            excluded.push({ id: row.id, reason: 'pegged' });
            continue;
        }
        if (isDerivative(row, rowsById)) {
            excluded.push({ id: row.id, reason: 'derivative' });
            continue;
        }
        candidates.push(row);
    }

    candidates.sort((a, b) => (a.market_cap_rank ?? Infinity) - (b.market_cap_rank ?? Infinity));

    const othersNeeded = Math.max(0, listN - (pinRow ? 1 : 0));
    const others = candidates.slice(0, othersNeeded);
    const othersChartBudget = Math.max(0, chartN - (pinRow ? 1 : 0));

    const members = [];
    if (pinRow) {
        members.push(mapMember(pinRow, { charted: true, pinned: true }));
    } else {
        excluded.push({ id: pinId, reason: 'pin-missing-upstream' });
    }
    others.forEach((row, i) => {
        members.push(mapMember(row, { charted: i < othersChartBudget, pinned: false }));
    });

    return { members, excluded };
}

/** Stride-sample downsample: selects real points only (no interpolation,
 *  no averaging), always preserves index 0 and the last index exactly. */
export function downsample(pts, max) {
    const list = Array.isArray(pts) ? pts : [];
    const n = list.length;
    if (n <= max) return list.slice();
    if (max <= 1) return n ? [list[0]] : [];

    const step = (n - 1) / (max - 1);
    const out = new Array(max);
    for (let i = 0; i < max; i++) {
        out[i] = list[Math.round(i * step)];
    }
    out[0] = list[0];
    out[max - 1] = list[n - 1];
    return out;
}

/** Tiny concurrency-limited pool — runs `fn` over `items` with at most
 *  `n` in flight at once, preserving output order. */
export async function pool(items, n, fn) {
    const list = Array.isArray(items) ? items : [];
    const results = new Array(list.length);
    let next = 0;
    async function worker() {
        while (next < list.length) {
            const i = next++;
            results[i] = await fn(list[i], i);
        }
    }
    const workers = Array.from({ length: Math.max(1, Math.min(n, list.length)) }, worker);
    await Promise.all(workers);
    return results;
}

/* ═══════════════════════════════════════════════════════════════
   Network layer — not exercised by the offline gate.
   ═══════════════════════════════════════════════════════════════ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Base retry delays in ms. CoinGecko's rate-limit window is per MINUTE, so the
   old single 300-700ms retry just re-hit the same wall and the series came back
   unavailable — the root of the v6.0.5 "permanently stale" charts. These span
   ~15s of wall clock, which is enough to clear a burst without blowing the
   20s DEADLINE_MS budget. Exported so the gate can assert the shape. */
export function backoffDelays() {
    return [1000, 4000, 10000];
}

/* Full jitter (AWS-style): random in [0, base]. Prevents a fan-out of 14
   concurrent coins from retrying in lockstep and re-triggering the limit. */
function jitter(base) {
    return Math.floor(Math.random() * base);
}

/* CoinGecko demo key, when configured. Without it we're on the anonymous public
   tier, which is ~5-15 req/min against an IP shared with every other Vercel
   tenant — not enough for this endpoint's cold-start fan-out.
   A PRO key instead uses https://pro-api.coingecko.com/api/v3/ with the
   'x-cg-pro-api-key' header; that's a two-line change from here. */
export function cgHeaders(env = process.env) {
    const headers = { Accept: 'application/json' };
    const key = env.COINGECKO_API_KEY;
    if (key) headers['x-cg-demo-api-key'] = key;
    return headers;
}

/* Single upstream call with jittered backoff on 429/5xx, sized to CoinGecko's
   per-minute limit window. */
async function fetchUpstream(path) {
    const url = BASE_URL + path;
    const attempt = (timeoutMs) => fetch(url, {
        headers: cgHeaders(),
        signal: AbortSignal.timeout(timeoutMs),
    });

    let res = await attempt(12000);
    for (const base of backoffDelays()) {
        if (res.status !== 429 && res.status < 500) break;
        await sleep(jitter(base));
        res = await attempt(8000);
    }
    if (!res.ok) {
        const err = new Error(`upstream ${res.status} for ${path}`);
        err.status = res.status;
        throw err;
    }
    return res.json();
}

/* Generic module-cache-backed fetch: fresh cache hit -> 'live' (no
   network call needed); fresh cache miss + budget available -> attempt
   a live fetch; fetch failure or budget exhausted -> fall back to the
   last-good value within `graceMs` as 'stale'; nothing at all ->
   'unavailable'.
   NOTE (decision beyond the brief): "live" here means "current data,
   confidently servable this response" — either freshly fetched THIS
   invocation, or a cache entry still inside its fresh TTL from an
   earlier invocation of a warm lambda. Only data reached via the
   grace-period fallback (TTL expired, live fetch unavailable/failed)
   is labeled 'stale'. A strictly literal "live only if network-fetched
   this exact request" reading would defeat the whole point of the
   payloadCache/rankCache/chartCache tiers (serving cached data to
   avoid re-fetching per visitor), so status reflects data confidence,
   not literally which invocation touched the network. */
async function withCache({ cache, key, freshMs, graceMs, budgetOk, fetchFn }) {
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && now - hit.at < freshMs) {
        return { data: hit.data, at: hit.at, status: 'live' };
    }
    if (budgetOk && !budgetOk()) {
        if (hit && now - hit.at < graceMs) return { data: hit.data, at: hit.at, status: 'stale' };
        return { data: null, at: null, status: 'unavailable' };
    }
    try {
        const data = await fetchFn();
        const at = Date.now();
        cache.set(key, { data, at });
        return { data, at, status: 'live' };
    } catch (e) {
        if (hit && now - hit.at < graceMs) return { data: hit.data, at: hit.at, status: 'stale' };
        return { data: null, at: null, status: 'unavailable' };
    }
}

async function fetchChartRaw(id, days) {
    const json = await fetchUpstream(`coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}`);
    const raw = Array.isArray(json?.prices) ? json.prices : [];
    const sampled = downsample(raw, 400);
    return {
        t: sampled.map((pt) => pt[0]),
        p: sampled.map((pt) => numOrNull(pt[1])),
    };
}

/* Resolve the pin row's own coins/markets-shaped data, preferring the
   privacy-coins response (monero is always a member of that category),
   then the majors response, then falling back to the coins/monero meta
   payload's market_data block so the pin never goes missing just
   because monero's rank falls outside a top-25 majors page. */
function extractPinRow(peersRows, majorsRows, metaData) {
    const fromPeers = peersRows.find((r) => r?.id === PIN_ID);
    if (fromPeers) return fromPeers;
    const fromMajors = majorsRows.find((r) => r?.id === PIN_ID);
    if (fromMajors) return fromMajors;
    const md = metaData?.market_data;
    if (md) {
        return {
            id: PIN_ID,
            symbol: metaData.symbol || 'xmr',
            name: metaData.name || 'Monero',
            current_price: md.current_price?.usd,
            market_cap: md.market_cap?.usd,
            market_cap_rank: md.market_cap_rank ?? metaData.market_cap_rank ?? null,
            price_change_percentage_24h: md.price_change_percentage_24h,
            ath: md.ath?.usd,
            atl: md.atl?.usd,
        };
    }
    return null;
}

function withPin(rows, pinRow) {
    if (!pinRow) return rows;
    if (rows.some((r) => r?.id === pinRow.id)) return rows;
    return [...rows, pinRow];
}

function buildSeries(members, chartMap) {
    return members
        .filter((m) => m.charted)
        .map((m) => {
            const r = chartMap.get(m.id);
            if (!r) return { id: m.id, symbol: m.symbol, status: 'unavailable', at: null, t: [], p: [] };
            return { id: m.id, symbol: m.symbol, status: r.status, at: r.at, t: r.data?.t || [], p: r.data?.p || [] };
        });
}

async function buildPayload(days, deadlineAt) {
    const budgetOk = () => Date.now() < deadlineAt;

    const [peersRes, majorsRes, metaRes] = await Promise.all([
        withCache({
            cache: rankCache, key: 'peers', freshMs: RANK_FRESH_MS, graceMs: RANK_GRACE_MS,
            budgetOk, fetchFn: () => fetchUpstream(GROUPS.peers.path),
        }),
        withCache({
            cache: rankCache, key: 'majors', freshMs: RANK_FRESH_MS, graceMs: RANK_GRACE_MS,
            budgetOk, fetchFn: () => fetchUpstream(GROUPS.majors.path),
        }),
        withCache({
            cache: metaCache, key: 'monero', freshMs: META_FRESH_MS, graceMs: META_GRACE_MS,
            budgetOk, fetchFn: () => fetchUpstream('coins/monero'),
        }),
    ]);

    const peersRows = Array.isArray(peersRes.data) ? peersRes.data : [];
    const majorsRows = Array.isArray(majorsRes.data) ? majorsRes.data : [];
    const metaData = metaRes.data;

    const pinRow = extractPinRow(peersRows, majorsRows, metaData);
    const peersSel = selectMembers(withPin(peersRows, pinRow), { pinId: PIN_ID, ...GROUPS.peers });
    const majorsSel = selectMembers(withPin(majorsRows, pinRow), { pinId: PIN_ID, ...GROUPS.majors });

    const unionIds = Array.from(new Set([
        ...peersSel.members.filter((m) => m.charted).map((m) => m.id),
        ...majorsSel.members.filter((m) => m.charted).map((m) => m.id),
    ]));

    const chartEntries = await pool(unionIds, 4, async (id) => {
        const r = await withCache({
            cache: chartCache, key: `${id}|usd|${days}`, freshMs: chartFreshMs(days), graceMs: CHART_GRACE_MS,
            budgetOk, fetchFn: () => fetchChartRaw(id, days),
        });
        return [id, r];
    });
    const chartMap = new Map(chartEntries);

    // Soft-deadline signal: if the budget was already spent by the time the
    // history fan-out ran, at least one chart (or ranking/meta) call above
    // was served from grace/unavailable instead of a live fetch.
    const partial = Date.now() > deadlineAt;

    return {
        v: 1,
        days,
        fetchedAt: new Date().toISOString(),
        partial,
        meta: {
            status: metaRes.status,
            ath: numOrNull(metaData?.market_data?.ath?.usd),
            athDate: metaData?.market_data?.ath_date?.usd ?? null,
            atl: numOrNull(metaData?.market_data?.atl?.usd),
            atlDate: metaData?.market_data?.atl_date?.usd ?? null,
        },
        rankings: {
            peers: { status: peersRes.status, at: peersRes.at, source: GROUPS.peers.source, members: peersSel.members, excluded: peersSel.excluded },
            majors: { status: majorsRes.status, at: majorsRes.at, source: GROUPS.majors.source, members: majorsSel.members, excluded: majorsSel.excluded },
        },
        series: {
            peers: buildSeries(peersSel.members, chartMap),
            majors: buildSeries(majorsSel.members, chartMap),
        },
    };
}

export default async function handler(req, res) {
    const start = Date.now();
    const deadlineAt = start + DEADLINE_MS;
    const days = parseDays(req.query?.days);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    /* The module cache is gated by the SAME quality rule as the CDN: a warm
       lambda holding a degraded body must re-attempt after DEGRADED_S_MAXAGE
       rather than re-serving the failure for the full window. */
    const cached = payloadCache.get(days);
    if (cached) {
        const hit = cacheHeadersFor(days, cached.quality);
        if (Date.now() - cached.at < hit.sMaxAge * 1000) {
            res.setHeader('Cache-Control', `public, s-maxage=${hit.sMaxAge}, stale-while-revalidate=${hit.swr}`);
            res.setHeader('X-Cache', 'hit');
            res.setHeader('X-Markets-Quality', cached.quality);
            return res.status(200).json(cached.body);
        }
    }

    try {
        const body = await buildPayload(days, deadlineAt);
        const quality = payloadQuality(body);
        const { sMaxAge, swr } = cacheHeadersFor(days, quality);
        payloadCache.set(days, { body, at: Date.now(), quality });
        res.setHeader('Cache-Control', `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`);
        res.setHeader('X-Cache', 'miss');
        res.setHeader('X-Markets-Quality', quality);
        return res.status(200).json(body);
    } catch (err) {
        res.setHeader('Cache-Control', 'public, s-maxage=300');
        return res.status(502).json({
            error: 'markets aggregation failed',
            detail: err && err.message ? err.message : String(err),
        });
    }
}
