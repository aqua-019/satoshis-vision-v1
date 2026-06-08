/**
 * data/http.ts — the single same-origin GET helper for the app.
 *
 * Resolves to parsed JSON or null, and NEVER throws (network error, non-2xx,
 * or malformed body all collapse to null). The data feed and the mempool
 * detail fetchers share this so there is exactly one fetch contract.
 *
 * Privacy invariant: callers only ever hit same-origin `/api/*` — the dev
 * proxy (vite.config.ts) keeps `npm run dev` same-origin too.
 */
export async function getJSON<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(url, init);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}
