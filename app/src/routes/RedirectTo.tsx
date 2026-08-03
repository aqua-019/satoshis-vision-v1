/**
 * routes/RedirectTo.tsx — client-side mirror of vercel.json's 12 server 301s.
 *
 * `<Navigate to="/live/mempool" replace />` takes a STRING LITERAL. A visitor
 * following a shared link like `/mempool?v=reactor` would land on
 * `/live/mempool` with the query silently DISCARDED — breaking every deep
 * link this restructure promises to keep alive (`?v=`, `?p=`, `?range=`,
 * `?block=`). That is exactly the defect Requirement 1 ("never break a
 * shared link") exists to catch, so a bare `<Navigate to="literal">` is
 * wrong here even though it is the obvious first draft. RedirectTo instead
 * reads the CURRENT location's search + hash and appends them to the
 * destination, so a redirect never drops what the visitor actually asked
 * for.
 *
 * App.tsx generates all 12 client mirrors by mapping
 * scripts/routes.mjs's `REDIRECTS` table onto `<RedirectTo to={to} />` —
 * one component, one table, not twelve hand-typed `<Route>` elements. That
 * table is plain data with no react-router awareness (it has to be readable
 * by vercel.json's human author and by verify-ia.mjs under bare Node), so
 * three of its `to` templates carry a bare `:name` segment the SOURCE route
 * matched as a param — `/education/:tab` → `/learn/:tab`,
 * `/simulate/:id` → `/learn/sim?p=:id`, `/mempool/tx/:txid` →
 * `/live/mempool/tx/:txid` — and substitution has to happen HERE, from
 * `useParams()`, which is the one piece REDIRECTS itself cannot supply.
 *
 * `/simulate/:id`'s template already carries its own query (`?p=:id`).
 * Concatenating that with the visitor's existing search would produce a
 * malformed `?p=<id>?foo=bar` or silently drop `?foo=bar` — so this MERGES
 * the two query strings into one `URLSearchParams` (the template's own
 * params win on a key collision; everything else the visitor's URL already
 * had survives), the same "compose onto what's there" discipline
 * routes/useUrlState.ts's setter follows for the same reason. Every other
 * `to` template carries no query of its own, so for those this reduces to
 * exactly "append the visitor's search unchanged".
 */

import * as React from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";

export function RedirectTo({ to }: { to: string }) {
  const params = useParams();
  const { search, hash } = useLocation();

  // Substitute every :name the destination template names, from the params
  // the SOURCE <Route path> actually matched. A no-op for the 9 of 12
  // REDIRECTS templates that carry no ":" at all.
  const substituted = to.replace(/:([A-Za-z0-9_]+)/g, (_match, name: string) =>
    encodeURIComponent(params[name] ?? ""),
  );

  const [destPath, destQuery = ""] = substituted.split("?");
  const merged = new URLSearchParams(search);
  if (destQuery) {
    for (const [k, v] of new URLSearchParams(destQuery)) merged.set(k, v);
  }
  const qs = merged.toString();

  return <Navigate to={`${destPath}${qs ? `?${qs}` : ""}${hash}`} replace />;
}
