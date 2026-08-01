/**
 * routes/useUrlState.ts — D0746. One enumerated piece of UI state, stored in
 * the query string, read and written through a single hook.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * Two live bugs, the same shape, in two files:
 *
 *   • MempoolPage.tsx clicked a view tile with `setParams({ v: it.id })`.
 *     The OBJECT form of react-router's setter REPLACES the whole query
 *     string, so switching views silently dropped `?block=<height>` — the
 *     deep link the HomePage block ribbon hands out. The same file's
 *     `clearFocus` two dozen lines above already used the functional form
 *     (`(prev) => new URLSearchParams(prev)`), so one page held both idioms
 *     and only one of them was correct.
 *   • SimulatePage.tsx did the identical `setParams({ p: p.id })`.
 *
 * The functional form is therefore not a style preference here — it is the
 * entire point of the hook. Every write below composes onto the CURRENT
 * params, so a key this hook does not own is never touched.
 *
 * ─── PUSH VS REPLACE POLICY ─────────────────────────────────────────────────
 * A query parameter that names PRIMARY, SHAREABLE CONTENT gets a history
 * entry, so Back means "the thing I was looking at before":
 *
 *     /mempool?v=…    PUSH   (which of the six mempool views)
 *     /simulate?p=…   PUSH   (which of the 21 protocol simulators)
 *
 * A parameter that is a SECONDARY, HIGH-FREQUENCY control of the same content
 * replaces instead, so Back leaves the page rather than walking a trail of
 * fiddling:
 *
 *     /markets?range=…  REPLACE  (30D/90D/… on the same charts)
 *
 * `clearAtFallback` pairs with that: /markets with no `?range=` renders 30D,
 * so selecting 30D writes NO parameter rather than pinning the default into
 * the URL. Absent and default then mean the same thing, and the canonical
 * /markets URL stays clean.
 *
 * ─── WHAT DOES *NOT* BELONG HERE ────────────────────────────────────────────
 * `/monero/:tab` and `/education/:tab` stay PATH segments. They are
 * prerendered to real HTML per path (scripts/routes.mjs → prerender.mjs) and
 * listed in sitemap.xml; moving them to `?tab=` would collapse eleven static
 * documents into one and delete them from the sitemap. The DesignPanel's open
 * state stays in React state — it is chrome, not content, and nobody shares a
 * link to an open panel.
 *
 * ─── THE THIRD TUPLE SLOT ───────────────────────────────────────────────────
 * `{ raw, isKnown }` exists because "absent" and "present but unrecognised"
 * are different facts and SimulatePage must tell them apart: no `?p=` opens
 * the default simulator, but `?p=nonsense` must render its honest
 * "no such simulator" state rather than quietly substituting a different
 * protocol. Collapsing both to the fallback is exactly the bug v6.0.9 fixed.
 */

import * as React from "react";
import { useSearchParams } from "react-router-dom";

export interface UrlStateSpec<T extends string> {
  /** Query-string key this hook owns. No other key is ever written. */
  key: string;
  /** The complete set of accepted values. Anything else is "unknown". */
  values: readonly T[];
  /** Value rendered when the param is absent or unrecognised. */
  fallback: T;
  /** `true` → write with `{ replace: true }` (secondary control). Default: push. */
  replace?: boolean;
  /** `true` → writing the fallback DELETES the key instead of setting it. */
  clearAtFallback?: boolean;
}

export interface UrlStateInfo {
  /** The raw string in the URL, or `null` when the key is absent. */
  raw: string | null;
  /** `true` only when `raw` is one of `values`. Absent ⇒ `false`. */
  isKnown: boolean;
}

export type UrlStateResult<T extends string> = [T, (next: T) => void, UrlStateInfo];

export function useUrlState<T extends string>(spec: UrlStateSpec<T>): UrlStateResult<T> {
  const { key, values, fallback, replace = false, clearAtFallback = false } = spec;
  const [params, setParams] = useSearchParams();

  const raw = params.get(key);
  // `values` is typed `readonly T[]`; widen for the membership test so callers
  // can pass a `readonly ["a","b"]` literal without a cast at the call site.
  const isKnown = raw != null && (values as readonly string[]).includes(raw);
  const value = (isKnown ? (raw as T) : fallback);

  // `values` is intentionally NOT a dependency. Call sites hoist their id list
  // to module scope (MEMPOOL_VIEW_IDS, PROTOCOL_IDS, RANGE_KEYS), and an
  // inline array literal would otherwise re-create this callback every render
  // for no behavioural gain — the setter never reads `values`.
  const set = React.useCallback(
    (next: T) => {
      setParams(
        (prev) => {
          // ALWAYS the functional form: compose onto the params that are
          // actually in the URL right now. This is what keeps `?block` alive
          // across a `?v` change (and would keep any future third key alive
          // for free).
          const out = new URLSearchParams(prev);
          if (clearAtFallback && next === fallback) out.delete(key);
          else out.set(key, next);
          return out;
        },
        { replace },
      );
    },
    [setParams, key, fallback, replace, clearAtFallback],
  );

  return [value, set, { raw, isKnown }];
}
