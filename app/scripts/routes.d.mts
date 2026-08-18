// routes.d.mts — companion declaration for routes.mjs.
//
// tsconfig.json has `allowJs: false` (out of scope for this change — it is
// not in this task's owned file list), so a plain .mjs import from a .ts
// file under src/ has no type information by default (TS7016). TypeScript
// resolves a `.d.mts` file sitting next to a `.mjs` file as that module's
// types automatically, regardless of the relative path a given import site
// uses to reach it — this is the standard mechanism for typing a hand-written
// JS module, not an ambient per-path `declare module` workaround. Node's own
// resolution of routes.mjs (prerender.mjs, gen-sitemap.mjs, and verify-ia.mjs
// importing src/nav/ia.ts) is untouched: this file is invisible to Node,
// which reads routes.mjs directly.
//
// Kept hand-in-sync with routes.mjs's actual shape; there is nothing to
// generate it from without adding a build step this task doesn't need.

export interface RouteMap {
  HOME: string;
  LIVE_MEMPOOL: string;
  LIVE_MARKETS: string;
  MARKETS_THESIS: string;
  LIVE_NETWORK: string;
  LEARN: string;
  LEARN_SIM: string;
  MONERO: string;
  FUTURE: string;
  FUTURE_OUTLOOK: string;
  OPERATE_NODE: string;
  OPERATE_MINE: string;
  OPERATE_SUPERSTRESS: string;
  ABOUT_PEERS: string;
  ABOUT_SOURCES: string;
  ABOUT_SITE: string;
}

export interface RedirectPair {
  /** Old path, possibly carrying a react-router `:param` segment. */
  from: string;
  /** New path/query template. May carry the SAME `:param` name as `from`;
   *  substitution happens in src/routes/RedirectTo.tsx, not here. */
  to: string;
}

export interface HashRedirectPair {
  /** Fragment WITHOUT the leading "#". */
  hash: string;
  to: string;
}

export const R: Readonly<RouteMap>;
export const ROUTES: readonly string[];
export const REDIRECTS: readonly RedirectPair[];
export const HASH_REDIRECTS: readonly HashRedirectPair[];
export const SITE_ORIGIN: string;
export function absoluteUrl(route: string): string;
